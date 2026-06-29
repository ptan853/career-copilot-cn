"""DeepSeek LLM Provider"""
from openai import OpenAI

from config import settings
from ai import LLMProvider


class DeepSeekProvider(LLMProvider):
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_api_base,
        )
        self.default_model = "deepseek-chat"

    def generate_text(self, prompt: str, system: str = "", model: str | None = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = self.client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
        )
        return resp.choices[0].message.content or ""

    def generate_json(self, prompt: str, schema: dict, system: str = "", model: str | None = None) -> dict:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = self.client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        import json
        return json.loads(resp.choices[0].message.content or "{}")

    def embed(self, text: str) -> list[float]:
        resp = self.client.embeddings.create(
            model="deepseek-embedding",
            input=text,
        )
        return resp.data[0].embedding
