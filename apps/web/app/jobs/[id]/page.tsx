'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getJob, getEvidenceMap, createEvidenceMap } from '@/lib/api-client'

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  high:   { label: '高优先', cls: 'badge-red' },
  normal: { label: '普通', cls: 'badge-amber' },
  low:    { label: '低优先', cls: 'badge-gray' },
}

const EVENT_TYPE_CONFIG: Record<string, string> = {
  work: '工作', internship: '实习', project: '项目', education: '教育',
  certification: '证书', award: '获奖', publication: '发表', patent: '专利',
  course: '课程', competition: '竞赛', open_source: '开源', startup: '创业',
  volunteer: '志愿', language: '语言', custom: '其他',
}

export default function JobDetailPage() {
  const params = useParams()
  const [job, setJob] = useState<any>(null)
  const [evidenceMap, setEvidenceMap] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mapping, setMapping] = useState(false)

  const loadData = async () => {
    if (!params.id) return
    setLoading(true)
    try {
      const [jobRes, emRes] = await Promise.all([
        getJob(params.id as string),
        getEvidenceMap(params.id as string).catch(() => ({ data: null })),
      ])
      setJob((jobRes as any).data)
      setEvidenceMap((emRes as any).data)
    } catch { setJob(null) } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMap = async () => {
    if (!params.id) return
    setMapping(true)
    try {
      const res: any = await createEvidenceMap(params.id as string)
      setEvidenceMap(res.data)
    } catch {} finally { setMapping(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-app-muted">正在加载岗位详情...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-black">岗位不存在</p>
        <Link href="/jobs" className="btn primary mt-5">返回岗位库</Link>
      </div>
    )
  }

  const title = job.role || job.company || '未命名岗位'
  const jdAnalysis = job.jd_analysis

  const selectedEvents = evidenceMap?.selected_events || []
  const omittedEvents = evidenceMap?.omitted_events || []
  const gaps = evidenceMap?.gaps || {}
  const gapKeys = Object.keys(gaps)
  const hasEvidenceMap = !!evidenceMap

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">岗位详情</h1>
          <p className="text-[13px] text-app-muted mt-1.5">每个岗位都有自己的分析、证据映射和生成工作区。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/jobs" className="btn">返回岗位库</Link>
          <button className="btn primary">生成材料</button>
        </div>
      </div>

      {/* Header card */}
      <div className="app-card p-5 mb-4">
        <div className="flex justify-between gap-5">
          <div>
            <div className="flex gap-2 mb-2">
              <span className="badge-blue">{job.channel || '直接添加'}</span>
              {job.priority && <span className={PRIORITY_CONFIG[job.priority]?.cls || 'badge-gray'}>{PRIORITY_CONFIG[job.priority]?.label || job.priority}</span>}
            </div>
            <h2 className="text-[22px] font-bold">{job.company && `${job.company} · `}{title}</h2>
            <p className="text-[13px] text-app-muted mt-1.5">
              {[job.channel && `渠道: ${job.channel}`, job.city && `地点: ${job.city}`, job.deadline && `截止: ${job.deadline.slice(0, 10)}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-4 items-start">
        {/* Raw JD */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">原始 JD</h2>
            <span className="badge-gray">{job.raw_jd ? `${job.raw_jd.length} 字` : '无 JD'}</span>
          </div>
          <div className="p-4">
            {job.raw_jd ? (
              <div>
                <p className="text-sm leading-relaxed text-app-ink whitespace-pre-wrap">{job.raw_jd}</p>
                {job.source_url && (
                  <>
                    <div className="h-px bg-app-line-soft my-3.5" />
                    <a href={job.source_url} target="_blank" rel="noopener noreferrer" className="btn w-full text-xs inline-flex">查看原始来源</a>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-app-muted">还没有粘贴 JD。你可以从 BOSS 直聘、拉勾、猎聘等渠道复制岗位描述粘贴到这里。</p>
            )}
          </div>
        </div>

        {/* AI analysis */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">AI 分析</h2>
            <span className="badge-cyan">{jdAnalysis ? '已分析' : '待分析'}</span>
          </div>
          <div className="p-4 space-y-4">
            {jdAnalysis ? (
              <>
                {jdAnalysis.must_have && jdAnalysis.must_have.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">必须条件</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {jdAnalysis.must_have.map((t: string, i: number) => <span key={i} className="badge-blue">{t}</span>)}
                    </div>
                  </div>
                )}
                {jdAnalysis.nice_to_have && jdAnalysis.nice_to_have.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">加分项</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {jdAnalysis.nice_to_have.map((t: string, i: number) => <span key={i} className="badge-gray">{t}</span>)}
                    </div>
                  </div>
                )}
                {jdAnalysis.recommended_narrative && (
                  <div>
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">推荐定位方向</h3>
                    <p className="text-sm mt-1">{jdAnalysis.recommended_narrative}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[20px] border border-dashed border-app-line bg-app-panel-soft p-6 text-center">
                <p className="text-sm font-black">JD 分析尚未生成</p>
                <p className="mt-2 text-xs text-app-muted">粘贴完整的 JD 后，AI 会提取关键词、必须条件和推荐叙事方向。</p>
                <button className="btn primary mt-4 text-xs" disabled>AI 分析（即将上线）</button>
              </div>
            )}
          </div>
        </div>

        {/* Evidence mapping */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">证据映射</h2>
            <div className="flex gap-2">
              {hasEvidenceMap && (
                <button className="btn text-xs h-7" onClick={handleMap} disabled={mapping}>
                  {mapping ? '映射中...' : '重新映射'}
                </button>
              )}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {hasEvidenceMap ? (
              <div className="space-y-3">
                {selectedEvents.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">
                      已匹配 {selectedEvents.length} 条经历
                    </h3>
                    <div className="space-y-2">
                      {selectedEvents.map((ev: any) => (
                        <div key={ev.id} className="flex items-center gap-2 rounded-[14px] bg-[#f0f7f1] p-2">
                          <div className="source-dot confirmed" style={{ width: 20, height: 20, fontSize: 9 }}>✓</div>
                          <div>
                            <p className="text-sm font-semibold">{ev.title}</p>
                            <p className="text-[11px] text-app-muted">
                              {[EVENT_TYPE_CONFIG[ev.event_type], ev.organization].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {omittedEvents.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">
                      未匹配 {omittedEvents.length} 条
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {omittedEvents.map((ev: any) => (
                        <span key={ev.id} className="badge-gray text-[11px]">{ev.title}</span>
                      ))}
                    </div>
                  </div>
                )}
                {gapKeys.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">证据缺口</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {gapKeys.map(gap => (
                        <span key={gap} className="badge-amber">{gap}</span>
                      ))}
                    </div>
                  </div>
                )}
                {evidenceMap.rationale && (
                  <div className="rounded-[14px] bg-[#f8f4ef] p-3">
                    <p className="text-[11px] text-app-muted">{evidenceMap.rationale}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-app-line bg-app-panel-soft p-6 text-center">
                <p className="text-sm font-black">尚未映射证据</p>
                <p className="mt-2 text-xs text-app-muted">系统会基于 JD 关键词自动匹配你的职业经历。</p>
                {job.raw_jd ? (
                  <button className="btn primary mt-4 text-xs" onClick={handleMap} disabled={mapping}>
                    {mapping ? '映射中...' : '执行证据映射'}
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-app-muted">请先粘贴 JD 文本再执行映射</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
