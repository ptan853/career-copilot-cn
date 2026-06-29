'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type EventData } from '@/components/review-card'
import EventEditModal from '@/components/event-edit-modal'
import { EVENT_TYPE_COLORS } from '@/lib/event-constants'
import { getEvents, updateEvent, confirmEvent, archiveEvent, uploadSource, getJob, getProfile } from '@/lib/api-client'

const ADDABLE_SECTIONS = [
  { type: 'work' as const, label: '工作经历', icon: '💼' },
  { type: 'education' as const, label: '教育经历', icon: '🎓' },
  { type: 'project' as const, label: '项目经历', icon: '🚀' },
]

export default function ProfilePage() {
  const [events, setEvents] = useState<EventData[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [addingType, setAddingType] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [evts, prof] = await Promise.all([
        getEvents().catch(() => []),
        getProfile().catch(() => ({ profile: null })),
      ])
      setEvents(evts || [])
      setProfile(prof?.profile || null)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const pollJob = async (jobId: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const job = await getJob(jobId)
        if (job.status === 'completed') {
          showToast(`解析完成，新增 ${job.result?.event_count || 0} 条事件`)
          loadData()
          setUploading(false)
          setUploadStage(null)
          return
        }
        if (job.status === 'failed') {
          showToast(job.error || '解析失败', 'error')
          setUploading(false)
          setUploadStage(null)
          return
        }
        if (i === 2) setUploadStage('AI 正在分析...')
        else if (i > 10) setUploadStage('仍在处理中...')
      } catch {}
    }
    showToast('解析超时', 'error')
    setUploading(false)
    setUploadStage(null)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadStage('上传中...')
    try {
      const { job_id } = await uploadSource(file)
      pollJob(job_id)
    } catch (err: any) {
      showToast(err.message || '上传失败', 'error')
      setUploading(false)
      setUploadStage(null)
    }
  }

  const handleSaveEvent = async (id: string, fields: Record<string, any>) => {
    try {
      const payload: Record<string, any> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== '') payload[k] = v
        else if (k === 'description') payload[k] = ''
      }
      await updateEvent(id, payload)
      setEvents(prev => prev.map(e => e.id === id ? {
        ...e,
        title: payload.title ?? e.title,
        organization: payload.organization ?? e.organization,
        role: payload.role ?? e.role,
        time_start: payload.time_start ?? e.time_start,
        time_end: payload.time_end ?? e.time_end,
        description: payload.description ?? e.description,
        details: payload.details ?? e.details,
      } : e))
      showToast('已保存')
    } catch {
      showToast('保存失败', 'error')
    }
  }

  const handleConfirmEvent = async (id: string) => {
    try {
      await confirmEvent(id)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'confirmed' } : e))
      showToast('已确认')
    } catch { showToast('操作失败', 'error') }
  }

  const handleRemoveEvent = async (id: string) => {
    try {
      await archiveEvent(id)
      setEvents(prev => prev.filter(e => e.id !== id))
      showToast('已删除')
    } catch { showToast('操作失败', 'error') }
  }

  const openEditModal = (event: EventData) => {
    setEditingEvent(event)
    setModalOpen(true)
  }

  // Add a blank new section
  const handleAddSection = (type: string) => {
    setAddingType(type)
    // Create a blank event
    const blank: EventData = {
      id: `new-${Date.now()}`,
      type: type as any,
      title: '',
      organization: '',
      role: '',
      time_start: '',
      time_end: '',
      description: '',
      status: 'draft',
      tags: [],
      details: {},
    }
    setEvents(prev => [blank, ...prev])
    setEditingEvent(blank)
    setModalOpen(true)
  }

  // Group events by type
  const grouped = events.reduce((acc, ev) => {
    const t = ev.type || 'custom'
    if (!acc[t]) acc[t] = []
    acc[t].push(ev)
    return acc
  }, {} as Record<string, EventData[]>)

  const groupOrder = ['work', 'education', 'project', 'certification', 'award', 'publication', 'open_source', 'custom']
    .filter(t => grouped[t]?.length)

  // Check which addable types already exist
  const missingSections = ADDABLE_SECTIONS.filter(s => !groupOrder.includes(s.type))

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-lg border animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="grid grid-cols-[300px_1fr] gap-8">
        {/* ====================== LEFT COLUMN ====================== */}
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border p-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1B4A8F] to-[#2563EB] flex items-center justify-center text-white text-xl font-bold shrink-0">
                {(profile?.preferred_name || profile?.legal_name || '?')[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1A1A2E]">
                  {profile?.preferred_name || profile?.legal_name || '未设置姓名'}
                </h2>
                {profile?.headline && (
                  <p className="text-sm text-[#5A6A7A]">{profile.headline}</p>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-2 pt-1 border-t">
              {profile?.email && (
                <div className="flex items-center gap-2 text-sm text-[#5A6A7A]">
                  <svg className="w-4 h-4 text-[#8E9BAE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  <span className="truncate">{profile.email}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-2 text-sm text-[#5A6A7A]">
                  <svg className="w-4 h-4 text-[#8E9BAE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 3.75v4.5m0-4.5h-4.5m4.5 0l-6 6m3 12c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" /></svg>
                  <span>{profile.phone}</span>
                </div>
              )}
              {profile?.location_city && (
                <div className="flex items-center gap-2 text-sm text-[#5A6A7A]">
                  <svg className="w-4 h-4 text-[#8E9BAE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                  <span>{profile.location_city}</span>
                </div>
              )}
              {!profile?.email && !profile?.phone && (
                <p className="text-xs text-[#8E9BAE]">上传简历后可自动识别联系方式</p>
              )}
            </div>

            {/* Target info */}
            {profile?.target_roles?.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-[11px] font-semibold text-[#8E9BAE] uppercase mb-2">求职意向</p>
                <div className="flex flex-wrap gap-1">
                  {profile.target_roles.map((r: string) => (
                    <span key={r} className="px-2 py-1 bg-[#EEF4FF] text-[#1B4A8F] text-xs rounded-md">{r}</span>
                  ))}
                </div>
                {profile.target_cities?.length > 0 && (
                  <p className="text-xs text-[#5A6A7A] mt-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                    {profile.target_cities.join(' · ')}
                  </p>
                )}
              </div>
            )}

            {/* Import button */}
            <div className="border-t pt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {uploadStage || '处理中...'}
                  </span>
                ) : '📄 导入简历'}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.md,.txt" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>
        </div>

        {/* ====================== RIGHT COLUMN ====================== */}
        <div>
          {groupOrder.length === 0 && !loading && (
            <div className="bg-white border border-dashed rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm font-medium text-[#1A1A2E] mb-1">还没有职业经历</p>
              <p className="text-xs text-[#5A6A7A]">上传简历或手动添加你的职业经历</p>
            </div>
          )}

          <div className="space-y-10">
            {groupOrder.map(type => {
              const typeMeta = EVENT_TYPE_COLORS[type] || EVENT_TYPE_COLORS.custom
              const list = (grouped[type] || []).sort((a, b) =>
                (b.time_start || '').localeCompare(a.time_start || '')
              )

              return (
                <section key={type}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 rounded-full" style={{ backgroundColor: typeMeta.bar }} />
                    <h3 className="text-base font-semibold text-[#1A1A2E]">{typeMeta.label}</h3>
                    <span className="text-sm text-[#8E9BAE]">({list.length})</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {list.map(event => (
                      <div
                        key={event.id}
                        onClick={() => openEditModal(event)}
                        className="bg-white rounded-lg border border-[#E5E7EB] p-4 hover:shadow-md hover:border-[#1B4A8F]/20 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Type icon */}
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                            style={{ backgroundColor: typeMeta.bg }}
                          >
                            {type === 'work' ? '💼' : type === 'education' ? '🎓' : type === 'project' ? '🚀' : '📌'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-[#1A1A2E] truncate">
                                {event.title || '未命名事件'}
                              </h4>
                              {event.status === 'draft' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-[#FEF3C7] text-[#D97706] rounded-full shrink-0 ml-2">待审核</span>
                              )}
                            </div>

                            {(event.organization || event.role) && (
                              <p className="text-sm text-[#5A6A7A] mt-0.5 truncate">
                                {[event.organization, event.role].filter(Boolean).join(' · ')}
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-2">
                              {(event.time_start || event.time_end) && (
                                <span className="text-xs text-[#8E9BAE]">
                                  {event.time_start || ''}{event.time_end ? ` — ${event.time_end}` : ''}
                                </span>
                              )}
                              {event.tags?.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {event.tags.map((t: string) => (
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#5A6A7A] rounded">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {event.description && (
                              <p className="text-xs text-[#5A6A7A] mt-2 line-clamp-2">{event.description}</p>
                            )}
                          </div>

                          {/* Hover indicator */}
                          <svg className="w-4 h-4 text-[#D0D5DD] group-hover:text-[#1B4A8F] shrink-0 mt-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          {/* ===== Add Section ===== */}
          <div className="mt-10 pt-6 border-t border-dashed">
            <p className="text-[11px] font-semibold text-[#8E9BAE] uppercase mb-3">添加 Section</p>
            <div className="flex gap-3">
              {ADDABLE_SECTIONS.map(s => (
                <button
                  key={s.type}
                  onClick={() => handleAddSection(s.type)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#D0D5DD] rounded-lg text-sm text-[#5A6A7A] hover:border-[#1B4A8F] hover:text-[#1B4A8F] hover:bg-[#EEF4FF] transition-all"
                >
                  <span className="text-base">{s.icon}</span>
                  <span>+ {s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Edit Modal ===== */}
      <EventEditModal
        event={editingEvent}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEvent(null) }}
        onSave={handleSaveEvent}
        onConfirm={handleConfirmEvent}
        onDelete={() => {
          if (editingEvent) handleRemoveEvent(editingEvent.id)
          setModalOpen(false)
          setEditingEvent(null)
        }}
      />

      {/* ===== Toast ===== */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-[60] ${toast.type === 'error' ? 'bg-[#DC2626] text-white' : 'bg-[#1A1A2E] text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
