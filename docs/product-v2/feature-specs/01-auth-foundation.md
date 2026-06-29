# Feature Spec: Auth Foundation

## Objective

Build the first production-shaped foundation for Product V2: users can sign up or log in with phone verification code, email verification code, email/password, or Google OAuth, stay authenticated across page refreshes, and only access their own private data.

This feature must be implemented before Vault, Job Target, Artifact, Tracker, or Interview Prep become real workflows.

## User Stories

### Signup Or First Login

As a new user, I can create an account with phone, email, or Google so that my career data belongs to me.

### Login

As an existing user, I can log in with phone verification code, email verification code, email/password, or Google so that I can access my workspace.

### Verification Code

As a user, I can request a one-time code to my phone or email and use it to authenticate without remembering a password.

### Logout

As a logged-in user, I can log out so that other people using the same device cannot access my data.

### Session Restore

As a logged-in user, I can refresh the browser and stay logged in.

### Protected Workspace

As a user, I cannot access private product pages unless I am logged in.

### Data Isolation

As a user, I can only see my own sources, events, jobs, artifacts, applications, and interview prep records.

## Scope

Included:

- Phone verification code login/signup.
- Email verification code login/signup.
- Email/password signup and login.
- Google OAuth login/signup.
- Logout.
- `/api/auth/me`.
- Password hashing.
- Verification code issuance, expiry, and attempt limits.
- Token or cookie based session.
- Frontend auth state.
- Protected routes for private app pages.
- Logged-in redirect away from `/login` and `/signup`.
- API current-user dependency.
- User scoping audit for existing private V2 routers.

Excluded:

- Billing.
- Team accounts.
- Admin roles.
- Password reset email.
- Multi-factor auth.
- Passkeys.

## Product Routes

Public routes:

```text
/
/login
/signup
```

Private routes:

```text
/dashboard
/vault
/vault/review
/jobs
/jobs/[id]
/evidence
/generate
/editor
/prep
/tracker
```

Route behavior:

- Unauthenticated user opening a private route is redirected to `/login?next=<encoded_path>`.
- Authenticated user opening `/login` or `/signup` is redirected to `/dashboard`.
- Successful login redirects to `next` when present, otherwise `/dashboard`.
- Successful signup redirects to `/dashboard`.

## Backend Contract

### POST `/api/auth/code/request`

Request for phone:

```json
{
  "channel": "phone",
  "destination": "+8613800138000",
  "purpose": "login"
}
```

Request for email:

```json
{
  "channel": "email",
  "destination": "user@example.com",
  "purpose": "login"
}
```

Validation:

- `channel` must be `phone` or `email`.
- `destination` is required.
- `purpose` must be `login`.
- Repeated requests are rate limited.

Response `200`:

```json
{
  "challenge_id": "challenge-id",
  "expires_in_seconds": 300,
  "masked_destination": "+86 138****8000"
}
```

Development mode:

- The code may be returned only when `AUTH_DEV_CODE_ECHO=true`.
- Production must never return the verification code in the response.

### POST `/api/auth/code/verify`

Request:

```json
{
  "challenge_id": "challenge-id",
  "code": "123456",
  "name": "用户姓名"
}
```

Behavior:

- If the phone/email already belongs to a user, log that user in.
- If it does not belong to a user, create a new user and auth identity.
- `name` is optional and only used during first account creation.

Response `200`:

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "phone": "+8613800138000",
    "name": "用户姓名"
  },
  "access_token": "jwt-or-session-token"
}
```

Failure:

- Expired challenge returns `400`.
- Wrong code returns `401`.
- Too many attempts returns `429`.

### POST `/api/auth/signup`

Request:

```json
{
  "email": "user@example.com",
  "password": "correct horse battery staple",
  "name": "用户姓名"
}
```

Validation:

- `email` is required.
- `password` is required.
- `password` must be at least 8 characters.
- `name` is optional.
- Duplicate email returns `409`.

Response `201`:

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "用户姓名"
  },
  "access_token": "jwt-or-session-token"
}
```

