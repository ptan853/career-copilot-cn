# Provider & Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provider adapter and ingestion layer so Vault parsing can use OpenAI, Alibaba Cloud Model Studio Qwen, Kimi, or a custom OpenAI-compatible endpoint.

**Architecture:** Keep source creation and Vault persistence in the existing routers and worker. Add focused backend services for provider configuration, provider generation, file/URL ingestion, and provider routing. The first version uses local ingestion and ordinary model generation only; hosted tools and agent loops remain out of scope.

**Tech Stack:** FastAPI, SQLModel, Pydantic, httpx, pytest, Next.js settings page, existing Vault worker.

## Global Constraints

- Do not implement AgentLoop in this plan.
- Do not implement hosted web search, hosted file search, code interpreter, or browser automation.
- Do not assume Alibaba Cloud Model Studio is equivalent to OpenAI Responses through the OpenAI-compatible endpoint.
- Do not make Kimi responsible for full cloud-agent runtime.
- Preserve the existing `normalize_source_parse` output contract and database tables.
- Unsupported capabilities must fail explicitly.
- Raw provider responses must be available for debugging without exposing user API keys.
- Use TDD for provider routing, ingestion, settings persistence, and worker behavior.

---

## File Structure

- Create `apps/api/services/llm_providers.py`: provider schemas, capabilities, endpoint normalization, provider classes, router.
- Create `apps/api/services/ingestion.py`: text/file/url ingestion facade.
- Modify `apps/api/config.py`: provider default base URLs and model names.
- Modify `apps/api/models/__init__.py`: add provider settings fields to `Profile`.
- Modify `apps/api/routers/vault.py`: accept provider settings in profile updates and never return full API keys.
- Modify `apps/api/routers/vault.py`: normalize structured profile links with display/parsing flags.
- Modify `apps/api/services/ai_worker.py`: replace hardcoded OpenAI call with provider router and ingestion.
- Modify `apps/api/services/file_reader.py`: keep existing fallback; optionally add MarkItDown as best-effort parser.
- Modify `apps/api/pyproject.toml`: add `markitdown` only if dependency install is acceptable.
- Modify `apps/web/app/settings/page.tsx`: provider selector, base URL, model name, API key.
- Modify `apps/web/lib/api-client.ts`: profile settings payload type if needed.
- Add tests under `apps/api/tests/`.

## Task 1: Provider Schemas and Endpoint Normalization

**Files:**
- Create: `apps/api/services/llm_providers.py`
- Test: `apps/api/tests/test_llm_providers.py`

**Interfaces:**
- Produces: `ProviderKind`, `ProviderCapabilities`, `ProviderConfig`, `LLMMessage`, `LLMGenerateRequest`, `LLMGenerateResult`, `normalize_chat_completions_url(base_url: str) -> str`
- Consumes: no previous task output

- [ ] **Step 1: Write failing endpoint tests**

```python
from services.llm_providers import normalize_chat_completions_url


def test_normalize_openai_base_url_adds_v1_chat_completions():
    assert normalize_chat_completions_url("https://api.openai.com") == "https://api.openai.com/v1/chat/completions"


def test_normalize_v1_base_url_adds_chat_completions_only_once():
    assert normalize_chat_completions_url("https://api.openai.com/v1") == "https://api.openai.com/v1/chat/completions"


def test_normalize_bailian_compatible_url_does_not_duplicate_v1():
    assert (
        normalize_chat_completions_url("https://dashscope.aliyuncs.com/compatible-mode/v1")
        == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    )


def test_normalize_full_chat_completions_url_is_unchanged():
    assert (
        normalize_chat_completions_url("https://example.com/custom/v1/chat/completions")
        == "https://example.com/custom/v1/chat/completions"
    )
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_llm_providers.py -q
```

Expected: import failure because `services.llm_providers` does not exist.

- [ ] **Step 3: Add schemas and URL normalization**

Implement `apps/api/services/llm_providers.py` with:

```python
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


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


def normalize_chat_completions_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1") or base.endswith("/compatible-mode/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"
```

- [ ] **Step 4: Run tests**

Expected: endpoint normalization tests pass.

## Task 2: OpenAI-Compatible Provider and Router

**Files:**
- Modify: `apps/api/services/llm_providers.py`
- Test: `apps/api/tests/test_llm_providers.py`

**Interfaces:**
- Consumes: `ProviderConfig`, `LLMGenerateRequest`, `LLMGenerateResult`
- Produces: `OpenAICompatibleProvider`, `ProviderRouter`, `ProviderError`

- [ ] **Step 1: Add failing provider request tests**

Add tests using `httpx.MockTransport`:

```python
import httpx

from services.llm_providers import (
    LLMGenerateRequest,
    LLMMessage,
    OpenAICompatibleProvider,
    ProviderConfig,
    ProviderKind,
    ProviderRouter,
)


def test_openai_compatible_provider_posts_json_mode_request():
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
            name="bailian",
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
    provider = object()
    router = ProviderRouter({"default": provider}, "default")
    assert router.get_provider() is provider
```

