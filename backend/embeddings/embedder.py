"""
Embedding layer. Uses real Gemini embeddings.
Raises exceptions if the API fails, ensuring strictly AI-driven responses.
"""
import logging
from typing import List
import numpy as np

from llm.gemini_client import embed_text

logger = logging.getLogger("nova.embeddings")


async def get_embedding(text: str) -> List[float]:
    try:
        return await embed_text(text)
    except Exception as e:
        logger.error(f"AI API Embedding Failed: {e}")
        raise RuntimeError(f"AI Embedding Failed: {e}")


def cosine_similarity(a: List[float], b: List[float]) -> float:
    va, vb = np.array(a), np.array(b)
    if va.shape[0] != vb.shape[0]:
        # dimension mismatch (mixed gemini/fallback vectors) -> treat as unrelated
        return 0.0
    denom = (np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)
