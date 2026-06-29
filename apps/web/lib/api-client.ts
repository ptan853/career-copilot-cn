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
  return fetchAPI<{ source_id: string; job_id: string }>('/api/sources/upload', {
    method: 'POST',
    body: form,
  })
}

export const getSources = () => fetchAPI<any[]>('/api/sources')

// Events
export const getEvents = (params?: { status?: string; type?: string }) => {
  const query = new URLSearchParams(params || {}).toString()
  return fetchAPI<any[]>(`/api/events${query ? `?${query}` : ''}`)
}

export const confirmEvent = (id: string) =>
  fetchAPI<any>(`/api/events/${id}/confirm`, { method: 'POST' })

// Targets
export const createTarget = (data: { jd_raw: string; company?: string; role?: string }) =>
  fetchAPI<any>('/api/targets', { method: 'POST', body: JSON.stringify(data) })

export const getTargets = () => fetchAPI<any[]>('/api/targets')

// Jobs
export const getJob = (id: string) => fetchAPI<{ status: string; result?: any }>(`/api/jobs/${id}`)
