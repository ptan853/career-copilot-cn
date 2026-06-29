// API 客户端
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// Sources
export const uploadSource = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  // Don't set Content-Type — browser auto-sets multipart boundary
  return fetchAPI<{ source_id: string; job_id: string }>('/api/sources/upload', {
    method: 'POST',
    body: form,
    headers: {},
  } as RequestInit)
}

export const ingestMultiSource = async (data: { text: string; urls: string[] }) =>
  fetchAPI<{ source_id: string; job_id: string }>('/api/sources/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getSources = () => fetchAPI<any[]>('/api/sources')

// Events
export const getEvents = (params?: { status?: string; type?: string }) => {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.type) query.set('type', params.type)
  const qs = query.toString()
  return fetchAPI<any[]>(`/api/events${qs ? `?${qs}` : ''}`)
}

export const updateEvent = (id: string, data: Record<string, any>) =>
  fetchAPI<any>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const confirmEvent = (id: string) =>
  fetchAPI<any>(`/api/events/${id}/confirm`, { method: 'POST' })

export const archiveEvent = (id: string) =>
  fetchAPI<any>(`/api/events/${id}/archive`, { method: 'POST' })

// Profile
export const getProfile = () => fetchAPI<any>('/api/profile')

export const updateProfile = (data: Record<string, any>) =>
  fetchAPI<any>('/api/profile', { method: 'PATCH', body: JSON.stringify(data) })

// Targets
export const createTarget = (data: { jd_raw: string; company?: string; role?: string }) =>
  fetchAPI<any>('/api/targets', { method: 'POST', body: JSON.stringify(data) })

export const getTargets = () => fetchAPI<any[]>('/api/targets')

// Jobs
export const getJob = (id: string) => fetchAPI<{ status: string; result?: any }>(`/api/jobs/${id}`)
