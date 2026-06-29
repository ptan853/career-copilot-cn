# Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Product V2 authentication first: phone/email verification code auth, email/password auth, Google OAuth entry points, persistent current-user state, protected routes, and user-scoped private API behavior.

**Architecture:** Keep FastAPI as the auth authority and Next.js as the client. Use JWT bearer tokens for this milestone because the existing backend already issues JWT and the frontend already stores `localStorage.token`; harden that path first, then migrate to httpOnly cookies later if needed. Verification codes, password hashing, tokens, and Google OAuth are separate backend services so the auth router stays small and testable.

**Tech Stack:** FastAPI, SQLModel, python-jose, passlib[bcrypt], httpx, Next.js App Router, React, localStorage bearer token for this milestone.

## Global Constraints

- Implement Auth before Vault/Job/Generate feature work.
- Support phone verification code login/signup.
- Support email verification code login/signup.
- Support email/password login/signup.
- Provide Google OAuth start/callback endpoints.
- Google OAuth must not block phone/email auth when Google env vars are missing.
- Store password hashes only; never store plaintext passwords.
- Store verification code hashes only; never store plaintext codes.
- Production responses must never include verification codes.
- Development may echo verification codes only when `AUTH_DEV_CODE_ECHO=true`.
- Disable no-token dev fallback unless `AUTH_ALLOW_DEV_FALLBACK=true`.
- All private APIs must use `current_user.id` for create/list/detail/update/delete.
- Every task must end with `uv run python -m compileall .` or `npm run build`, plus targeted tests where available.

---

## Source Specs

Read these before implementing:

- `docs/product-v2/feature-specs/01-auth-foundation.md`
- `docs/product-v2/10-product-readiness-plan.md`
- `apps/api/routers/auth.py`
- `apps/api/auth_deps.py`
- `apps/api/models/__init__.py`
- `apps/web/lib/api-client.ts`

## Current Baseline

Existing backend auth has:

- `POST /api/auth/phone/request-code`
- `POST /api/auth/phone/login`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Known issues to fix:

- Phone code is fixed as `123456` and stored in memory as plaintext.
- Email signup/login does not verify password.
- `AuthIdentity.password_hash` exists but is not used correctly.
- `get_current_user_id` silently falls back to the first user when no token exists.
- Frontend has no `/login` or `/signup` page.
- Private routes are not protected.
- Google OAuth is absent.
- `api-client.ts` has auth helpers but not the unified code-auth contract from the spec.

## File Structure

Backend files:

- Modify `apps/api/models/__init__.py`: add `VerificationChallenge`, confirm `User` and `AuthIdentity` fields.
- Modify `apps/api/config.py`: add auth feature flags and Google OAuth settings.
- Modify `apps/api/auth_deps.py`: remove unconditional fallback and return a real current user helper.
- Replace `apps/api/routers/auth.py`: route layer for code auth, email/password, Google, `/me`, logout.
- Create `apps/api/services/passwords.py`: password hash and verify helpers.
- Create `apps/api/services/tokens.py`: JWT create/decode helpers.
- Create `apps/api/services/verification_codes.py`: code generation, hashing, verification, expiry, attempts.
- Create `apps/api/services/message_delivery.py`: dev sender for SMS/email code delivery.
- Create `apps/api/services/google_oauth.py`: Google OAuth URL, token exchange, userinfo parsing.
- Create `apps/api/tests/test_auth.py`: backend contract tests.

Frontend files:

- Create `apps/web/lib/auth.ts`: typed auth client and token helpers.
- Modify `apps/web/lib/api-client.ts`: centralize auth header, clear token on `401`, expose auth helpers from `auth.ts`.
- Create `apps/web/app/login/page.tsx`: method tabs for phone, email code, password, Google.
- Create `apps/web/app/signup/page.tsx`: method tabs for phone, email code, password, Google.
- Create `apps/web/components/auth/auth-gate.tsx`: client-side protected route guard.
- Modify `apps/web/app/layout.tsx`: wrap private route content if using component guard.
- Modify `apps/web/components/app-shell.tsx`: user menu, logout action.

---

## Task 1: Backend Auth Config And Models

**Files:**
- Modify: `apps/api/config.py`
- Modify: `apps/api/models/__init__.py`
- Test: `apps/api/tests/test_auth.py`