- [ ] **Step 2: Run tests and confirm failure**

Expected: missing provider classes.

- [ ] **Step 3: Implement provider and router**

Add:

```python
import json
import httpx


class ProviderError(RuntimeError):
    def __init__(self, provider: str, message: str, status_code: int | None = None):
        self.provider = provider
        self.status_code = status_code
        super().__init__(message)


class OpenAICompatibleProvider:
    def __init__(self, config: ProviderConfig, client: httpx.Client | None = None):
        self.config = config
        self.client = client or httpx.Client(timeout=120)

    def generate(self, request: LLMGenerateRequest) -> LLMGenerateResult:
        payload: dict[str, Any] = {
            "model": self.config.model_name,
            "messages": [message.model_dump() for message in request.messages],
            "temperature": request.temperature if request.temperature is not None else self.config.default_temperature,
        }
        if request.max_tokens or self.config.max_tokens:
            payload["max_tokens"] = request.max_tokens or self.config.max_tokens
        if request.response_format == "json" and self.config.capabilities.json_mode:
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
```

- [ ] **Step 4: Run tests**

Expected: provider and router tests pass.

## Task 3: Profile Provider Settings

**Files:**
- Modify: `apps/api/models/__init__.py`
- Modify: `apps/api/routers/vault.py`
- Test: `apps/api/tests/test_auth.py` or new `apps/api/tests/test_profile_provider_settings.py`

**Interfaces:**
- Consumes: existing `Profile`
- Produces: persisted provider settings and structured profile links without returning raw API key

- [ ] **Step 1: Add failing API test**

Create a test that patches `/api/vault/profile` with:

```json
{
  "ai_provider": "bailian_qwen",
  "ai_provider_name": "bailian-qwen-plus",
  "ai_api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "ai_model_name": "qwen-plus",
  "ai_api_key": "sk-test"
}
```

Expected GET `/api/vault/profile` response includes provider/base/model and `has_ai_api_key: true`, but does not include `ai_api_key`.

Add a second failing test for structured links:

```json
{
  "links": [
    {
      "label": "GitHub",
      "url": "https://github.com/ptan853",
      "link_type": "github_profile",
      "show_in_materials": true,
      "use_for_ai_parsing": true
    },
    "https://www.linkedin.com/in/PeifengTan"
  ]
}
```

Expected response normalizes links into objects. Missing flags default to `show_in_materials: true` and `use_for_ai_parsing: false`.

- [ ] **Step 2: Run test and confirm failure**

Expected: fields are ignored by `UpdateProfileBody`.

- [ ] **Step 3: Extend Profile model and router schema**

Add nullable fields to `Profile`:

```python
ai_provider_name: Optional[str] = None
ai_api_base: Optional[str] = None
ai_model_name: Optional[str] = None
```

Add to `UpdateProfileBody`:

```python
ai_provider: Optional[str] = None
ai_provider_name: Optional[str] = None
ai_api_base: Optional[str] = None
ai_model_name: Optional[str] = None
ai_api_key: Optional[str] = None
```

Update `serialize_profile()` to return provider/base/model and `has_ai_api_key`, never raw key.

Add `normalize_profile_links(links: list) -> list[dict]`:

```python
{
    "label": value.get("label") or infer_link_label(url),
    "url": normalized_url,
    "link_type": value.get("link_type") or infer_link_type(url),
    "show_in_materials": value.get("show_in_materials", True),
    "use_for_ai_parsing": value.get("use_for_ai_parsing", False),
    "parse_status": value.get("parse_status", "not_started"),
    "last_parse_error": value.get("last_parse_error"),
}
```

- [ ] **Step 4: Run profile settings tests**

Expected: provider settings persist and key is hidden.

## Task 4: Provider Config Resolution

**Files:**
- Modify: `apps/api/config.py`
- Modify: `apps/api/services/llm_providers.py`
- Test: `apps/api/tests/test_llm_providers.py`

**Interfaces:**
- Consumes: `Profile`, `settings`
- Produces: `resolve_provider_config(user_id, session) -> ProviderConfig`

- [ ] **Step 1: Add failing config tests**

Test priority:

```text
user profile key/base/model > provider platform key > provider env key > explicit missing-key error
```

Test default domestic provider:

```text
new user with no provider selection resolves to bailian_qwen if BAILIAN_API_KEY exists
otherwise falls back to OpenAI if OPENAI_API_KEY exists
```

- [ ] **Step 2: Add settings**

Add:

```python
bailian_api_key: str = ""
bailian_api_base: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
bailian_model: str = "qwen-plus"
kimi_api_key: str = ""
kimi_api_base: str = "https://api.moonshot.cn/v1"
kimi_model: str = "kimi-k2"
platform_bailian_api_key: str = ""
platform_kimi_api_key: str = ""
```

- [ ] **Step 3: Implement resolver**

