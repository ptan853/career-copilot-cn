'use client'

import { useState, useEffect, useCallback } from 'react'
import { getJobs, getEvidenceMap, generateArtifact, getArtifact } from '@/lib/api-client'

const SECTIONS_ALL = [
  { id: 'contact', label: '联系方式' },
  { id: 'summary', label: '个人简介' },
  { id: 'experience', label: '工作经历' },
  { id: 'projects', label: '项目经历' },
  { id: 'skills', label: '技能' },
  { id: 'courses', label: '课程' },
  { id: 'awards', label: '奖项' },
]

export default function GeneratePage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [evidenceMap, setEvidenceMap] = useState<any>(null)
  const [docType, setDocType] = useState('resume')
  const [language, setLanguage] = useState('zh-CN')
  const [template, setTemplate] = useState('ats_classic')
  const [strictness, setStrictness] = useState('confirmed')
  const [checked, setChecked] = useState(['contact', 'summary', 'experience', 'projects', 'skills'])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getJobs().then((r: any) => setJobs(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const loadEvidenceMap = useCallback(async (jobId: string) => {
    if (!jobId) return
    try {
      const res: any = await getEvidenceMap(jobId)
      setEvidenceMap(res.data)
    } catch { setEvidenceMap(null) }
  }, [])

  useEffect(() => {
    if (selectedJobId) loadEvidenceMap(selectedJobId)
  }, [selectedJobId, loadEvidenceMap])

  const toggle = (id: string) => {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleGenerate = async () => {
    if (!selectedJobId) { setError('请先选择目标岗位'); return }
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const res: any = await generateArtifact({
        job_target_id: selectedJobId,
        doc_type: docType,
        language,
        template,
        sections: checked,
        evidence_strictness: strictness,
      })
      setResult(res.data)
    } catch (e: any) {
      setError(e.message || '生成失败')
    } finally { setGenerating(false) }
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId)
  const hasEvidence = evidenceMap && (evidenceMap.selected_event_ids || []).length > 0
  const currentVersion = result?.current_version
  const structured = currentVersion?.structured_json || {}

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">生成</h1>
          <p className="text-[13px] text-app-muted mt-1.5">从已确认的证据出发生成文档，而非靠直觉拼凑。</p>
        </div>
        <button className="btn primary" onClick={handleGenerate} disabled={generating || !selectedJobId}>
          {generating ? '生成中...' : '生成文档'}
        </button>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-4 items-start">
        {/* Left column */}
        <div className="space-y-3">
          {/* Document type */}
          <div className="app-card">
            <div className="px-4 py-3.5 border-b border-app-line">
              <h2 className="text-[17px] font-semibold">文档类型</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { id: 'resume', label: '简历', sub: '单页定制' },
                { id: 'cover_letter', label: '求职信', sub: '' },
                { id: 'boss_opening', label: 'BOSS 打招呼', sub: '' },
                { id: 'referral_qa', label: '内推问答', sub: '' },
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setDocType(d.id)}
                  className={'h-16 border rounded-[14px] flex flex-col items-center justify-center font-semibold text-sm transition-all ' +
                    (docType === d.id ? 'bg-app-blue text-white border-app-blue' : 'bg-white border-app-line text-app-ink hover:border-app-blue')}
                >
                  {d.label}
                  {d.sub && <span className="text-[11px] font-normal opacity-70">{d.sub}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="app-card">
            <div className="px-4 py-3.5 border-b border-app-line">
              <h2 className="text-[17px] font-semibold">生成参数</h2>
            </div>
            <div className="p-4 space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">目标岗位</span>
                {loading ? (
                  <p className="text-xs text-app-muted">加载岗位列表...</p>
                ) : jobs.length === 0 ? (
                  <p className="text-xs text-app-muted">暂无岗位，请先添加</p>
                ) : (
                  <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="input h-[34px] text-sm">
                    <option value="">选择岗位...</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{[j.company, j.role].filter(Boolean).join(' · ') || '未命名岗位'}</option>
                    ))}
                  </select>
                )}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">语言</span>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="input h-[34px] text-sm">
                  <option value="zh-CN">中文简历</option>
                  <option value="en-US">英文简历</option>
                  <option value="bilingual">中英双语</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">模板</span>
                <select value={template} onChange={e => setTemplate(e.target.value)} className="input h-[34px] text-sm">
                  <option value="ats_classic">ATS 经典</option>
                  <option value="modern">工程师现代</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">证据严格度</span>
                <select value={strictness} onChange={e => setStrictness(e.target.value)} className="input h-[34px] text-sm">
                  <option value="confirmed">仅已确认</option>
                  <option value="allow_weak">允许弱证据</option>
                </select>
              </label>
            </div>
          </div>

          {/* Sections */}
          <div className="app-card">
            <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">简历板块</h2>
            </div>
            <div className="p-4 space-y-2.5">
              {SECTIONS_ALL.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={checked.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Evidence status */}
          {selectedJobId && (
            <div className="app-card p-4">
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">证据状态</h3>
              {evidenceMap === undefined ? (
                <p className="text-xs text-app-muted">加载中...</p>
              ) : !evidenceMap ? (
                <div>
                  <p className="text-xs text-app-muted">尚未执行证据映射</p>
                  <p className="text-xs text-app-muted mt-1">建议先在证据映射页完成匹配后再生成。</p>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <p>已选事件: <strong className="text-app-green">{evidenceMap.selected_event_ids?.length || 0}</strong></p>
                  <p>证据缺口: <strong className="text-app-amber">{Object.keys(evidenceMap.gaps || {}).length}</strong></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — Plan preview */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">生成预览</h2>
            {result && <span className="badge-green">已生成</span>}
          </div>
          <div className="p-4 space-y-4">
            {!result && !generating && (
              <div className="rounded-[20px] border border-dashed border-app-line bg-app-panel-soft p-8 text-center">
                <p className="text-sm font-black">选择岗位后点击"生成文档"</p>
                <p className="mt-2 text-xs text-app-muted">系统会基于证据映射自动组装结构化简历内容。</p>
                {!selectedJobId && (
                  <p className="mt-3 text-xs text-app-muted">请从左侧选择一个目标岗位。</p>
                )}
              </div>
            )}

            {generating && (
              <div className="rounded-[20px] border border-dashed border-app-line bg-app-panel-soft p-8 text-center">
                <p className="text-sm font-black">正在生成...</p>
                <p className="mt-2 text-xs text-app-muted">从证据映射中提取已选中事件和声明。</p>
              </div>
            )}

            {error && (
              <div className="rounded-[16px] bg-[#fdecec] p-4 text-sm text-app-red">{error}</div>
            )}

            {result && (
              <>
                {/* Meta */}
                <div className="flex gap-3 text-sm">
                  <div><span className="text-xs text-app-muted">标题</span><p className="font-semibold">{result.title}</p></div>
                  <div><span className="text-xs text-app-muted">模板</span><p>{result.template}</p></div>
                  <div><span className="text-xs text-app-muted">语言</span><p>{result.language}</p></div>
                </div>

                <div className="h-px bg-app-line-soft" />

                {/* Summary */}
                {structured.summary && (
                  <div className="p-3.5 rounded-[16px] bg-app-panel-soft">
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">个人简介</h3>
                    <p className="text-sm">{structured.summary}</p>
                  </div>
                )}

                {/* Selected sections */}
                <div className="flex gap-1.5 flex-wrap">
                  {checked.map(id => {
                    const sec = SECTIONS_ALL.find(s => s.id === id)
                    return sec ? <span key={id} className="badge-blue">{sec.label}</span> : null
                  })}
                </div>

                {/* Experience */}
                {(structured.experience || []).length > 0 && (
                  <div className="rounded-[16px] bg-white border border-app-line-soft p-3.5">
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">
                      工作经历 ({(structured.experience || []).length} 条)
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-app-line-soft">
                          <th className="text-left py-2 text-xs text-app-muted font-extrabold">事件</th>
                          <th className="text-left py-2 text-xs text-app-muted font-extrabold">组织</th>
                          <th className="text-left py-2 text-xs text-app-muted font-extrabold">声明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {structured.experience.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-app-line-soft last:border-0">
                            <td className="py-2 pr-3 text-sm font-semibold">{row.title}</td>
                            <td className="py-2 pr-3 text-sm text-app-muted">{row.organization || '—'}</td>
                            <td className="py-2 text-sm text-app-muted">{(row.bullets || []).length} 条</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Skills */}
                {(structured.skills || []).length > 0 && (
                  <div className="rounded-[16px] bg-white border border-app-line-soft p-3.5">
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">技能关键词</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {structured.skills.map((s: string, i: number) => (
                        <span key={i} className="badge-gray text-[11px]">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
