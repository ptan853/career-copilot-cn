// Frontend auth client — typed helpers for all auth flows.
//
// All auth state lives in localStorage (bearer token). On 401 the api-client
// layer clears it, so the user is effectively logged out.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────

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

export type CodeRequestResult = {
  challenge_id: string
  expires_in_seconds: number
  masked_destination: string
  dev_code?: string
}

// ── Token helpers ──────────────────────────────────────────────

const TOKEN_KEY = 'token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

// ── HTTP helpers ───────────────────────────────────────────────

async function authFetch<T>(
  path: string,
  options?: RequestInit & { noAuth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {}
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getStoredToken()
  if (token && !options?.noAuth) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  })
  if (res.status === 401 && !options?.noAuth) {
    clearToken()
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).detail || `Auth error: ${res.status}`)
  }
  return res.json()
}

// ── Code auth ──────────────────────────────────────────────────

export async function requestAuthCode(input: {
  channel: 'phone' | 'email'
  destination: string
}): Promise<CodeRequestResult> {
  return authFetch('/api/auth/code/request', {
    method: 'POST',
    body: JSON.stringify({ ...input, purpose: 'login' }),
    noAuth: true,
  })
}

export async function verifyAuthCode(input: {
  challenge_id: string
  code: string
  name?: string
}): Promise<AuthResponse> {
  const resp = await authFetch<AuthResponse>('/api/auth/code/verify', {
    method: 'POST',
    body: JSON.stringify(input),
    noAuth: true,
  })
  storeToken(resp.access_token)
  return resp
}

// ── Password auth ──────────────────────────────────────────────

export async function signup(input: {
  name?: string
  email: string
  password: string
}): Promise<AuthResponse> {
  const resp = await authFetch<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
    noAuth: true,
  })
  storeToken(resp.access_token)
  return resp
}

export async function login(input: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const resp = await authFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    noAuth: true,
  })
  storeToken(resp.access_token)
  return resp
}

// ── Google OAuth ───────────────────────────────────────────────

export function getGoogleLoginUrl(next?: string): string {
  const qs = new URLSearchParams()
  if (next) qs.set('next', next)
  return `${API_BASE}/api/auth/google/start${qs.toString() ? `?${qs}` : ''}`
}

// ── Session ────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await authFetch<AuthUser>('/api/auth/me')
  } catch {
    clearToken()
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // ignore
  }
  clearToken()
}