Implement resolver in `llm_providers.py`. The resolver must map legacy `openai` profile values safely and must not log API keys.

- [ ] **Step 4: Run tests**

Expected: resolver tests pass.

## Task 5: Ingestion Service

**Files:**
- Create: `apps/api/services/ingestion.py`
- Modify: `apps/api/services/file_reader.py`
- Test: `apps/api/tests/test_ingestion.py`

**Interfaces:**
- Produces: `UserInput`, `IngestedDocument`, `ingest_text`, `ingest_file`, `ingest_url`
- Consumes: existing `extract_text`

- [ ] **Step 1: Add failing ingestion tests**

Cover:

```text
text input returns content unchanged
file input calls fallback extractor when MarkItDown is unavailable
url input fetches HTML and removes obvious tags
url fetch failure returns a clear exception
```

- [ ] **Step 2: Implement ingestion facade**

Implement local parsing:

```python
def ingest_text(text: str, title: str | None = None) -> IngestedDocument
def ingest_file(file_path: str, mime_type: str = "", title: str | None = None) -> IngestedDocument
def ingest_url(url: str) -> IngestedDocument
```

For MarkItDown, import lazily:

```python
try:
    from markitdown import MarkItDown
except Exception:
    MarkItDown = None
```

If unavailable or empty, use `extract_text`.

- [ ] **Step 3: Run ingestion tests**

Expected: tests pass without requiring network access by mocking `httpx.Client.get`.

## Task 6: Vault Worker Provider Integration

**Files:**
- Modify: `apps/api/services/ai_worker.py`
- Test: `apps/api/tests/test_ai_worker.py`

**Interfaces:**
- Consumes: `resolve_provider_config`, `ProviderRouter`, `OpenAICompatibleProvider`, `LLMGenerateRequest`, ingestion service
- Produces: worker no longer calls hardcoded `_call_ai(api_base, api_key, ...)`

- [ ] **Step 1: Add failing worker test**

Update worker test to monkeypatch provider generation instead of `_call_ai`. Assert:

```text
provider config model is written to source.metadata_json["parse_model"]
provider name is written to source.metadata_json["parse_provider"]
source.parse_status becomes "failed" and parse_error is set if provider raises ProviderError
```

- [ ] **Step 2: Refactor worker call path**

Replace:

```python
api_key, provider = _resolve_api_key(...)
api_base = _resolve_api_base(provider)
parsed = _call_ai(api_base, api_key, source_parse_system_prompt(), text)
```

With:

```python
config = resolve_provider_config(job.user_id, session)
provider = OpenAICompatibleProvider(config)
result = provider.generate(
    LLMGenerateRequest(
        response_format="json",
        messages=[
            LLMMessage(role="system", content=source_parse_system_prompt()),
            LLMMessage(role="user", content=text[:15000]),
        ],
    )
)
parsed = result.json_data or json.loads(result.text)
```

- [ ] **Step 3: Standardize failure state**

When provider or ingestion fails:

```text
job.status = "failed"
source.parse_status = "failed"
source.parse_error = concise error message
```

- [ ] **Step 4: Run worker tests**

Expected: existing event/claim/evidence persistence still passes.

## Task 7: Frontend Settings Page

**Files:**
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/lib/api-client.ts`

**Interfaces:**
- Consumes: profile API fields from Task 3
- Produces: user can choose OpenAI, 百炼 Qwen, Kimi, or custom OpenAI-compatible

- [ ] **Step 1: Update settings form state**

Add fields:

```ts
ai_provider
ai_provider_name
ai_api_base
ai_model_name
ai_api_key
has_ai_api_key
```

- [ ] **Step 2: Add provider presets**

Use:

```ts
const providerPresets = {
  bailian_qwen: {
    label: '阿里云百炼 / 通义千问（国内推荐）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-plus',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    modelName: 'gpt-4.1-mini',
  },
  kimi: {
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelName: 'kimi-k2',
  },
  custom_openai_compatible: {
    label: '自定义 OpenAI 兼容接口',
    baseUrl: '',
    modelName: '',
  },
}
```

- [ ] **Step 3: Save settings**

Patch `/api/vault/profile` with provider fields. Keep the password-style key input blank after successful save.

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: no type errors.

## Task 8: End-to-End Verification

**Files:**
- Modify tests as needed only.

**Interfaces:**
- Consumes all prior tasks
- Produces verified MVP behavior

- [ ] **Step 1: Run backend targeted tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_llm_providers.py tests/test_ingestion.py tests/test_ai_worker.py tests/test_vault_events.py tests/test_auth.py -q
```

Expected: all pass.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Manual smoke test**

With backend and frontend running:

```text
1. Log in.
2. Open Settings.
3. Select 阿里云百炼 / 通义千问.
4. Save base URL, model, and API key.
5. Open Vault.
6. Submit a text source.
7. Confirm source transitions to parsed or a clear provider error.
```

- [ ] **Step 4: Final git diff review**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; changed files match plan scope.
