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
- Ensure all double quotes inside strings are properly escaped to prevent invalid JSON formatting.
- Do NOT include markdown fences, just output the raw JSON object.
"""

GRAPH_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "entities": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "type": {"type": "STRING"},
                    "description": {"type": "STRING"}
                },
                "required": ["name", "type", "description"]
            }
        },
        "relationships": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "source": {"type": "STRING"},
                    "target": {"type": "STRING"},
                    "relation": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"}
                },
                "required": ["source", "target", "relation", "confidence"]
            }
        }
    },
    "required": ["entities", "relationships"]
}


async def extract_entities_relationships(chunk_text: str) -> Dict[str, List[dict]]:
    """Extract entities + relationships from a single chunk."""
    try:
        raw = await generate_content(
            prompt=f"Document excerpt:\n\n{chunk_text}\n\nExtract the entity-relationship graph as JSON.",
            system_instruction=EXTRACTION_SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.1,
            response_schema=GRAPH_SCHEMA
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