**Interfaces:**
- Produces: `VerificationChallenge` model.
- Produces: settings used by auth services.

- [ ] **Step 1: Update config**

Add these fields to `Settings` in `apps/api/config.py`:

```python
auth_allow_dev_fallback: bool = False
auth_dev_code_echo: bool = False
auth_code_expire_minutes: int = 5
auth_code_max_attempts: int = 5
auth_code_length: int = 6
google_client_id: str = ""
google_client_secret: str = ""
google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
web_app_url: str = "http://localhost:3000"
```

- [ ] **Step 2: Add verification challenge model**

Add this model after `AuthIdentity` in `apps/api/models/__init__.py`:

```python
class VerificationChallenge(SQLModel, table=True):
    __tablename__ = "verification_challenges"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    channel: str = Field(index=True)  # phone / email
    destination: str = Field(index=True)
    code_hash: str
    purpose: str = "login"
    expires_at: datetime
    attempt_count: int = 0
    consumed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

- [ ] **Step 3: Verify backend import**

Run from `apps/api`:

```bash
uv run python -m compileall .
```

Expected: exit code `0`.

## Task 2: Password And Token Services

**Files:**
- Create: `apps/api/services/passwords.py`
- Create: `apps/api/services/tokens.py`
- Test: `apps/api/tests/test_auth.py`

**Interfaces:**
- Produces: `hash_password(password: str) -> str`
- Produces: `verify_password(password: str, password_hash: str) -> bool`
- Produces: `create_access_token(user_id: str) -> str`
- Produces: `decode_access_token(token: str) -> str`

- [ ] **Step 1: Create password service**

Create `apps/api/services/passwords.py`:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)
```

- [ ] **Step 2: Create token service**

Create `apps/api/services/tokens.py`:

```python
from datetime import datetime, timedelta

from fastapi import HTTPException
from jose import JWTError, jwt

from config import settings


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token 无效")
    return str(user_id)
```

- [ ] **Step 3: Verify backend import**

Run from `apps/api`:

```bash
uv run python -m compileall .
```

Expected: exit code `0`.

## Task 3: Verification Code Services

**Files:**
- Create: `apps/api/services/verification_codes.py`
- Create: `apps/api/services/message_delivery.py`
- Modify: `apps/api/routers/auth.py`
- Test: `apps/api/tests/test_auth.py`

**Interfaces:**
- Consumes: `VerificationChallenge`
- Produces: `create_challenge(session, channel, destination, purpose) -> tuple[VerificationChallenge, str]`
- Produces: `verify_challenge(session, challenge_id, code) -> VerificationChallenge`
- Produces: `send_verification_code(channel, destination, code) -> None`

- [ ] **Step 1: Create message delivery service**

Create `apps/api/services/message_delivery.py`:

```python
def mask_destination(channel: str, destination: str) -> str:
    if channel == "phone" and len(destination) >= 8:
        return f"{destination[:3]}****{destination[-4:]}"
    if channel == "email" and "@" in destination:
        name, domain = destination.split("@", 1)
        prefix = name[:2] if len(name) > 2 else name[:1]
        return f"{prefix}***@{domain}"
    return "***"


def send_verification_code(channel: str, destination: str, code: str) -> None:
    # Development sender. Production providers should be added behind this function.
    print(f"[auth-code] channel={channel} destination={destination} code={code}")
```

- [ ] **Step 2: Create verification code service**

Create `apps/api/services/verification_codes.py`:

```python
import hashlib
import random
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlmodel import Session

from config import settings
from models import VerificationChallenge


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def generate_code() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(settings.auth_code_length))


def create_challenge(
    session: Session,
    channel: str,
    destination: str,
    purpose: str = "login",
) -> tuple[VerificationChallenge, str]:
    if channel not in {"phone", "email"}:
        raise HTTPException(status_code=400, detail="不支持的验证码渠道")
    code = generate_code()
    challenge = VerificationChallenge(
        channel=channel,
        destination=destination,
        code_hash=_hash_code(code),
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.auth_code_expire_minutes),
    )
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge, code


def verify_challenge(session: Session, challenge_id: str, code: str) -> VerificationChallenge:
    try:
        challenge_uuid = uuid.UUID(challenge_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="验证码挑战不存在")

    challenge = session.get(VerificationChallenge, challenge_uuid)
    if not challenge:
        raise HTTPException(status_code=400, detail="验证码挑战不存在")
    if challenge.consumed_at is not None:
        raise HTTPException(status_code=400, detail="验证码已使用")
    if datetime.utcnow() > challenge.expires_at:
        raise HTTPException(status_code=400, detail="验证码已过期")
    if challenge.attempt_count >= settings.auth_code_max_attempts:
        raise HTTPException(status_code=429, detail="验证码尝试次数过多")

    if challenge.code_hash != _hash_code(code):
        challenge.attempt_count += 1
        session.add(challenge)
        session.commit()
        raise HTTPException(status_code=401, detail="验证码错误")

    challenge.consumed_at = datetime.utcnow()
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge
```