### POST `/api/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "correct horse battery staple"
}
```

Response `200`:

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "用户姓名"
  },
  "access_token": "jwt-or-session-token"
}
```

Failure:

- Unknown email returns `401`.
- Wrong password returns `401`.
- Response body should not reveal which field was wrong.

### GET `/api/auth/google/start`

Query:

```text
next=/vault
```

Behavior:

- Redirects the browser to Google's OAuth consent screen.
- Includes a CSRF-protected `state` value.
- Preserves the `next` path in server-side state or signed state payload.

### GET `/api/auth/google/callback`

Behavior:

- Verifies Google OAuth state.
- Exchanges authorization code for Google user identity.
- Uses verified Google email as the account identifier.
- Creates a user if none exists.
- Links a `google` auth identity if the email already belongs to the same user.
- Redirects to `next` when present, otherwise `/dashboard`.

Failure:

- Invalid state returns `400`.
- Unverified Google email returns `401`.
- Provider failure returns a user-facing auth error page or redirects to `/login?error=google_auth_failed`.

### GET `/api/auth/me`

Headers:

```text
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "用户姓名"
}
```

Response `401`:

```json
{
  "detail": "Not authenticated"
}
```

### POST `/api/auth/logout`

For stateless JWT:

- Frontend removes token.
- Backend returns `204`.

For cookie/session:

- Backend clears session cookie.
- Backend returns `204`.

Current implementation should choose one approach and document it in `docs/product-v2/07-api-contract.md`.

## Data Model Requirements

`User` must support:

```text
id
email
phone
name
created_at
updated_at
```

`AuthIdentity` must support:

```text
id
user_id
provider = "email_password" | "email_code" | "phone_code" | "google"
provider_subject = email | phone | google_sub
password_hash nullable
created_at
updated_at
```

`VerificationChallenge` must support:

```text
id
channel = "phone" | "email"
destination
code_hash
purpose = "login"
expires_at
attempt_count
consumed_at nullable
created_at
```

Password rules:

- Never store plaintext password.
- Use a password hashing function designed for passwords.
- `password_hash` must not be returned from any API response.

Verification code rules:

- Store only `code_hash`, never plaintext code.
- Codes expire after 5 minutes.
- A challenge is consumed after successful verification.
- A challenge allows at most 5 failed attempts.
- Rate limit request by destination and IP.
- SMS/email provider should be behind a service interface so development can use a console/dev sender.

## Frontend Requirements

### Pages

Create or restore:

```text
apps/web/app/login/page.tsx
apps/web/app/signup/page.tsx
```

Login page must include:

- Login method tabs: phone code, email code, email password, Google.
- Phone input for phone code login.
- Email input for email code and password login.
- Password input for password login.
- Verification code input after requesting code.
- Send code button with cooldown.
- Google login button.
- Submit button.
- Link to signup.
- Error message area.
- Loading state.

Signup page must include:

- Name input.
- Phone input.
- Email input.
- Password input as optional email/password account setup.
- Verification code flow for phone or email.
- Google signup button.
- Submit button.
- Link to login.
- Error message area.
- Loading state.

### Auth Client

Create:

```text
apps/web/lib/auth.ts
```

Exports:

```ts
export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  access_token: string;
};

export function getStoredToken(): string | null;
export function storeToken(token: string): void;
export function clearToken(): void;
export async function signup(input: { name?: string; email: string; password: string }): Promise<AuthResponse>;
export async function login(input: { email: string; password: string }): Promise<AuthResponse>;
export async function requestAuthCode(input: { channel: "phone" | "email"; destination: string }): Promise<{ challenge_id: string; expires_in_seconds: number; masked_destination: string }>;
export async function verifyAuthCode(input: { challenge_id: string; code: string; name?: string }): Promise<AuthResponse>;
export function getGoogleLoginUrl(next?: string): string;
export async function getCurrentUser(): Promise<AuthUser | null>;
export async function logout(): Promise<void>;
```

### API Client

Modify:

```text
apps/web/lib/api-client.ts
```

Requirements:

- All private API requests include `Authorization: Bearer <token>`.
- `401` responses clear local auth state.
- Private API helpers do not silently call endpoints without a token.

