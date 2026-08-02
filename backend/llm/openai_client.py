import json
from typing import Optional
import httpx
import logging

logger = logging.getLogger("nova.llm.openai")

class OpenAIError(Exception):
    pass

async def generate_content(prompt: str, api_key: str, system_instruction: Optional[str] = None,
                           temperature: float = 0.2) -> str:
    if not api_key:
        raise OpenAIError("OpenAI API key not provided")

    url = "https://api.openai.com/v1/chat/completions"
    
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    body = {
        "model": "gpt-4o",  # we use gpt-4o as default
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 2048,
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=body, headers=headers)
        if resp.status_code != 200:
            logger.error(f"OpenAI error: {resp.text}")
            raise OpenAIError(f"OpenAI API returned status {resp.status_code}: {resp.text}")
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise OpenAIError(f"Unexpected OpenAI response shape: {data}") from e
