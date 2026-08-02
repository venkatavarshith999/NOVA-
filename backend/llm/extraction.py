import logging
from typing import Dict, List

from llm.gemini_client import generate_content, extract_json, GeminiError

logger = logging.getLogger("nova.extraction")

ALLOWED_ENTITY_TYPES = [
    "Organization", "Department", "Country", "Person", "Policy", "Regulation",
    "Standard", "Product", "Storage Location", "Security Control", "Encryption",
    "Retention Period", "Compliance Rule",
]
ALLOWED_RELATIONS = [
    "stored_in", "encrypted_with", "approved_by", "governed_by", "depends_on",
    "requires", "complies_with", "violates", "belongs_to", "linked_to",
]

EXTRACTION_SYSTEM_PROMPT = f"""You are a compliance-domain information extraction engine for Nova AI.
Extract a precise entity-relationship graph from the given document excerpt.

Allowed entity types: {", ".join(ALLOWED_ENTITY_TYPES)}
Allowed relationship types: {", ".join(ALLOWED_RELATIONS)}

Rules:
- Only extract entities and relationships that are explicitly supported by the text.
- Never invent facts not present in the excerpt.
- Return strict JSON only, matching this schema:
{{"entities": [{{"name": str, "type": str, "description": str}}],
  "relationships": [{{"source": str, "target": str, "relation": str, "confidence": number between 0 and 1}}]}}
"""


async def extract_entities_relationships(chunk_text: str) -> Dict[str, List[dict]]:
    """Extract entities + relationships from a single chunk."""
    try:
        raw = await generate_content(
            prompt=f"Document excerpt:\n\n{chunk_text}\n\nExtract the entity-relationship graph as JSON.",
            system_instruction=EXTRACTION_SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.1,
        )
        parsed = extract_json(raw)
        entities = parsed.get("entities", [])
        relationships = parsed.get("relationships", [])
        # sanitize
        entities = [e for e in entities if e.get("name")]
        relationships = [r for r in relationships if r.get("source") and r.get("target") and r.get("relation")]
        return {"entities": entities, "relationships": relationships}
    except Exception as e:
        logger.error(f"AI API Extraction Failed: {e}")
        raise RuntimeError(f"AI Extraction Failed: {e}")
