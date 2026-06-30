"""LLM provider adapters for Career Copilot.

First version targets OpenAI-compatible chat completions providers. Hosted
agent tools are deliberately outside this module for now.
"""

import json
import uuid
from enum import Enum
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from config import settings
from models import Profile


class ProviderKind(str, Enum):
    OPENAI = "openai"
    BAILIAN_QWEN = "bailian_qwen"
    KIMI = "kimi"
    CUSTOM_OPENAI_COMPATIBLE = "custom_openai_compatible"


class ProviderCapabilities(BaseModel):
    text: bool = True
    image_input: bool = False
    file_upload: bool = False
    file_extract: bool = False
    web_search: bool = False
    web_extract: bool = False
    code_interpreter: bool = False
    function_calling: bool = False
    hosted_tools: bool = False
    streaming: bool = False
    json_mode: bool = True


class ProviderConfig(BaseModel):
    kind: ProviderKind
    name: str
    base_url: str
    api_key: str
    model_name: str
    default_temperature: float = 0.3
    max_tokens: int | None = None
    capabilities: ProviderCapabilities = Field(default_factory=ProviderCapabilities)


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMGenerateRequest(BaseModel):
    messages: list[LLMMessage]
    response_format: Literal["text", "json"] = "text"
    temperature: float | None = None
    max_tokens: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class LLMGenerateResult(BaseModel):
    text: str
    provider: str
    model: str
    json_data: dict[str, Any] | None = None
    raw: dict[str, Any] | None = None
    usage: dict[str, Any] | None = None


class ProviderError(RuntimeError):
    def __init__(self, provider: str, message: str, status_code: int | None = None):
        self.provider = provider
        self.status_code = status_code
        super().__init__(message)


def normalize_chat_completions_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1") or base.endswith("/compatible-mode/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


class OpenAICompatibleProvider:
    def __init__(self, config: ProviderConfig, client: httpx.Client | None = None):
        self.config = config
        self.client = client or httpx.Client(timeout=120)

    def generate(self, request: LLMGenerateRequest) -> LLMGenerateResult:
        payload: dict[str, Any] = {
            "model": self.config.model_name,
            "messages": [message.model_dump() for message in request.messages],
            "temperature": request.temperature
            if request.temperature is not None
            else self.config.default_temperature,
        }
        max_tokens = request.max_tokens or self.config.max_tokens
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if request.response_format == "json":
            if not self.config.capabilities.json_mode:
                raise ProviderError(self.config.name, "当前 provider 不支持 JSON mode")
            payload["response_format"] = {"type": "json_object"}

        response = self.client.post(
            normalize_chat_completions_url(self.config.base_url),
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise ProviderError(self.config.name, response.text[:1000], response.status_code)

        body = response.json()
        text = body["choices"][0]["message"]["content"]
        json_data = None
        if request.response_format == "json":
            json_data = json.loads(text)
        return LLMGenerateResult(
            text=text,
            json_data=json_data,
            provider=self.config.name,
            model=self.config.model_name,
            raw=body,
            usage=body.get("usage"),
        )


class ProviderRouter:
    def __init__(self, providers: dict[str, OpenAICompatibleProvider], default_provider_name: str):
        self.providers = providers
        self.default_provider_name = default_provider_name

    def get_provider(self, name: str | None = None) -> OpenAICompatibleProvider:
        provider_name = name or self.default_provider_name
        provider = self.providers.get(provider_name)
        if not provider:
            raise ProviderError(provider_name, f"Unknown provider: {provider_name}")
        return provider

    def generate(self, request: LLMGenerateRequest, provider_name: str | None = None) -> LLMGenerateResult:
        return self.get_provider(provider_name).generate(request)


def _provider_kind(value: str | None) -> ProviderKind:
    if value in {kind.value for kind in ProviderKind}:
        return ProviderKind(value)
    if value == "qwen":
        return ProviderKind.BAILIAN_QWEN
    return ProviderKind.OPENAI


def _profile_for_user(user_id: uuid.UUID | str, session: Session) -> Profile | None:
    user_uuid = uuid.UUID(str(user_id))
    return session.exec(select(Profile).where(Profile.user_id == user_uuid)).first()


def resolve_provider_config(user_id: uuid.UUID | str, session: Session) -> ProviderConfig:
    profile = _profile_for_user(user_id, session)

    if profile and profile.ai_api_key:
        kind = _provider_kind(profile.ai_provider)
        return ProviderConfig(
            kind=kind,
            name=profile.ai_provider_name or kind.value,
            base_url=profile.ai_api_base or _default_base_url(kind),
            api_key=profile.ai_api_key,
            model_name=profile.ai_model_name or _default_model(kind),
            capabilities=_default_capabilities(kind),
        )

    if settings.platform_bailian_api_key or settings.bailian_api_key or settings.qwen_api_key:
        return ProviderConfig(
            kind=ProviderKind.BAILIAN_QWEN,
            name="bailian-qwen-plus",
            base_url=settings.bailian_api_base or settings.qwen_api_base,
            api_key=settings.platform_bailian_api_key or settings.bailian_api_key or settings.qwen_api_key,
            model_name=settings.bailian_model,
            capabilities=_default_capabilities(ProviderKind.BAILIAN_QWEN),
        )

    if settings.platform_openai_api_key or settings.openai_api_key:
        return ProviderConfig(
            kind=ProviderKind.OPENAI,
            name="openai",
            base_url=settings.openai_api_base,
            api_key=settings.platform_openai_api_key or settings.openai_api_key,
            model_name=settings.openai_model,
            capabilities=_default_capabilities(ProviderKind.OPENAI),
        )

    if settings.platform_kimi_api_key or settings.kimi_api_key:
        return ProviderConfig(
            kind=ProviderKind.KIMI,
            name="kimi",
            base_url=settings.kimi_api_base,
            api_key=settings.platform_kimi_api_key or settings.kimi_api_key,
            model_name=settings.kimi_model,
            capabilities=_default_capabilities(ProviderKind.KIMI),
        )

    raise ProviderError("provider", "未配置可用的模型服务 API Key")


def _default_base_url(kind: ProviderKind) -> str:
    if kind == ProviderKind.BAILIAN_QWEN:
        return settings.bailian_api_base or settings.qwen_api_base
    if kind == ProviderKind.KIMI:
        return settings.kimi_api_base
    return settings.openai_api_base


def _default_model(kind: ProviderKind) -> str:
    if kind == ProviderKind.BAILIAN_QWEN:
        return settings.bailian_model
    if kind == ProviderKind.KIMI:
        return settings.kimi_model
    return settings.openai_model


def _default_capabilities(kind: ProviderKind) -> ProviderCapabilities:
    if kind == ProviderKind.BAILIAN_QWEN:
        return ProviderCapabilities(image_input=False, function_calling=True)
    if kind == ProviderKind.KIMI:
        return ProviderCapabilities(json_mode=False)
    return ProviderCapabilities(image_input=True, function_calling=True)