- [ ] **Step 3: Verify backend import**

Run from `apps/api`:

```bash
uv run python -m compileall .
```

Expected: exit code `0`.

## Task 4: Rewrite Auth Router Contract

**Files:**
- Modify: `apps/api/routers/auth.py`
- Modify: `apps/api/auth_deps.py`
- Test: `apps/api/tests/test_auth.py`

**Interfaces:**
- Consumes: password, token, verification code services.
- Produces: auth endpoints from `docs/product-v2/feature-specs/01-auth-foundation.md`.

- [ ] **Step 1: Replace fallback helper behavior**

Update `apps/api/auth_deps.py` so no-token fallback only works when `settings.auth_allow_dev_fallback` is true:

```python
if not token:
    if settings.auth_allow_dev_fallback:
        user = session.exec(select(User).limit(1)).first()
        if user:
            return str(user.id)
    raise HTTPException(status_code=401, detail="请先登录")
```

- [ ] **Step 2: Add unified response schemas**

In `apps/api/routers/auth.py`, use response shape:

```python
class AuthUserResponse(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    name: str | None = None


class AuthResponse(BaseModel):
    user: AuthUserResponse
    access_token: str
    token_type: str = "bearer"
```

- [ ] **Step 3: Implement code request endpoint**

Implement:

```text
POST /api/auth/code/request
```

Request body:

```python
class CodeRequest(BaseModel):
    channel: Literal["phone", "email"]
    destination: str
    purpose: str = "login"
```

Response includes `challenge_id`, `expires_in_seconds`, `masked_destination`, and `dev_code` only when `settings.auth_dev_code_echo` is true.

- [ ] **Step 4: Implement code verify endpoint**

Implement:

```text
POST /api/auth/code/verify
```

Behavior:

```text
verify challenge
find AuthIdentity by provider phone_code/email_code and provider_subject destination
if missing, create User and AuthIdentity
set user.phone or user.email based on channel
return AuthResponse
```

- [ ] **Step 5: Implement email/password signup and login**

Provider name: `email_password`.

Rules:

```text
signup requires password length >= 8
duplicate email returns 409
signup stores password_hash
login verifies password_hash
wrong password returns 401
```

- [ ] **Step 6: Keep compatibility aliases temporarily**

Keep these endpoints as thin wrappers so current frontend does not immediately break during migration:

```text
POST /api/auth/phone/request-code -> calls /code/request semantics
POST /api/auth/phone/login -> calls /code/verify semantics
```

- [ ] **Step 7: Verify backend**

Run from `apps/api`:

```bash
uv run python -m compileall .
```

Expected: exit code `0`.

## Task 5: Google OAuth Backend

**Files:**
- Create: `apps/api/services/google_oauth.py`
- Modify: `apps/api/routers/auth.py`
- Test: `apps/api/tests/test_auth.py`

**Interfaces:**
- Produces: `GET /api/auth/google/start`
- Produces: `GET /api/auth/google/callback`

- [ ] **Step 1: Create Google OAuth service**

Create `apps/api/services/google_oauth.py` with functions:

```python
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def build_google_auth_url(state: str) -> str:
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google 登录未配置")
    query = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    })
    return f"{GOOGLE_AUTH_URL}?{query}"


async def fetch_google_user(code: str) -> dict:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google 登录未配置")
    async with httpx.AsyncClient(timeout=10) as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        })
        token_res.raise_for_status()
        access_token = token_res.json()["access_token"]
        user_res = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        user_res.raise_for_status()
        user = user_res.json()
    if not user.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google 邮箱未验证")
    return user
```

