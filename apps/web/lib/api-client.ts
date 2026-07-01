// API Client V2 — centralized bearer token, clears on 401
import { getStoredToken, clearToken } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}

  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (typeof window !== 'undefined') {
    const token = getStoredToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  })
  if (res.status === 401) {
    clearToken()
  }
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// Auth re-exports (new contract from lib/auth.ts)
export {
  requestAuthCode,
  verifyAuthCode,
  signup,
  login,
  getGoogleLoginUrl,
  getCurrentUser,
  logout,
  getStoredToken,
  storeToken,
  clearToken,
} from './auth'
export type { AuthUser, AuthResponse } from './auth'

export type VaultClaim = {
  id: string
  career_event_id: string
  claim_text: string
  claim_type: string
  strength: string
  visibility?: string
}

export type VaultPatchDiff = {
  field: string
  change_type: string
  old_value?: any
  new_value?: any
}

export type VaultPendingPatch = {
  id: string
  status: string
  reason?: string
  source_ids?: string[]
  before?: Record<string, any>
  after?: Record<string, any>
  diff?: VaultPatchDiff[]
}

export type VaultEvent = {
  id: string
  section_type?: string
  section_title?: string
  event_type: string
  title: string
  role?: string | null
  organization?: string | null
  location?: string | null
  time_start?: string | null
  time_end?: string | null
  time_precision?: string
  description?: string | null
  details_json?: Record<string, any>
  pending_patches?: VaultPendingPatch[]
  pending_patch_count?: number
  has_pending_updates?: boolean
  tags?: string[]
  status: string
  visibility: string
  source_confidence?: number | null
  source_id?: string | null
  claims_count?: number
  evidence_count?: number
}

export type VaultSection = {
  section_type: string
  section_title: string
  events: VaultEvent[]
}

export type VaultSourceInput = {
  text: string
  urls: string[]
  input_hint?: string
}

export const emailSignup = (email: string, password: string, name: string) =>
  fetchAPI('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) })

export const emailLogin = (email: string, password: string) =>
  fetchAPI('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const getMe = () => fetchAPI('/api/auth/me')

// Dashboard
export const getDashboardSummary = () => fetchAPI('/api/dashboard/summary')
export const getDashboardActivity = () => fetchAPI('/api/dashboard/activity')
export const getDashboardRecommendations = () => fetchAPI('/api/dashboard/recommendations')

// Vault — Sources
export const createSource = (data: VaultSourceInput) =>
  fetchAPI('/api/vault/sources', { method: 'POST', body: JSON.stringify(data) })

export const uploadSource = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return fetchAPI('/api/vault/sources/upload', { method: 'POST', body: form })
}

export const getSources = () => fetchAPI('/api/vault/sources')

export const getSource = (id: string) => fetchAPI(`/api/vault/sources/${id}`)

export const deleteSource = (id: string) =>
  fetchAPI(`/api/vault/sources/${id}`, { method: 'DELETE' })

// Vault — Events
export const createEvent = (data: {
  event_type: string; title: string; role?: string; organization?: string;
  location?: string; time_start?: string; time_end?: string; description?: string;
  details_json?: Record<string, any>; tags?: string[]
}) => fetchAPI('/api/vault/events', { method: 'POST', body: JSON.stringify(data) })

export const getEvents = (params?: { status?: string; event_type?: string }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.event_type) q.set('event_type', params.event_type)
  const qs = q.toString()
  return fetchAPI(`/api/vault/events${qs ? `?${qs}` : ''}`)
}

export const getGroupedEvents = (params?: { status?: string }) => {
  const q = new URLSearchParams()
  q.set('grouped', 'true')
  if (params?.status) q.set('status', params.status)
  return fetchAPI<{ data: VaultSection[] }>(`/api/vault/events?${q.toString()}`)
}

