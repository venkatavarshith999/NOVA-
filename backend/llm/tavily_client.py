import logging
import httpx
from typing import List, Dict

from config import get_settings

logger = logging.getLogger("nova.llm.tavily")
settings = get_settings()

class TavilyError(Exception):
    pass

async def search_web(query: str, max_results: int = 3) -> List[Dict[str, str]]:
    if not settings.TAVILY_API_KEY:
        raise TavilyError("TAVILY_API_KEY not configured")

    url = "https://api.tavily.com/search"
    body = {
        "api_key": settings.TAVILY_API_KEY,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            return [{"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("content", "")} for r in results]
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return []
