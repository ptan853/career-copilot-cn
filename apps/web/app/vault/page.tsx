'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import AppShell from '@/components/app-shell'
import ReviewCard, { type EventData } from '@/components/review-card'
import { EVENT_TYPE_COLORS, EVENT_STATUS_CONFIG } from '@/lib/event-constants'
import { getEvents, updateEvent, confirmEvent, archiveEvent, uploadSource, getJob } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type SidebarTab = 'review' | 'timeline' | 'sources'

export default function VaultPage() {
  const [events, setEvents] = useState<EventData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<SidebarTab>('review')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (filterType) params.type = filterType
      if (filterStatus) params.status = filterStatus
      const data = await getEvents(params)
      setEvents(data)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus])

  // Initial load
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Poll job status
  const pollJob = async (jobId: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const job = await getJob(jobId)
        if (job.status === 'completed') {
          showToast(`解析完成，新增 ${job.result?.event_count || 0} 条事件`)
          setUploadStage(null)
          setUploading(false)
          fetchEvents()
          return
        }
        if (job.status === 'failed') {
          showToast(`解析失败: ${job.error || '未知错误'}`, 'error')
          setUploadStage(null)
          setUploading(false)
          return
        }
        // still running — update stage text
        if (i === 1) setUploadStage('AI 正在解析...')
        if (i > 10) setUploadStage('仍在处理中，请耐心等待...')
      } catch {
        // polling error, keep trying
      }
    }
    showToast('解析超时，请稍后刷新页面查看', 'error')
    setUploadStage(null)
    setUploading(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/markdown',
      'text/plain',
    ]
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(md|txt)$/i)) {
      showToast('不支持的文件类型，请上传 PDF / DOCX / Markdown / TXT', 'error')
      return
    }

    setUploading(true)
    setUploadStage('上传中...')
    try {
      const { job_id, source_id } = await uploadSource(file)
      showToast('文件已上传，开始解析')
      setUploadStage('提取文本...')
      pollJob(job_id)
    } catch (err: any) {
      showToast(err.message || '上传失败', 'error')
      setUploading(false)
      setUploadStage(null)
    }
  }

  const handleConfirm = async (id: string) => {
    try {
      await confirmEvent(id)
      showToast('已确认')
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'confirmed' as const } : e))
      )
    } catch {
      showToast('操作失败', 'error')
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await archiveEvent(id)
      showToast('已归档')
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'archived' as const } : e))
      )
    } catch {
      showToast('操作失败', 'error')
    }
  }

  const handleUpdate = async (id: string, field: string, value: string) => {
    try {
      await updateEvent(id, { [field]: value })
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
      )
      showToast('已更新')
    } catch {
      showToast('更新失败', 'error')
    }
  }

  const stats = {
    total: events.length,
    draft: events.filter((e) => e.status === 'draft').length,
    confirmed: events.filter((e) => e.status === 'confirmed').length,
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-[#1B4A8F] uppercase tracking-wider">CAREER VAULT</p>
          <h1 className="text-2xl font-bold text-[#1A1A2E] mt-1">职业档案库</h1>
        </div>
        <div className="flex items-center gap-3">
          {uploadStage && (
            <span className="text-xs text-[#5A6A7A] animate-pulse">{uploadStage}</span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {uploading ? '处理中...' : '上传材料'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.md,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Nav */}
          <nav className="space-y-0.5">
            {[
              { key: 'review' as const, label: '审核队列', badge: stats.draft },
              { key: 'timeline' as const, label: '时间轴' },
              { key: 'sources' as const, label: '原始材料' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors',
                  tab === item.key
                    ? 'bg-[#EEF4FF] text-[#1B4A8F] font-medium'
                    : 'text-[#5A6A7A] hover:bg-gray-100'
                )}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium',
                      tab === item.key
                        ? 'bg-[#1B4A8F] text-white'
                        : 'bg-[#E5E7EB] text-[#5A6A7A]'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Filters — only on review tab */}
          {tab === 'review' && (
            <div className="space-y-3 pt-2 border-t border-[#E5E7EB]">
              <p className="text-[11px] font-semibold text-[#8E9BAE] uppercase">筛选</p>

              {/* Type filter */}
              <div>
                <p className="text-[11px] text-[#8E9BAE] mb-1.5">事件类型</p>
                <div className="space-y-0.5">
                  <FilterChip
                    active={filterType === ''}
                    onClick={() => setFilterType('')}
                    label="全部"
                  />
                  {Object.entries(EVENT_TYPE_COLORS).map(([key, meta]) => (
                    <FilterChip
                      key={key}
                      active={filterType === key}
                      onClick={() => setFilterType(filterType === key ? '' : key)}
                      label={meta.label}
                      color={meta.bar}
                    />
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div>
                <p className="text-[11px] text-[#8E9BAE] mb-1.5">状态</p>
                <div className="space-y-0.5">
                  <FilterChip
                    active={filterStatus === ''}
                    onClick={() => setFilterStatus('')}
                    label="全部"
                  />
                  {Object.entries(EVENT_STATUS_CONFIG).map(([key, meta]) => (
                    <FilterChip
                      key={key}
                      active={filterStatus === key}
                      onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                      label={meta.label}
                      color={meta.color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard count={stats.total} label="全部事件" color="#1B4A8F" />
            <StatCard count={stats.draft} label="待审核" color="#D97706" />
            <StatCard count={stats.confirmed} label="已确认" color="#059669" />
          </div>

          {/* Events list */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[60px] bg-white rounded-lg border border-[#E5E7EB] animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 text-sm text-[#991B1B]">
              {error}
              <button onClick={fetchEvents} className="ml-3 underline font-medium">重试</button>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="bg-white border border-dashed border-[#D0D5DD] rounded-lg p-12 text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-sm font-medium text-[#1A1A2E] mb-1">
                {filterType || filterStatus ? '筛选条件无匹配结果' : '还没有职业事件'}
              </p>
              <p className="text-xs text-[#8E9BAE] mb-4">
                {filterType || filterStatus
                  ? '尝试调整筛选条件'
                  : '上传你的简历，AI 会自动提取工作经历、教育背景等事件'}
              </p>
              {!filterType && !filterStatus && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex px-4 py-2 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] transition-colors"
                >
                  上传简历
                </button>
              )}
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="space-y-2">
              {events.map((event) => (
                <ReviewCard
                  key={event.id}
                  event={event}
                  onConfirm={handleConfirm}
                  onArchive={handleArchive}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 transition-all',
            toast.type === 'error'
              ? 'bg-[#DC2626] text-white'
              : 'bg-[#1A1A2E] text-white'
          )}
        >
          {toast.message}
        </div>
      )}
    </AppShell>
  )
}

function StatCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] px-4 py-3">
      <p className="text-2xl font-bold" style={{ color }}>{count}</p>
      <p className="text-xs text-[#8E9BAE] mt-0.5">{label}</p>
    </div>
  )
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors',
        active ? 'bg-[#EEF4FF] text-[#1B4A8F] font-medium' : 'text-[#5A6A7A] hover:bg-gray-100'
      )}
    >
      {color && (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      <span>{label}</span>
    </button>
  )
}