export const updateEvent = (id: string, data: Record<string, any>) =>
  fetchAPI(`/api/vault/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteEvent = (id: string) =>
  fetchAPI(`/api/vault/events/${id}`, { method: 'DELETE' })

export const confirmEvent = (id: string) =>
  fetchAPI(`/api/vault/events/${id}/confirm`, { method: 'POST' })

export const archiveEvent = (id: string) =>
  fetchAPI(`/api/vault/events/${id}/archive`, { method: 'POST' })

// Vault — Profile
export const getProfile = () => fetchAPI('/api/vault/profile')
export const updateProfile = (data: Record<string, any>) =>
  fetchAPI('/api/vault/profile', { method: 'PATCH', body: JSON.stringify(data) })
export const clearVault = () => fetchAPI('/api/vault/clear', { method: 'POST' })

// Vault — Claims
export const getClaims = (params?: { event_id?: string }) => {
  const q = params?.event_id ? `?event_id=${encodeURIComponent(params.event_id)}` : ''
  return fetchAPI(`/api/vault/claims${q}`)
}

export const createClaim = (data: { event_id: string; claim_text: string; claim_type?: string; strength?: string }) =>
  fetchAPI('/api/vault/claims', { method: 'POST', body: JSON.stringify(data) })

export const updateClaim = (id: string, data: Record<string, any>) =>
  fetchAPI(`/api/vault/claims/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteClaim = (id: string) =>
  fetchAPI(`/api/vault/claims/${id}`, { method: 'DELETE' })

// Vault — Review & Readiness
export const getReviewQueue = () => fetchAPI('/api/vault/review-queue')
export const batchConfirmEvents = (eventIds: string[]) =>
  fetchAPI('/api/vault/review-queue/batch-confirm', { method: 'POST', body: JSON.stringify({ event_ids: eventIds }) })
export const getReadiness = () => fetchAPI('/api/vault/readiness')

// Jobs — full CRUD
export const getJobs = (params?: { status?: string; priority?: string; channel?: string }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.priority) q.set('priority', params.priority)
  if (params?.channel) q.set('channel', params.channel)
  const qs = q.toString()
  return fetchAPI(`/api/jobs${qs ? `?${qs}` : ''}`)
}

export const getJob = (id: string) => fetchAPI(`/api/jobs/${id}`)

export const createJob = (data: {
  company?: string; role?: string; city?: string; work_mode?: string;
  industry?: string; source_url?: string; channel?: string; raw_jd?: string;
  deadline?: string; priority?: string; tags?: string[];
}) => fetchAPI('/api/jobs', { method: 'POST', body: JSON.stringify(data) })

export const updateJob = (id: string, data: Record<string, any>) =>
  fetchAPI(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteJob = (id: string) =>
  fetchAPI(`/api/jobs/${id}`, { method: 'DELETE' })

// Jobs — Evidence Mapping
export const createEvidenceMap = (jobId: string) =>
  fetchAPI(`/api/jobs/${jobId}/evidence-map`, { method: 'POST' })

export const getEvidenceMap = (jobId: string) =>
  fetchAPI(`/api/jobs/${jobId}/evidence-map`)

// Artifacts — Generate + CRUD + Versions
export const getArtifacts = (params?: { job_target_id?: string; artifact_type?: string }) => {
  const q = new URLSearchParams()
  if (params?.job_target_id) q.set('job_target_id', params.job_target_id)
  if (params?.artifact_type) q.set('artifact_type', params.artifact_type)
  const qs = q.toString()
  return fetchAPI(`/api/artifacts${qs ? `?${qs}` : ''}`)
}

export const getArtifact = (id: string) => fetchAPI(`/api/artifacts/${id}`)

export const generateArtifact = (data: {
  job_target_id: string; doc_type?: string; language?: string;
  template?: string; sections?: string[]; evidence_strictness?: string;
}) => fetchAPI('/api/artifacts/generate', { method: 'POST', body: JSON.stringify(data) })

export const updateArtifact = (id: string, data: Record<string, any>) =>
  fetchAPI(`/api/artifacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteArtifact = (id: string) =>
  fetchAPI(`/api/artifacts/${id}`, { method: 'DELETE' })

export const getArtifactVersions = (artifactId: string) =>
  fetchAPI(`/api/artifacts/${artifactId}/versions`)

export const saveArtifactVersion = (artifactId: string, data: {
  structured_json?: Record<string, any>; markdown?: string;
  html?: string; change_summary?: string;
}) => fetchAPI(`/api/artifacts/${artifactId}/versions`, { method: 'POST', body: JSON.stringify(data) })
