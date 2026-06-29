// API 客户端
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}

  // 不设置 Content-Type 的情况：FormData（浏览器自动设 multipart boundary）
  if (options?.body instanceof FormData) {
    // 让浏览器自动处理
  } else {
    headers['Content-Type'] = 'application/json'
  }

  // 附带 JWT token
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// Sources
export const uploadSource = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return fetchAPI<{ source_id: string; job_id: string }>('/api/sources/upload', {
    method: 'POST',
    body: form,
  })
}

export const ingestMultiSource = async (data: { text: string; urls: string[] }) =>
  fetchAPI<{ source_id: string; job_id: string }>('/api/sources/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getSources = () => fetchAPI<any[]>('/api/sources')

// Events
export const createEvent = (data: {
  event_type: string
  title: string
  organization?: string
  role?: string
  time_start?: string
  time_end?: string
  description?: string
  details?: Record<string, any>
  tags?: string[]
}) =>
  fetchAPI<any>('/api/events', { method: 'POST', body: JSON.stringify(data) })

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
