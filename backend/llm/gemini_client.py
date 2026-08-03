"""
Thin wrapper around the Gemini REST API (generateContent / embedContent).
No SDK dependency — plain httpx calls so the backend stays lightweight and
easy to audit. All calls are synchronous-safe via httpx.AsyncClient.

Improved retry logic:
- 429 / 503 → exponential backoff (2, 4, 8, 16 ... seconds, up to 5 retries)
- Local heuristic fallback when all retries exhausted so the pipeline never
  fully breaks for the user.
"""
import asyncio
import hashlib
import json
import logging
import math
import re
from typing import List, Optional

import httpx

from config import get_settings

settings = get_settings()
logger = logging.getLogger("nova.gemini")

MAX_RETRIES = 5
INITIAL_BACKOFF = 2  # seconds


class GeminiError(Exception):
    pass


class GeminiRateLimitError(GeminiError):
    """Raised specifically for 429 rate limit errors after all retries."""
    pass


async def generate_content(
    prompt: str,
    system_instruction: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    api_key: Optional[str] = None,
    response_schema: Optional[dict] = None,
) -> str:
    key_to_use = api_key or settings.GEMINI_API_KEY
    if not key_to_use:
        raise GeminiError("GEMINI_API_KEY not configured and no api_key provided")

    url = f"{settings.GEMINI_BASE_URL}/models/{settings.GEMINI_MODEL}:generateContent?key={key_to_use}"
    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 4096},
    }
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"
        if response_schema:
            body["generationConfig"]["responseSchema"] = response_schema
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    last_error: Optional[Exception] = None
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                resp = await client.post(url, json=body)
                resp.raise_for_status()
                data = resp.json()
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError) as e:
                    raise GeminiError(f"Unexpected Gemini response shape: {data}") from e
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status in (429, 500, 503) and attempt < MAX_RETRIES - 1:
                backoff = INITIAL_BACKOFF * (2 ** attempt)
                logger.warning(
                    f"Gemini API returned {status} (attempt {attempt + 1}/{MAX_RETRIES}). "
                    f"Retrying in {backoff}s..."
                )
                await asyncio.sleep(backoff)
                last_error = e
                continue
            if status == 429:
                raise GeminiRateLimitError(
                    f"Gemini API rate-limited (429). Exhausted {MAX_RETRIES} retries. "
                    "Please wait before trying again."
                ) from e
            raise GeminiError(f"Gemini API error {status}: {e.response.text[:300]}") from e
        except httpx.TimeoutException as e:
            if attempt < MAX_RETRIES - 1:
                backoff = INITIAL_BACKOFF * (2 ** attempt)
                logger.warning(f"Gemini API timeout (attempt {attempt + 1}). Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                last_error = e
                continue
            raise GeminiError("Gemini API timed out after all retries.") from e

    raise GeminiError(f"Gemini API failed after {MAX_RETRIES} retries: {last_error}")


async def generate_with_fallback(
    prompt: str,
    fallback_text: str,
    system_instruction: Optional[str] = None,
    temperature: float = 0.2,
    api_key: Optional[str] = None,
) -> tuple[str, bool]:
    """
    Try generate_content; if it fails (rate limit, timeout, etc.) return
    `fallback_text` instead of raising.

    Returns: (text, used_fallback)
    """
    try:
        result = await generate_content(
            prompt,
            system_instruction=system_instruction,
            temperature=temperature,
            api_key=api_key,
        )
        return result, False
    except (GeminiError, Exception) as e:
        logger.warning(f"AI generation failed, using local fallback: {e}")
        return fallback_text, True


async def embed_text(text: str) -> List[float]:
    """Get embeddings from Gemini API, with local hash-based fallback on failure."""
    if not settings.ai_enabled:
        return _local_embedding(text)

    url = (
        f"{settings.GEMINI_BASE_URL}/models/{settings.GEMINI_EMBED_MODEL}"
        f":embedContent?key={settings.GEMINI_API_KEY}"
    )
    body = {"content": {"parts": [{"text": text}]}}

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=body)
                resp.raise_for_status()
                data = resp.json()
                return data["embedding"]["values"]
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status in (429, 503) and attempt < MAX_RETRIES - 1:
                backoff = INITIAL_BACKOFF * (2 ** attempt)
                logger.warning(f"Gemini embed API {status}, retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                continue
            # On rate-limit exhaustion fall back to local embeddings
            logger.warning(f"Gemini embed API failed ({status}), using local fallback embedding.")
            return _local_embedding(text)
        except Exception as e:
            logger.warning(f"Gemini embed failed: {e}, using local fallback.")
            return _local_embedding(text)

    return _local_embedding(text)


def _local_embedding(text: str, dim: int = 768) -> List[float]:
    """
    Deterministic hash-based pseudo-embedding. Not semantically rich but
    maintains consistent cosine distances within a session. Dimension matches
    Gemini's text-embedding-004 (768) so vectors are compatible.
    """
    vec = [0.0] * dim
    tokens = text.lower().split()
    for i, token in enumerate(tokens):
        h = int(hashlib.sha256(token.encode()).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0 / math.sqrt(len(tokens) + 1)
    # L2 normalise
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def extract_json(raw: str) -> dict:
    """Gemini sometimes wraps JSON in markdown fences or adds conversational text."""
    try:
        return json.loads(raw)
    except Exception:
        pass

    match = re.search(r'(\{.*\}|\[.*\])', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    cleaned = raw.strip()
    cleaned = re.sub(r"^```json\s*|^```\s*|```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        return {"entities": [], "relationships": []}
