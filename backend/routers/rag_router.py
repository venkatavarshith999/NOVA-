from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, Question, Answer, Document
from auth.security import get_current_user
from schemas.schemas import AskRequest, AskResponse, Citation, HistoryItem
from rag.pipeline import retrieve, generate_answer

router = APIRouter(prefix="/api", tags=["rag"])


@router.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    question_row = Question(user_id=user.id, text=payload.question)
    db.add(question_row)
    db.commit()
    db.refresh(question_row)

    result = await retrieve(db, user.id, payload.question, payload.document_ids, payload.top_k)
    documents_by_id = {d.id: d for d in db.query(Document).filter(Document.owner_id == user.id).all()}

    answer_data = await generate_answer(
        payload.question, result["chunks"], result["scores"], documents_by_id, result["graph_nodes"],
        provider=payload.llm_provider or "gemini", api_key=payload.api_key
    )

    answer_row = Answer(
        question_id=question_row.id,
        text=answer_data["answer"],
        confidence=answer_data["confidence"],
        citations=answer_data["citations"],
        graph_nodes=[n["id"] for n in result["graph_nodes"]],
    )
    db.add(answer_row)
    db.commit()
    db.refresh(answer_row)

    return AskResponse(
        question_id=question_row.id,
        answer=answer_data["answer"],
        confidence=answer_data["confidence"],
        citations=[Citation(**c) for c in answer_data["citations"]],
        graph_nodes=[n["id"] for n in result["graph_nodes"]],
        related_entities=result["graph_nodes"],
    )


@router.get("/history", response_model=List[HistoryItem])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    questions = db.query(Question).filter(Question.user_id == user.id).order_by(Question.created_at.desc()).all()
    items = []
    for q in questions:
        items.append(HistoryItem(
            question_id=q.id, question=q.text,
            answer=q.answer.text if q.answer else None,
            confidence=q.answer.confidence if q.answer else None,
            created_at=q.created_at,
        ))
    return items


@router.post("/answer/{answer_id}/bookmark")
def bookmark_answer(answer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    answer = db.query(Answer).join(Question).filter(Answer.id == answer_id, Question.user_id == user.id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    answer.bookmarked = not answer.bookmarked
    db.commit()
    return {"bookmarked": answer.bookmarked}


@router.get("/bookmarks", response_model=List[HistoryItem])
def bookmarks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(Question).join(Answer).filter(Question.user_id == user.id, Answer.bookmarked == True)
            .order_by(Question.created_at.desc()).all())
    return [HistoryItem(question_id=q.id, question=q.text, answer=q.answer.text,
                         confidence=q.answer.confidence, created_at=q.created_at) for q in rows]
