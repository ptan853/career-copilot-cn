'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getJobs, createJob, deleteJob, updateJob } from '@/lib/api-client'

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  high:   { label: '高优先', cls: 'badge-red' },
  normal: { label: '普通', cls: 'badge-amber' },
  low:    { label: '低优先', cls: 'badge-gray' },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: '草稿', cls: 'badge-gray' },
  analyzing: { label: '分析中', cls: 'badge-blue' },
  ready:     { label: '就绪', cls: 'badge-green' },
  generating:{ label: '生成中', cls: 'badge-cyan' },
  applied:   { label: '已投递', cls: 'badge-blue' },
  archived:  { label: '已归档', cls: 'badge-gray' },
}

const CHANNELS = ['boss', 'liepin', 'zhilian', '51job', 'lagou', 'niuke', 'shixiseng', 'maimai', 'company_site', 'other'] as const

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({ role: '', company: '', channel: '', priority: 'normal', raw_jd: '', source_url: '' })

  const load = async () => {
    try {
      const res: any = await getJobs()
      setJobs(res.data || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.role && !form.company && !form.raw_jd) return
    setSaving(true)
    try {
      await createJob({
        role: form.role || undefined,
        company: form.company || undefined,
        channel: form.channel || 'company_site',
        priority: form.priority as any || 'normal',
        raw_jd: form.raw_jd || undefined,
        source_url: form.source_url || undefined,
      })
      setForm({ role: '', company: '', channel: '', priority: 'normal', raw_jd: '', source_url: '' })
      setShowCreate(false)
      load()
    } catch {} finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个岗位吗？')) return
    try { await deleteJob(id); load() } catch {}
  }

  const handleArchive = async (id: string) => {
    await updateJob(id, { status: 'archived' })
    load()
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">岗位库</h1>
          <p className="text-[13px] text-app-muted mt-1.5">管理你的目标岗位。为每个岗位分析 JD、映射证据、生成定向材料。</p>
        </div>
        <button className="btn primary" onClick={() => setShowCreate(true)}>添加岗位</button>
      </div>

      {showCreate && (
        <div className="app-card p-5 mb-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">新增目标岗位</h2>
            <button className="text-sm font-black text-app-muted hover:text-app-ink" onClick={() => setShowCreate(false)}>关闭</button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})} placeholder="岗位名称，例如：Agent Harness Engineer" />
              <input className="input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="公司，例如：DeepSeek" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={form.channel} onChange={e => setForm({...form, channel: e.target.value})}>
                <option value="">选择渠道</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="low">低优先</option>
                <option value="normal">普通</option>
                <option value="high">高优先</option>
              </select>
            </div>
            <input className="input" value={form.source_url} onChange={e => setForm({...form, source_url: e.target.value})} placeholder="岗位链接（可选）" />
            <textarea
              className="input min-h-[120px] resize-y"
              value={form.raw_jd}
              onChange={e => setForm({...form, raw_jd: e.target.value})}
              placeholder="粘贴 JD 全文，例如 BOSS 直聘 / 拉勾 / 猎聘的岗位描述..."
            />
            <button className="btn primary w-full" onClick={handleCreate} disabled={saving || (!form.role && !form.company && !form.raw_jd)}>
              {saving ? '保存中...' : '保存岗位'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {loading && <p className="text-sm text-app-muted">正在加载...</p>}
        {!loading && jobs.length === 0 && (
          <div className="app-card p-8 text-center">
            <p className="text-lg font-black">还没有目标岗位</p>
            <p className="mt-2 text-sm text-app-muted">添加 BOSS/拉勾/猎聘等渠道的岗位描述，开始分析和匹配。</p>
            <button className="btn primary mt-5" onClick={() => setShowCreate(true)}>添加第一个岗位</button>
          </div>
        )}
        {jobs.map(job => {
          const priority = PRIORITY_CONFIG[job.priority] || PRIORITY_CONFIG.normal
          const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft
          const title = job.role || job.company || '未命名岗位'
          const subtitle = [job.company, job.city].filter(Boolean).join(' · ') || '未填写公司'
          return (
            <div
              key={job.id}
              className="app-card p-4 flex items-center justify-between gap-6 hover:shadow-panel transition-all"
            >
              <Link href={`/jobs/${job.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-lg bg-app-panel-soft border border-app-line grid place-items-center text-app-blue font-extrabold text-lg shrink-0">
                  {subtitle[0] || '?'}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate">{title}</h2>
                  <p className="text-xs text-app-muted mt-0.5 truncate">{subtitle}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    {job.channel && <span className="text-[11px] text-app-muted">{job.channel}</span>}
                    {job.deadline && <><span className="text-[11px] text-app-muted">·</span><span className="text-[11px] text-app-muted">截止 {job.deadline.slice(0, 10)}</span></>}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className={priority.cls}>{priority.label}</span>
                <span className={status.cls}>{status.label}</span>
                <div className="flex gap-1 ml-1">
                  <button className="text-[11px] text-app-muted hover:text-app-ink px-1" onClick={() => handleArchive(job.id)} title="归档">归档</button>
                  <button className="text-[11px] text-app-red hover:text-red-700 px-1" onClick={() => handleDelete(job.id)} title="删除">删除</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
