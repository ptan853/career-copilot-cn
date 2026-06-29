# Landing And Auth Page Spec

## Purpose

Explain the product clearly, establish trust, and move users into a secure account.

## Pages

- Landing
- Pricing
- Privacy
- Terms
- Login
- Signup
- Password reset
- OAuth / phone callback

## Landing Content

The landing page should communicate:

- Build your career profile once.
- Tailor every resume and application material to each job.
- Keep evidence, versions, and interview prep connected.
- Designed for Chinese and global job applications.

## Auth Requirements

Supported methods:

- Email and password.
- Phone verification code.
- WeChat login, later phase.
- Google/GitHub, optional for international users.

## Auth Maturity

Must support:

- Password hash storage.
- JWT or secure session cookie.
- `/me` endpoint.
- Logout.
- Password reset.
- Basic rate limiting.
- User data isolation.

## Empty / Error States

- Invalid credentials.
- Expired phone code.
- Existing account.
- Weak password.
- Network failure.

## APIs

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/phone/request-code`
- `POST /auth/phone/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/password/reset-request`
- `POST /auth/password/reset-confirm`

