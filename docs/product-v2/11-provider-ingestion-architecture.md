# Career Copilot Provider & Ingestion Architecture v2

## 1. Design Principle

The first version must not attempt a broad cloud-agent platform. The immediate product goal is to make the Career Vault data production loop reliable:

```text
User uploads files / enters text / enters URLs
-> local ingestion converts materials into markdown/text
-> user-selected provider runs extraction
-> LLM returns section / event / claim / evidence JSON
-> Vault displays editable career events
```

The first version does not depend on hosted tools, and it does not assume OpenAI, Alibaba Cloud Model Studio, and Kimi expose equivalent tool capabilities through the same API shape.

## 2. Architecture

```text
Career Copilot business layer
  - Vault parsing
  - resume / file parsing
  - URL material parsing
  - career event / claim / evidence generation

Agent orchestration layer
  - ProviderRouter
  - capability-aware provider selection
  - standardized provider errors
  - raw response capture for debugging

Provider adapters
  - OpenAICompatibleProvider
  - BailianQwenProvider
  - KimiProvider
  - CustomOpenAICompatibleProvider

Local ingestion tools
  - MarkItDownFileParser
  - WebFetcher
  - existing PyMuPDF / python-docx fallback
```

Second-stage modules are explicitly out of MVP scope: AgentLoop, hosted web search, hosted file search, code interpreter, browser automation, GitHub deep reading, MCP, and long-running schedulers.

## 3. Provider Positioning

### OpenAI

OpenAI is the reference for hosted agent capabilities, but the first version only uses model generation.

MVP capabilities:

- OpenAI-compatible chat or responses-style generation through a single adapter boundary.
- Configurable `base_url`, `api_key`, and `model_name`.
- JSON output support where available.
- Raw response capture.

Later:

- Responses API hosted tools.
- Web search.
- File search.
- Code interpreter.
- Tool traces.

### Alibaba Cloud Model Studio / Qwen

Bailian/Qwen is the default provider for China-facing users.

MVP capabilities:

- OpenAI-compatible Chat Completions.
- Qwen text model calling.
- Configurable `base_url`, `api_key`, and `model_name`.
- JSON output where supported.

MVP must not assume Bailian provides OpenAI Responses parity through the same OpenAI-compatible endpoint. Bailian agent apps, hosted web extraction, hosted code interpreter, and hosted file search are second-stage integrations.

Provider naming:

```text
bailian_qwen
  Domestic default provider using OpenAI-compatible Qwen chat.

bailian_agent_app
  Future provider for Bailian agent application APIs.

local_tools + qwen
  Local ingestion and tool execution, Qwen reasoning.
```

### Kimi / Moonshot

Kimi is not the first-version hosted agent runtime. It is positioned as a long-context and Chinese document analysis provider.

MVP capabilities:

- OpenAI-compatible chat.
- Configurable `base_url`, `api_key`, and `model_name`.

Later:

- File upload.
- File content extraction.
- Kimi web search.
- Long document cache.

### Custom OpenAI-Compatible

This provider supports users who bring their own model gateway:

- DeepSeek
- Qwen-compatible endpoints
- OneAPI / LiteLLM / New API
- local OpenAI-compatible servers
- company-internal gateways

The MVP must allow manual configuration of `provider_name`, `base_url`, `api_key`, and `model_name`.

## 4. MVP Scope

The first version implements:

1. Provider schema and provider settings.
2. OpenAI-compatible provider adapter.
3. Bailian/Qwen adapter as the domestic default.
4. Kimi chat adapter.
5. Custom OpenAI-compatible adapter.
6. User-configurable provider, base URL, API key, and model name.
7. Vault worker calling through ProviderRouter.
8. MarkItDown local file parsing, with the existing file reader as fallback.
9. Local WebFetcher for URLs.
10. Unified JSON output parsed by the existing source parse normalizer.

The first version does not implement:

1. AgentLoop.
2. Hosted web search.
3. Hosted file search.
4. Code interpreter.
5. Bailian agent application API.
6. Kimi file extraction.
7. Browser automation.
8. GitHub deep repository parsing.
9. Scheduler or recurring agent tasks.

