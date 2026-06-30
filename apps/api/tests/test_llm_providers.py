import json

import httpx
import pytest
from sqlmodel import Session, SQLModel, create_engine

from models import Profile, User


@pytest.fixture
def session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'providers.db'}", echo=False)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_normalize_openai_base_url_adds_v1_chat_completions():
    from services.llm_providers import normalize_chat_completions_url

    assert normalize_chat_completions_url("https://api.openai.com") == "https://api.openai.com/v1/chat/completions"


def test_normalize_v1_base_url_adds_chat_completions_only_once():
    from services.llm_providers import normalize_chat_completions_url

    assert normalize_chat_completions_url("https://api.openai.com/v1") == "https://api.openai.com/v1/chat/completions"


def test_normalize_bailian_compatible_url_does_not_duplicate_v1():
    from services.llm_providers import normalize_chat_completions_url

    assert (
        normalize_chat_completions_url("https://dashscope.aliyuncs.com/compatible-mode/v1")
        == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    )


def test_normalize_full_chat_completions_url_is_unchanged():
    from services.llm_providers import normalize_chat_completions_url

    assert (
        normalize_chat_completions_url("https://example.com/custom/v1/chat/completions")
        == "https://example.com/custom/v1/chat/completions"
    )


def test_openai_compatible_provider_posts_json_mode_request():
    from services.llm_providers import (
        LLMGenerateRequest,
        LLMMessage,
        OpenAICompatibleProvider,
        ProviderConfig,
        ProviderKind,
    )

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["json"] = json.loads(request.content.decode())
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "{\"ok\": true}"}}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleProvider(
        ProviderConfig(
            kind=ProviderKind.BAILIAN_QWEN,
            name="bailian-qwen-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key="sk-test",
            model_name="qwen-plus",
        ),
        client=client,
    )

    result = provider.generate(
        LLMGenerateRequest(
            response_format="json",
            messages=[LLMMessage(role="user", content="return json")],
        )
    )

    assert captured["url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    assert captured["auth"] == "Bearer sk-test"
    assert captured["json"]["model"] == "qwen-plus"
    assert captured["json"]["response_format"] == {"type": "json_object"}
    assert result.json_data == {"ok": True}
    assert result.usage["total_tokens"] == 3


def test_provider_router_returns_named_provider():
    from services.llm_providers import ProviderError, ProviderRouter

    default_provider = object()
    other_provider = object()
    router = ProviderRouter({"default": default_provider, "other": other_provider}, "default")

    assert router.get_provider() is default_provider
    assert router.get_provider("other") is other_provider

    with pytest.raises(ProviderError):
        router.get_provider("missing")


def test_resolve_provider_config_prefers_profile_settings(session, monkeypatch):
    from services.llm_providers import ProviderKind, resolve_provider_config

    user = User(display_name="Provider User", email="provider@example.com")
    session.add(user)
    session.flush()

    profile = Profile(
        user_id=user.id,
        ai_provider="bailian_qwen",
        ai_provider_name="my-qwen",
        ai_api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
        ai_model_name="qwen-plus",
        ai_api_key="sk-user",
    )
    session.add(profile)
    session.commit()

    config = resolve_provider_config(user.id, session)

    assert config.kind == ProviderKind.BAILIAN_QWEN
    assert config.name == "my-qwen"
    assert config.base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert config.model_name == "qwen-plus"
    assert config.api_key == "sk-user"


def test_resolve_provider_config_defaults_to_bailian_when_platform_key_exists(session, monkeypatch):
    from services.llm_providers import ProviderKind, resolve_provider_config

    from config import settings

    monkeypatch.setattr(settings, "platform_bailian_api_key", "sk-bailian-platform", raising=False)
    monkeypatch.setattr(settings, "platform_openai_api_key", "", raising=False)
    monkeypatch.setattr(settings, "openai_api_key", "", raising=False)

    user = User(display_name="Default User", email="default-provider@example.com")
    session.add(user)
    session.commit()

    config = resolve_provider_config(user.id, session)

    assert config.kind == ProviderKind.BAILIAN_QWEN
    assert config.api_key == "sk-bailian-platform"
    assert config.model_name == "qwen-plus"
