"""
Hybrid Graph RAG pipeline:

  Question → Knowledge Graph Search → Semantic (vector) Search
           → Merge Context → Gemini → Cited, confidence-scored Answer

Every answer is grounded in retrieved evidence. If Gemini is rate-limited
or unavailable, a heuristic extractive answer is returned instead of an error.
"""
import re
import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from models.models import Chunk, Document, Entity
from embeddings.embedder import get_embedding, cosine_similarity
from graph.graph_builder import build_graph_for_user, search_graph_for_terms
from llm.gemini_client import generate_content as gemini_generate, GeminiError
from llm.openai_client import generate_content as openai_generate, OpenAIError
from llm.tavily_client import search_web

logger = logging.getLogger("nova.rag")

MIN_RELEVANCE = 0.05
STOPWORDS = {
    "the", "is", "are", "of", "and", "to", "in", "for", "a", "an",
    "what", "which", "how", "does", "do", "who", "where", "when", "why",
    "on", "with", "this", "that",
}


def _terms(question: str) -> List[str]:
    words = re.findall(r"[A-Za-z0-9\-]+", question)
    return [w for w in words if w.lower() not in STOPWORDS]


async def retrieve(
    db: Session,
    user_id: str,
    question: str,
    document_ids: Optional[List[str]] = None,
    top_k: int = 6,
) -> dict:
    q_embedding = await get_embedding(question)  # never raises

    chunk_query = (
        db.query(Chunk)
        .join(Document, Chunk.document_id == Document.id)
        .filter(Document.owner_id == user_id, Document.status == "ready")
    )
    if document_ids:
        chunk_query = chunk_query.filter(Chunk.document_id.in_(document_ids))
    chunks = chunk_query.all()

    scored = []
    for c in chunks:
        if not c.embedding_vector:
            continue
        sim = cosine_similarity(q_embedding, c.embedding_vector)
        scored.append((sim, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = [c for sim, c in scored[:top_k] if sim >= MIN_RELEVANCE]
    top_scores = [sim for sim, c in scored[:top_k] if sim >= MIN_RELEVANCE]

    g = build_graph_for_user(db, user_id, document_ids)
    graph_node_ids = search_graph_for_terms(g, _terms(question), hops=1)
    graph_nodes = []
    for nid in graph_node_ids[:20]:
        data = g.nodes[nid]
        graph_nodes.append({"id": nid, "label": data.get("label"), "type": data.get("type")})

    return {
        "chunks": top_chunks,
        "scores": top_scores,
        "graph_nodes": graph_nodes,
        "graph": g,
    }


def _build_context_block(chunks, documents_by_id) -> str:
    lines = []
    for i, c in enumerate(chunks):
        doc = documents_by_id.get(c.document_id)
        fname = doc.filename if doc else "unknown"
        lines.append(f"[Source {i+1} | {fname} | page {c.page_number}]\n{c.text}")
    return "\n\n".join(lines)


def _heuristic_answer(question: str, chunks, documents_by_id) -> str:
    """
    Extractive fallback: pick the 2-3 most relevant sentences from the top
    chunks and compose an answer without calling any LLM.
    """
    if not chunks:
        return (
            "I could not find relevant information in your documents to answer this question. "
            "Please upload relevant documents first."
        )

    question_terms = set(w.lower() for w in _terms(question))
    best_sentences: List[tuple] = []

    for c in chunks[:4]:
        doc = documents_by_id.get(c.document_id)
        fname = doc.filename if doc else "unknown"
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", c.text) if len(s.strip()) > 30]
        for sent in sentences:
            score = sum(1 for t in question_terms if t in sent.lower())
            if score > 0:
                best_sentences.append((score, sent, fname, c.page_number))

    best_sentences.sort(key=lambda x: x[0], reverse=True)
    top = best_sentences[:3]

    if not top:
        # Fallback: just take the first meaningful sentence from top chunk
        doc = documents_by_id.get(chunks[0].document_id)
        fname = doc.filename if doc else "unknown"
        sentences = [s.strip() for s in chunks[0].text.split(".") if len(s.strip()) > 20]
        text = (sentences[0] + ".") if sentences else chunks[0].text[:300]
        return f"Based on **{fname}**: {text}\n\n*Note: AI summarization unavailable — showing extracted text.*"

    parts = []
    for _, sent, fname, page in top:
        parts.append(f"{sent} *(from {fname}, page {page})*")

    return (
        "Based on your documents:\n\n"
        + "\n\n".join(f"• {p}" for p in parts)
        + "\n\n*Note: AI is temporarily unavailable — showing extracted text. Please try again shortly.*"
    )


ANSWER_SYSTEM_PROMPT = """You are Nova AI, a zero-hallucination compliance assistant.
Answer strictly using the provided sources. If the sources do not contain the
answer, say so explicitly rather than guessing. However, if the user is just
offering a conversational greeting (like "hi" or "hello"), you may respond politely
before asking how you can help with their documents. After the answer, on a new
line output exactly: CONFIDENCE: <number 0-100> reflecting how directly the
sources support your answer. Cite sources inline like [Source 1], [Source 2]."""


async def generate_answer(
    question: str,
    chunks,
    scores,
    documents_by_id,
    graph_nodes: list,
    provider: str = "gemini",
    api_key: Optional[str] = None,
) -> dict:
    context_block = _build_context_block(chunks, documents_by_id) if chunks else ""
    graph_hint = ""
    if graph_nodes:
        labels = ", ".join(sorted({n["label"] for n in graph_nodes if n.get("label")}))
        if labels:
            graph_hint = f"\n\nRelated knowledge graph entities: {labels}"

    citations = []
    if chunks:
        for c in chunks:
            doc = documents_by_id.get(c.document_id)
            citations.append(
                {
                    "document_id": c.document_id,
                    "filename": doc.filename if doc else "unknown",
                    "page": c.page_number,
                    "snippet": c.text[:280],
                    "chunk_id": c.id,
                }
            )

    avg_sim = sum(scores) / len(scores) if scores else 0.0

    # If very little internal evidence, try Tavily web fallback
    used_tavily = False
    if not chunks or avg_sim < 0.15:
        logger.info(f"Insufficient internal evidence for '{question}'. Trying Tavily.")
        try:
            web_results = await search_web(question)
            if web_results:
                used_tavily = True
                web_context = "\n\n".join(
                    [f"[Web Source {i+1} | {r['title']}]\n{r['content']}"
                     for i, r in enumerate(web_results)]
                )
                context_block = f"{context_block}\n\n--- Web Search Results ---\n\n{web_context}"
                for i, r in enumerate(web_results):
                    citations.append(
                        {
                            "document_id": f"web-{i}",
                            "filename": r["url"],
                            "page": 1,
                            "snippet": r["content"][:280],
                            "chunk_id": "web",
                        }
                    )
        except Exception as e:
            logger.warning(f"Tavily search failed: {e}")

    # If still no context after Tavily, use heuristic or decline
    if not chunks and not used_tavily:
        # Check for greeting
        greetings = {"hi", "hello", "hey", "greetings", "howdy"}
        if any(g in question.lower() for g in greetings):
            return {
                "answer": "Hello! I'm Nova AI, your compliance assistant. How can I help you with your documents today?",
                "confidence": 100.0,
                "citations": [],
            }
        return {
            "answer": (
                "I couldn't find relevant information in your uploaded documents. "
                "Please upload compliance documents first, then ask your question."
            ),
            "confidence": 0.0,
            "citations": [],
        }

    heuristic_confidence = round(min(0.97, 0.35 + avg_sim * 1.4) * 100, 1)
    if used_tavily:
        heuristic_confidence = 60.0

    try:
        prompt = f"Sources:\n\n{context_block}{graph_hint}\n\nQuestion: {question}\n\nAnswer:"

        if provider == "openai":
            raw = await openai_generate(
                prompt,
                api_key=api_key,
                system_instruction=ANSWER_SYSTEM_PROMPT,
                temperature=0.15,
            )
        else:
            raw = await gemini_generate(
                prompt,
                system_instruction=ANSWER_SYSTEM_PROMPT,
                temperature=0.15,
                api_key=api_key,
            )

        conf_match = re.search(r"CONFIDENCE:\s*(\d+(?:\.\d+)?)", raw)
        confidence = float(conf_match.group(1)) if conf_match else heuristic_confidence
        answer_text = re.sub(r"CONFIDENCE:\s*\d+(?:\.\d+)?\s*$", "", raw).strip()

        if "No supporting evidence found" in answer_text or answer_text.startswith(
            "I couldn't find evidence"
        ):
            return {"answer": "No supporting evidence found.", "confidence": 0.0, "citations": []}

        return {"answer": answer_text, "confidence": round(confidence, 1), "citations": citations}

    except Exception as e:
        logger.warning(f"AI API unavailable, using heuristic fallback: {e}")
        err_str = str(e)

        if "429" in err_str or "rate" in err_str.lower() or "Too Many Requests" in err_str:
            # Use extractive heuristic rather than showing an error
            heuristic_text = _heuristic_answer(question, chunks, documents_by_id)
            return {
                "answer": heuristic_text,
                "confidence": round(heuristic_confidence * 0.6, 1),  # lower confidence for heuristic
                "citations": citations,
            }
        elif "GEMINI_API_KEY" in err_str or "api_key" in err_str.lower():
            heuristic_text = _heuristic_answer(question, chunks, documents_by_id)
            return {
                "answer": heuristic_text,
                "confidence": round(heuristic_confidence * 0.6, 1),
                "citations": citations,
            }
        else:
            heuristic_text = _heuristic_answer(question, chunks, documents_by_id)
            return {
                "answer": heuristic_text,
                "confidence": round(heuristic_confidence * 0.5, 1),
                "citations": citations,
            }