- [ ] **Step 2: Add Google routes**

Add:

```text
GET /api/auth/google/start?next=/vault
GET /api/auth/google/callback?code=...&state=...
```

For this milestone, encode `next` into a signed JWT state using the existing JWT secret. Callback creates or finds `AuthIdentity(provider="google", provider_subject=google_sub)` and redirects to:

```text
{settings.web_app_url}/auth/callback?token=<token>&next=<next>
```

- [ ] **Step 3: Verify backend**

Run from `apps/api`:

```bash
uv run python -m compileall .
```

Expected: exit code `0`.

## Task 6: Backend Auth Tests

**Files:**
- Create: `apps/api/tests/test_auth.py`

**Interfaces:**
- Tests: code auth, password auth, `/me`, fallback disabled.

- [ ] **Step 1: Add tests for password hashing**

Test assertions:

```text
signup creates user
stored password_hash is not equal to raw password
login with wrong password returns 401
login with correct password returns access_token
```

- [ ] **Step 2: Add tests for verification code**

Test assertions:

```text
request code returns challenge_id
verify wrong code returns 401
verify correct dev code returns access_token when AUTH_DEV_CODE_ECHO=true
reusing same challenge returns 400
```

- [ ] **Step 3: Add tests for `/me`**

Test assertions:

```text
/api/auth/me without token returns 401
/api/auth/me with token returns current user
```

- [ ] **Step 4: Run tests**

Run from `apps/api`:

```bash
uv run pytest tests/test_auth.py -v
```

Expected: all tests pass.

## Task 7: Frontend Auth Client

**Files:**
- Create: `apps/web/lib/auth.ts`
- Modify: `apps/web/lib/api-client.ts`

**Interfaces:**
- Produces: typed frontend auth helpers.
- Consumes: backend auth endpoints.

- [ ] **Step 1: Create auth client**

Create `apps/web/lib/auth.ts` exporting:

```ts
export type AuthUser = {
  id: string
  email?: string | null
  phone?: string | null
  name?: string | null
}

export type AuthResponse = {
  user: AuthUser
  access_token: string
  token_type?: string
}

export function getStoredToken(): string | null
export function storeToken(token: string): void
export function clearToken(): void
export async function requestAuthCode(input: { channel: 'phone' | 'email'; destination: string }): Promise<{ challenge_id: string; expires_in_seconds: number; masked_destination: string; dev_code?: string }>
export async function verifyAuthCode(input: { challenge_id: string; code: string; name?: string }): Promise<AuthResponse>
export async function signup(input: { name?: string; email: string; password: string }): Promise<AuthResponse>
export async function login(input: { email: string; password: string }): Promise<AuthResponse>
export function getGoogleLoginUrl(next?: string): string
export async function getCurrentUser(): Promise<AuthUser | null>
export async function logout(): Promise<void>
```

- [ ] **Step 2: Update API client token handling**

Modify `fetchAPI` in `apps/web/lib/api-client.ts`:

```text
read token via getStoredToken()
include Authorization when present
on 401 call clearToken()
throw useful Error with status
```

- [ ] **Step 3: Verify frontend**

Run from `apps/web`:

```bash
npm run build
```

Expected: build passes.

## Task 8: Login, Signup, And OAuth Callback Pages

