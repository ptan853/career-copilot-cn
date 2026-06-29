"""Career Copilot API — AI Provider 抽象层"""
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def generate_text(self, prompt: str, system: str = "", model: str | None = None) -> str:
        pass

    @abstractmethod
    def generate_json(self, prompt: str, schema: dict, system: str = "", model: str | None = None) -> dict:
        pass

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        pass
