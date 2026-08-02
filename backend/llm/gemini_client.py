"""
Thin wrapper around the Gemini REST API (generateContent / embedContent).
No SDK dependency — plain httpx calls so the backend stays lightweight and
easy to audit. All calls are synchronous-safe via httpx.AsyncClient.
"""
import json
import re
from typing import List, Optional

import httpx

from config import get_settings

settings = get_settings()


class GeminiError(Exception):
    pass


async def generate_content(prompt: str, system_instruction: Optional[str] = None,
                            json_mode: bool = False, temperature: float = 0.2, api_key: Optional[str] = None) -> str:
    key_to_use = api_key or settings.GEMINI_API_KEY
    if not key_to_use:
        raise GeminiError("GEMINI_API_KEY not configured and no api_key provided")

    url = f"{settings.GEMINI_BASE_URL}/models/{settings.GEMINI_MODEL}:generateContent?key={key_to_use}"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 2048},
    }
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise GeminiError(f"Unexpected Gemini response shape: {data}") from e


async def embed_text(text: str) -> List[float]:
    if not settings.ai_enabled:
        raise GeminiError("GEMINI_API_KEY not configured")

    url = f"{settings.GEMINI_BASE_URL}/models/{settings.GEMINI_EMBED_MODEL}:embedContent?key={settings.GEMINI_API_KEY}"
    body = {"content": {"parts": [{"text": text}]}}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()
        return data["embedding"]["values"]


def extract_json(raw: str) -> dict:
    """Gemini sometimes wraps JSON in markdown fences or adds conversational text."""
    try:
        # First try parsing it directly
        return json.loads(raw)
    except Exception:
        pass
    
    # Extract just the JSON part
    match = re.search(r'(\{.*\}|\[.*\])', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
            
    # Fallback to the old strip method
    cleaned = raw.strip()
    cleaned = re.sub(r"^```json\s*|^```\s*|```$", "", cleaned, flags=re.MULTILINE).strip()
    return json.loads(cleaned)