### Route Guard

Preferred file:

```text
apps/web/middleware.ts
```

Alternative if middleware is not suitable:

```text
apps/web/components/auth/auth-gate.tsx
```

Protected paths:

```ts
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/vault",
  "/jobs",
  "/evidence",
  "/generate",
  "/editor",
  "/prep",
  "/tracker",
];
```

## Backend Implementation Files

Modify:

```text
apps/api/routers/auth.py
apps/api/auth_deps.py
apps/api/models/__init__.py
apps/api/config.py
```

Optional create:

```text
apps/api/services/passwords.py
apps/api/services/tokens.py
apps/api/services/verification_codes.py
apps/api/services/message_delivery.py
apps/api/services/google_oauth.py
apps/api/tests/test_auth.py
```

## User Scoping Audit

All existing private routers must use `current_user.id` when reading or writing records.

Audit these files:

```text
apps/api/routers/vault.py
apps/api/routers/vault_sources.py
apps/api/routers/vault_events.py
apps/api/routers/core.py
```

Required behavior:

- Create operations set `user_id = current_user.id`.
- List operations filter by `user_id = current_user.id`.
- Detail/update/delete operations verify ownership before returning or modifying data.
- Unauthorized access to another user's record returns `404` or `403`; choose one convention and use it consistently.

## Acceptance Criteria

### Backend

- `POST /api/auth/code/request` creates a verification challenge for phone or email.
- `POST /api/auth/code/verify` logs in an existing user or creates a new user.
- Verification code is hashed, expires, and cannot be reused.
- `POST /api/auth/signup` creates `User` and `AuthIdentity` for email/password.
- Signup stores password hash, not plaintext password.
- Duplicate email returns `409`.
- `POST /api/auth/login` returns token for correct password.
- Wrong password returns `401`.
- Google OAuth callback creates or logs in a user with verified Google email.
- `GET /api/auth/me` returns current user with valid token.
- `GET /api/auth/me` returns `401` without token.
- `POST /api/auth/logout` succeeds.
- Dev fallback user is disabled unless an explicit development config flag is true.

### Frontend

- `/signup` can create an account by phone code, email code, email/password, or Google.
- `/login` can log in by phone code, email code, email/password, or Google.
- Send-code button enters cooldown and shows masked destination.
- Successful login redirects to `/dashboard`.
- Refreshing `/dashboard` keeps the user logged in.
- Logout clears session and redirects to `/login`.
- Unauthenticated access to `/vault` redirects to `/login?next=%2Fvault`.
- Authenticated access to `/login` redirects to `/dashboard`.

### Data Isolation

- User A creates a source.
- User B logs in.
- User B cannot see User A's source.
- User B cannot update or archive User A's event by guessing its id.

## Verification Commands

Backend:

```bash
cd apps/api
uv run python -m compileall .
uv run pytest tests/test_auth.py -v
```

Frontend:

```bash
cd apps/web
npm run build
```

Manual smoke:

```text
1. Open /signup.
2. Create user A with phone code.
3. Confirm redirect to /dashboard.
4. Open /vault.
5. Log out.
6. Confirm redirect to /login.
7. Open /vault directly.
8. Confirm redirect to /login?next=%2Fvault.
9. Log in again with email code or password.
10. Confirm redirect back to /vault.
11. Log out.
12. Log in with Google.
13. Confirm redirect to /dashboard.
```

## Implementation Order

1. Backend token service.
2. Verification challenge model and service.
3. Message delivery interface with dev sender.
4. Phone/email code request endpoint.
5. Phone/email code verify endpoint.
6. Email/password hashing, signup, and login.
7. `/me` and logout endpoint.
8. Google OAuth start/callback.
9. Backend auth tests.
10. Frontend auth client.
11. Login/signup pages with method tabs.
12. Route guard.
13. API client auth header.
14. User scoping audit.
15. Build and smoke verification.

## Non-Goals For This Feature

- Do not implement password reset in this feature.
- Do not build billing or subscription logic in this feature.
- Do not redesign the entire AppShell in this feature beyond auth-aware user menu behavior.
