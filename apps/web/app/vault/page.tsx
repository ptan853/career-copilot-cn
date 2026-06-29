'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type EventData } from '@/components/review-card'
import { EVENT_TYPE_COLORS } from '@/lib/event-constants'
import { getEvents, updateEvent, confirmEvent, archiveEvent, uploadSource, getJob, getProfile, updateProfile } from '@/lib/api-client'

export default function ProfilePage() {
  const [events, setEvents] = useState<EventData[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
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
        getEvents({ status: 'confirmed' }).catch(() => []),
        getProfile().catch(() => ({ profile: null })),
      ])
      setEvents(evts || [])
      setProfile(prof?.profile || null)
    } catch {
      setError('加载失败')
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
          showToast(`解析完成`)
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
        if (i === 1) setUploadStage('提取文本...')
        else if (i === 3) setUploadStage('AI 正在分析...')
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

  const handleConfirmEvent = async (id: string) => {
    try {
      await confirmEvent(id)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'confirmed' as const } : e))
      showToast('已确认')
    } catch { showToast('操作失败', 'error') }
  }

  const handleSaveEvent = async (id: string, fields: Record<string, string>) => {
    try {
      await updateEvent(id, fields)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e))
      setEditingEventId(null)
      showToast('已保存')
    } catch { showToast('保存失败', 'error') }
  }

  const handleSaveProfile = async () => {
    try {
      await updateProfile(profile)
      setEditingProfile(false)
      showToast('已保存')
    } catch { showToast('保存失败', 'error') }
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-lg border animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="grid grid-cols-[320px_1fr] gap-8">
        {/* ===== LEFT: Profile Card ===== */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1B4A8F] to-[#2563EB] flex items-center justify-center text-white text-xl font-bold shrink-0">
                {(profile?.preferred_name || profile?.legal_name || '?')[0]}
              </div>
              <div className="min-w-0">
                {editingProfile ? (
                  <div className="space-y-2">
                    <input
                      value={profile?.legal_name || ''}
                      onChange={e => setProfile({ ...profile, legal_name: e.target.value })}
                      placeholder="姓名"
                      className="w-full px-2 py-1 text-sm border rounded"
                    />
                    <input
                      value={profile?.preferred_name || ''}
                      onChange={e => setProfile({ ...profile, preferred_name: e.target.value })}
                      placeholder="Preferred name"
                      className="w-full px-2 py-1 text-sm border rounded"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-[#1A1A2E]">
                      {profile?.preferred_name || profile?.legal_name || '未设置姓名'}
                    </h2>
                    {profile?.headline && (
                      <p className="text-sm text-[#5A6A7A] truncate">{profile.headline}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-2.5">
              {editingProfile ? (
                <>
                  <input value={profile?.headline || ''} onChange={e => setProfile({...profile, headline: e.target.value})} placeholder="一句话介绍" className="w-full px-2 py-1 text-sm border rounded" />
                  <input value={profile?.email || ''} onChange={e => setProfile({...profile, email: e.target.value})} placeholder="邮箱" className="w-full px-2 py-1 text-sm border rounded" />
                  <input value={profile?.phone || ''} onChange={e => setProfile({...profile, phone: e.target.value})} placeholder="手机号" className="w-full px-2 py-1 text-sm border rounded" />
                  <input value={profile?.location_city || ''} onChange={e => setProfile({...profile, location_city: e.target.value})} placeholder="所在城市" className="w-full px-2 py-1 text-sm border rounded" />
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveProfile} className="px-3 py-1.5 bg-[#1B4A8F] text-white rounded text-xs font-medium">保存</button>
                    <button onClick={() => setEditingProfile(false)} className="px-3 py-1.5 border rounded text-xs">取消</button>
                  </div>
                </>
              ) : (
                <>
                  {profile?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-[#8E9BAE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                      <span className="text-[#5A6A7A] truncate">{profile.email}</span>
                    </div>
                  )}
                  {profile?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-[#8E9BAE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 3.75v4.5m0-4.5h-4.5m4.5 0l-6 6m3 12c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" /></svg>
                      <span className="text-[#5A6A7A]">{profile.phone}</span>
                    </div>
                  )}
                  {profile?.location_city && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-[#8E9BAE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                      <span className="text-[#5A6A7A]">{profile.location_city}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Target */}
            {profile?.target_roles?.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-[11px] font-semibold text-[#8E9BAE] uppercase mb-2">求职意向</p>
                <div className="space-y-1.5">
                  {profile.target_roles.map((r: string) => (
                    <span key={r} className="inline-block px-2 py-1 bg-[#EEF4FF] text-[#1B4A8F] text-xs rounded mr-1 mb-1">{r}</span>
                  ))}
                </div>
                {profile.target_cities?.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-[#5A6A7A]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                    <span>{profile.target_cities.join(' · ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-3 space-y-1">
              <button
                onClick={() => setEditingProfile(!editingProfile)}
                className="w-full text-left px-3 py-2 text-sm text-[#5A6A7A] hover:bg-gray-50 rounded-md transition-colors"
              >
                ✏️ 编辑资料
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full text-left px-3 py-2 text-sm text-[#5A6A7A] hover:bg-gray-50 rounded-md transition-colors"
              >
                {uploading ? `⏳ ${uploadStage || '处理中...'}` : '📄 导入简历'}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.md,.txt" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>
        </div>

        {/* ===== RIGHT: Timeline ===== */}
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#1A1A2E]">职业经历</h2>
          </div>

          {/* Empty state */}
          {groupOrder.length === 0 && (
            <div className="bg-white border border-dashed border-[#D0D5DD] rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm font-medium text-[#1A1A2E] mb-1">还没有职业经历</p>
              <p className="text-xs text-[#5A6A7A] mb-4">上传你的简历，AI 会自动提取并整理</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium"
              >
                导入简历
              </button>
            </div>
          )}

          {/* Grouped timeline */}
          <div className="space-y-8">
            {groupOrder.map(type => {
              const typeMeta = EVENT_TYPE_COLORS[type] || EVENT_TYPE_COLORS.custom
              const list = (grouped[type] || []).sort((a, b) =>
                (b.time_start || '').localeCompare(a.time_start || '')
              )

              return (
                <section key={type}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-[3px] h-4 rounded-full" style={{ backgroundColor: typeMeta.bar }} />
                    <h3 className="text-sm font-semibold text-[#1A1A2E]">{typeMeta.label}</h3>
                    <span className="text-xs text-[#8E9BAE]">({list.length})</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {list.map(event => (
                      <TimelineCard
                        key={event.id}
                        event={event}
                        isEditing={editingEventId === event.id}
                        onStartEdit={() => setEditingEventId(event.id)}
                        onCancelEdit={() => setEditingEventId(null)}
                        onConfirm={() => handleConfirmEvent(event.id)}
                        onSave={(fields) => handleSaveEvent(event.id, fields)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 ${toast.type === 'error' ? 'bg-[#DC2626] text-white' : 'bg-[#1A1A2E] text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

function TimelineCard({
  event,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onConfirm,
  onSave,
}: {
  event: EventData
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onConfirm: () => void
  onSave: (fields: Record<string, string>) => void
}) {
  const typeMeta = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.custom
  const [form, setForm] = useState({ title: '', organization: '', role: '', description: '' })

  const beginEdit = () => {
    setForm({
      title: event.title || '',
      organization: event.organization || '',
      role: event.role || '',
      description: event.description || '',
    })
    onStartEdit()
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 hover:shadow-sm transition-shadow">
      {/* Date */}
      <p className="text-xs text-[#8E9BAE] mb-2">
        {event.time_start || ''}{event.time_end ? ` — ${event.time_end}` : ''}
      </p>

      {isEditing ? (
        <div className="space-y-2">
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="标题" className="w-full px-2 py-1.5 text-sm border rounded" />
          <input value={form.organization} onChange={e => setForm({...form, organization: e.target.value})} placeholder="公司/学校" className="w-full px-2 py-1.5 text-sm border rounded" />
          <input value={form.role} onChange={e => setForm({...form, role: e.target.value})} placeholder="职位/专业" className="w-full px-2 py-1.5 text-sm border rounded" />
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="描述" rows={2} className="w-full px-2 py-1.5 text-sm border rounded resize-none" />
          <div className="flex gap-2 pt-1">
            <button onClick={() => onSave(form)} className="px-3 py-1.5 bg-[#1B4A8F] text-white rounded text-xs font-medium">保存</button>
            <button onClick={onCancelEdit} className="px-3 py-1.5 border rounded text-xs">取消</button>
          </div>
        </div>
      ) : (
        <>
          <h4 className="text-sm font-semibold text-[#1A1A2E]">{event.title || '未命名事件'}</h4>
          {(event.organization || event.role) && (
            <p className="text-sm text-[#5A6A7A] mt-0.5">
              {[event.organization, event.role].filter(Boolean).join(' · ')}
            </p>
          )}
          {event.description && (
            <p className="text-sm text-[#5A6A7A] mt-2 line-clamp-2">{event.description}</p>
          )}

          {/* Tags */}
          {event.tags?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {event.tags.map((t: string) => (
                <span key={t} className="text-[11px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#5A6A7A] rounded">{t}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3 pt-2 border-t border-[#F3F4F6]">
            <button onClick={beginEdit} className="text-xs text-[#5A6A7A] hover:text-[#1B4A8F]">编辑</button>
            {event.status === 'draft' && (
              <button onClick={onConfirm} className="text-xs text-[#059669] hover:text-[#047857] font-medium">确认</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
