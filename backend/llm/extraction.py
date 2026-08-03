import logging
import re
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


def _heuristic_extract(chunk_text: str) -> Dict[str, List[dict]]:
    """
    Local heuristic extractor used when the AI API is unavailable.
    Looks for capitalised noun phrases that match known compliance concepts.
    Not perfect, but ensures the pipeline runs end-to-end without an API key.
    """
    entities: List[dict] = []
    seen = set()

    # Detect regulation keywords
    reg_patterns = [
        (r"\b(GDPR|HIPAA|SOX|PCI\s*DSS|CCPA|ISO\s*27001|NIST|FERPA|GLBA|DORA)\b", "Regulation"),
        (r"\b(encryption|AES|TLS|SSL|RSA)\b", "Encryption"),
        (r"\b(data\s+retention|retention\s+period)\b", "Retention Period"),
        (r"\b(access\s+control|authorization|authentication|MFA|2FA)\b", "Security Control"),
        (r"\b(policy|procedure|standard|guideline|framework)\b", "Policy"),
        (r"\b(department|team|division|unit)\b", "Department"),
    ]

    for pattern, etype in reg_patterns:
        for m in re.finditer(pattern, chunk_text, re.IGNORECASE):
            name = m.group(0).strip()
            key = name.lower()
            if key not in seen and len(name) > 2:
                seen.add(key)
                entities.append({
                    "name": name,
                    "type": etype,
                    "description": f"{etype} referenced in document"
                })

    # Also grab ALL-CAPS acronyms as possible entities
    for m in re.finditer(r"\b[A-Z]{2,}\b", chunk_text):
        name = m.group(0)
        key = name.lower()
        if key not in seen and len(name) >= 3:
            seen.add(key)
            entities.append({
                "name": name,
                "type": "Compliance Rule",
                "description": "Acronym or standard referenced in document"
            })

    return {"entities": entities[:20], "relationships": []}


async def extract_entities_relationships(chunk_text: str) -> Dict[str, List[dict]]:
    """Extract entities + relationships from a single chunk.
    Falls back to heuristic extraction when the AI API is unavailable (rate-limited, etc.)
    """
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
        logger.warning(f"AI extraction failed, using heuristic fallback: {e}")
        return _heuristic_extract(chunk_text)