## 5. Current Code Alignment

Current implementation has the right database concepts but the provider boundary is still hardcoded:

- `apps/api/services/ai_worker.py` directly builds `f"{api_base}/v1/chat/completions"`.
- `apps/api/config.py` already contains OpenAI, DeepSeek, and Qwen settings, but model and endpoint resolution are not centralized.
- `apps/api/routers/vault.py` returns `ai_provider` and `has_ai_api_key`, but profile updates currently do not accept provider settings.
- `apps/web/app/settings/page.tsx` shows an AI settings area, but it is locked to OpenAI.
- `apps/api/services/file_reader.py` extracts PDF/DOCX/TXT, but it should become fallback behind MarkItDown.
- `apps/api/routers/vault_sources.py` creates source parse jobs for text, URLs, and file uploads; this should remain the business entrypoint.

## 6. Backend Schema

Use Python/Pydantic for backend provider contracts:

```python
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
    capabilities: ProviderCapabilities = ProviderCapabilities()
```

Generation request:

```python
class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMGenerateRequest(BaseModel):
    messages: list[LLMMessage]
    response_format: Literal["text", "json"] = "text"
    temperature: float | None = None
    max_tokens: int | None = None
    metadata: dict[str, Any] = {}


class LLMGenerateResult(BaseModel):
    text: str
    json_data: dict[str, Any] | None = None
    provider: str
    model: str
    raw: dict[str, Any] | None = None
    usage: dict[str, Any] | None = None
```

## 7. Ingestion Contract

```python
class UserInput(BaseModel):
    kind: Literal["text", "file", "url"]
    text: str | None = None
    file_path: str | None = None
    url: str | None = None
    metadata: dict[str, Any] = {}


class IngestedDocument(BaseModel):
    source_type: Literal["text", "file", "url"]
    title: str | None = None
    content: str
    content_type: Literal["markdown", "text"]
    source_url: str | None = None
    file_path: str | None = None
    metadata: dict[str, Any] = {}
    warnings: list[str] = []
```

File ingestion:

```text
MarkItDown
-> existing PyMuPDF / python-docx / TXT reader fallback
-> clear warning if extraction is empty
```

URL ingestion:

```text
httpx fetch
-> HTML cleanup / markdown conversion
-> explicit failure if fetch or extraction fails
```

## 8. Profile Links Contract

Links belong to the user profile first. A link can be used for display, parsing, or both.

```json
{
  "label": "GitHub",
  "url": "https://github.com/ptan853",
  "link_type": "github_profile",
  "show_in_materials": true,
  "use_for_ai_parsing": true,
  "parse_status": "not_started",
  "last_parse_error": null
}
```

Default behavior:

- `show_in_materials` defaults to `true`.
- `use_for_ai_parsing` defaults to `false`.
- LinkedIn profile links are display links by default.
- GitHub, portfolio, blog, and public article links can be suggested for parsing.
- A link is only converted into `SourceMaterial` when the user explicitly chooses parsing.
- Parsing failures must be visible; they must not silently remove or mutate the original profile link.

## 9. Vault Worker Target Flow

```text
BackgroundJob(source_parse)
-> load SourceMaterial
-> build ingested document from source raw text, file path, and URLs
-> resolve user provider config
-> ProviderRouter.generate(...)
-> normalize_source_parse(...)
-> persist CareerEvent / Claim / Evidence
-> store provider metadata and raw trace summary
```

The worker must not know provider-specific endpoint rules.

## 10. Success Criteria

MVP is complete when:

- A user can choose OpenAI, Bailian Qwen, Kimi, or a custom OpenAI-compatible provider.
- A user can save provider base URL, API key, and model name.
- Text, file, and URL sources produce ingested markdown/text.
- Profile links support `show_in_materials` and `use_for_ai_parsing`.
- Vault source parsing calls the selected provider through a common adapter.
- The existing section/event/claim/evidence schema is preserved.
- Unsupported provider capabilities produce explicit errors.
- Provider errors are standardized and visible in background job/source status.
- Tests cover text, file, and URL ingestion plus provider routing.