**Files:**
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/signup/page.tsx`
- Create: `apps/web/app/auth/callback/page.tsx`

**Interfaces:**
- Consumes: `apps/web/lib/auth.ts`
- Produces: user-facing auth flows.

- [ ] **Step 1: Build login page**

Page must include method tabs:

```text
手机号验证码
邮箱验证码
邮箱密码
Google
```

Behavior:

```text
code tabs request challenge
code tabs verify challenge
password tab calls login()
Google button links to getGoogleLoginUrl(next)
success stores token and redirects to next or /dashboard
```

- [ ] **Step 2: Build signup page**

Page must include method tabs:

```text
手机号验证码
邮箱验证码
邮箱密码
Google
```

Behavior:

```text
code tabs include optional name
password tab calls signup()
Google button links to getGoogleLoginUrl('/dashboard')
success stores token and redirects to /dashboard
```

- [ ] **Step 3: Build callback page**

`/auth/callback` reads `token` and `next` from query string, stores token, then redirects to `next` or `/dashboard`.

- [ ] **Step 4: Verify frontend**

Run from `apps/web`:

```bash
npm run build
```

Expected: build passes.

## Task 9: Protected Routes And Logout

**Files:**
- Create: `apps/web/components/auth/auth-gate.tsx`
- Modify: `apps/web/components/app-shell.tsx`
- Modify: private app pages only if needed.

**Interfaces:**
- Consumes: `getCurrentUser`, `logout`, `clearToken`.
- Produces: protected workspace behavior.

- [ ] **Step 1: Create AuthGate**

Create a client component that:

```text
checks token
calls /api/auth/me
redirects unauthenticated users to /login?next=<current path>
shows a compact loading state while checking
renders children when authenticated
```

- [ ] **Step 2: Apply AuthGate**

Wrap private product pages or the shared shell area so these paths are guarded:

```text
/dashboard
/vault
/vault/review
/jobs
/evidence
/generate
/editor
/prep
/tracker
```

- [ ] **Step 3: Add logout to AppShell**

Add a user menu action:

```text
退出登录
```

Behavior:

```text
call logout()
clear token
redirect to /login
```

- [ ] **Step 4: Verify frontend**

Run from `apps/web`:

```bash
npm run build
```

Expected: build passes.

## Task 10: User Scoping Audit

**Files:**
- Modify: `apps/api/routers/vault.py`
- Modify: `apps/api/routers/vault_sources.py`
- Modify: `apps/api/routers/vault_events.py`
- Modify: `apps/api/routers/core.py`
- Test: add cases to `apps/api/tests/test_auth.py` or create `apps/api/tests/test_user_scoping.py`

**Interfaces:**
- Consumes: `get_current_user_id`.
- Produces: user A/B data isolation.

- [ ] **Step 1: Audit create operations**

Every create operation must set:

```python
user_id=user_id
```

from `Depends(get_current_user_id)`.

- [ ] **Step 2: Audit list operations**

Every list operation must filter:

```python
.where(Model.user_id == user_id)
```

- [ ] **Step 3: Audit detail/update/delete operations**

Every detail/update/delete operation must first fetch with both id and user_id:

```python
select(Model).where(Model.id == object_id, Model.user_id == user_id)
```

Return `404` when no record is found.

- [ ] **Step 4: Add data isolation test**

Test shape:

```text
create user A and user B
create source/event as A
call list as B
assert A's record is absent
call update/archive as B
assert 404
```

- [ ] **Step 5: Verify backend**

Run from `apps/api`:

```bash
uv run python -m compileall .
uv run pytest tests/test_auth.py -v
```

Expected: all tests pass.

## Task 11: Final Smoke Verification

**Files:**
- No source edits unless verification exposes a bug.

**Interfaces:**
- Consumes: completed Auth Foundation.
- Produces: ready state for Vault Core implementation.

- [ ] **Step 1: Backend verification**

Run from `apps/api`:

```bash
uv run python -m compileall .
uv run pytest tests/test_auth.py -v
```

Expected: all tests pass.

- [ ] **Step 2: Frontend verification**

Run from `apps/web`:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Manual happy path**

Verify in browser:

```text
open /vault while logged out -> redirected to /login?next=%2Fvault
request phone code -> verify code -> redirected to /vault
logout -> redirected to /login
login with email/password -> redirected to /dashboard
open /login while logged in -> redirected or manually navigate away to /dashboard
```

## Execution Notes

- If Google credentials are not available, implement the routes and UI button but show `Google 登录未配置` from backend. Phone/email auth remains shippable.
- If tests require a clean database, use an isolated SQLite database configured for the test process rather than deleting the developer's local `career_copilot.db`.
- Do not start Vault Core implementation until Auth Foundation passes final smoke verification.

## Completion Criteria

Auth Foundation is complete when:

- Phone code login/signup works.
- Email code login/signup works.
- Email/password signup/login works with hashed passwords.
- Google OAuth endpoints exist and work when env vars are configured.
- `/api/auth/me` identifies the current user from token.
- No-token API requests return `401` unless explicit dev fallback is enabled.
- Private routes require auth.
- Logout clears frontend auth state.
- User A cannot read or modify User B's private records.
- `uv run python -m compileall .` passes in `apps/api`.
- `uv run pytest tests/test_auth.py -v` passes in `apps/api`.
- `npm run build` passes in `apps/web`.
