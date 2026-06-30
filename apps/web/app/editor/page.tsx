'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getArtifacts, getArtifact, getArtifactVersions, saveArtifactVersion,
  updateArtifact, deleteArtifact,
} from '@/lib/api-client'

const AI_PRESETS = [
  { id: 'concise', label: '更简洁', prompt: 'Make it more concise' },
  { id: 'verbs', label: '更强调动作', prompt: 'Use stronger action verbs' },
  { id: 'keywords', label: '添加 JD 关键词', prompt: 'Add JD keywords from target role' },
  { id: 'compress', label: '压缩到一页', prompt: 'Compress to one page' },
]

export default function EditorPage() {
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [artifact, setArtifact] = useState<any>(null)
  const [versions, setVersions] = useState<any[]>([])
  const [currentVersion, setCurrentVersion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState('ats_classic')
  const [aiPrompt, setAiPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')

  const loadArtifacts = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getArtifacts()
      const items = res.data || []
      setArtifacts(items)
      if (items[0] && !selectedId) {
        setSelectedId(items[0].id)
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadArtifacts() }, [loadArtifacts])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const [artRes, verRes] = await Promise.all([
        getArtifact(id),
        getArtifactVersions(id),
      ])
      const art = (artRes as any).data
      setArtifact(art)
      setVersions((verRes as any).data || [])
      setCurrentVersion(art?.current_version || null)
      setTemplate(art?.template || 'ats_classic')
    } catch { setArtifact(null) }
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const handleSaveVersion = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await saveArtifactVersion(selectedId, {
        structured_json: currentVersion?.structured_json || {},
        markdown: currentVersion?.markdown,
        change_summary: aiPrompt || '手动保存',
      })
      loadDetail(selectedId)
      setAiPrompt('')
    } catch {} finally { setSaving(false) }
  }

  const handleApplyAIPreset = async (prompt: string) => {
    setAiPrompt(prompt)
    // AI edit is not implemented yet — save current version as a record
    await handleSaveVersion()
  }

  const handleDeleteArtifact = async (id: string) => {
    try {
      await deleteArtifact(id)
      setSelectedId('')
      loadArtifacts()
    } catch {}
  }

  const handleUpdateTitle = async () => {
    if (!selectedId || !titleValue.trim()) return
    try {
      await updateArtifact(selectedId, { title: titleValue.trim() })
      setEditingTitle(false)
      loadDetail(selectedId)
      loadArtifacts()
    } catch {}
  }

  // Build A4 preview from structured JSON
  const buildPreviewContent = () => {
    if (!currentVersion?.structured_json) return null
    const s = currentVersion.structured_json
    return {
      summary: s.summary || '',
      experience: s.experience || [],
      projects: s.projects || [],
      skills: s.skills || [],
      contact: s.contact || {},
      courses: s.courses || [],
      awards: s.awards || [],
    }
  }

  const preview = buildPreviewContent()

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">编辑器</h1>
          <p className="text-[13px] text-app-muted mt-1.5">结构化编辑、版本历史、来源查看、验证导出。</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={template} onChange={e => { setTemplate(e.target.value); if (selectedId) updateArtifact(selectedId, { template: e.target.value }).catch(() => {}) }} className="input w-[150px] h-[34px] text-sm">
            <option value="ats_classic">ATS 经典</option>
            <option value="modern">工程师现代</option>
          </select>
          <button className="btn text-xs" onClick={handleSaveVersion} disabled={saving || !selectedId}>
            {saving ? '保存中...' : '保存版本'}
          </button>
          <button className="btn primary text-xs" onClick={() => loadArtifacts()}>刷新</button>
        </div>
      </div>

      <div className="grid grid-cols-[240px_minmax(0,1fr)_330px] gap-4 items-start">
        {/* Document list */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">文档列表</h2>
            <span className="badge-gray">{artifacts.length}</span>
          </div>
          <div className="p-3 space-y-2">
            {loading && <p className="text-xs text-app-muted px-2">加载中...</p>}
            {!loading && artifacts.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-app-muted">暂无文档</p>
                <p className="text-xs text-app-muted mt-1">去生成页创建你的第一份文档</p>
              </div>
            )}
            {artifacts.map(doc => {
              const typeLabel: Record<string, string> = { resume: '简历', cover_letter: '求职信', boss_opening: '打招呼', referral_qa: '内推' }
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-2 p-2.5 rounded-[14px] cursor-pointer transition-colors ${
                    selectedId === doc.id ? 'bg-[#eaf0ff] border border-app-blue/20' : 'bg-[#f8f4ef] border border-transparent'
                  }`}
                >
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => setSelectedId(doc.id)}
                  >
                    <h3 className="text-sm font-semibold truncate">{doc.title}</h3>
                    <p className="text-[11px] text-app-muted">
                      {typeLabel[doc.artifact_type] || doc.artifact_type} · {doc.template}
                    </p>
                  </div>
                  <button
                    className="text-[10px] text-red-400 hover:text-red-600 font-bold flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDeleteArtifact(doc.id) }}
                    title="删除"
                  >
                    删除
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* A4 Preview */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold">A4 预览</h2>
              {artifact && (
                editingTitle ? (
                  <div className="flex gap-1">
                    <input
                      className="input text-xs h-6 w-48"
                      value={titleValue}
                      onChange={e => setTitleValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdateTitle() }}
                      autoFocus
                    />
                    <button className="btn primary text-[10px] h-6 px-2" onClick={handleUpdateTitle}>保存</button>
                    <button className="btn text-[10px] h-6 px-2" onClick={() => setEditingTitle(false)}>取消</button>
                  </div>
                ) : (
                  <span
                    className="text-xs text-app-muted cursor-pointer hover:text-app-blue"
                    onClick={() => { setEditingTitle(true); setTitleValue(artifact.title) }}
                    title="点击编辑标题"
                  >
                    {artifact.title}
                  </span>
                )
              )}
            </div>
            {currentVersion && (
              <span className="badge-gray">版本 {currentVersion.version_number}</span>
            )}
          </div>
          <div className="p-[40px] max-w-[680px] mx-auto">
            {!artifact ? (
              <div className="text-center py-12">
                <p className="text-xs text-app-muted">选择左侧文档查看预览</p>
              </div>
            ) : !preview ? (
              <div className="text-center py-12">
                <p className="text-sm font-black">暂无内容</p>
                <p className="text-xs text-app-muted mt-2">此文档尚未包含结构化内容。</p>
              </div>
            ) : (
              <>
                {/* Contact */}
                {preview.contact && (
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-bold tracking-tight">{preview.contact.name || '姓名'}</h1>
                    <p className="text-xs text-app-muted mt-1">
                      {[preview.contact.email, preview.contact.phone, preview.contact.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}

                {/* Summary */}
                {preview.summary && (
                  <div className="mb-4">
                    <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2">个人简介</h2>
                    <p className="text-xs leading-relaxed">{preview.summary}</p>
                  </div>
                )}

                {/* Experience */}
                {preview.experience.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2">工作经历</h2>
                    {preview.experience.map((exp: any, i: number) => (
                      <div key={i} className="mb-3">
                        <p className="text-xs font-bold">{exp.role || exp.title} — {exp.organization}</p>
                        <p className="text-[10px] text-app-muted">{[exp.time_start, exp.time_end].filter(Boolean).join(' — ')}</p>
                        {(exp.bullets || []).length > 0 ? (
                          <ul className="text-xs space-y-0.5 mt-1">
                            {exp.bullets.map((b: string, j: number) => (
                              <li key={j}>• {b}</li>
                            ))}
                          </ul>
                        ) : exp.description ? (
                          <p className="text-xs mt-0.5">{exp.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Projects */}
                {preview.projects.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2">项目经历</h2>
                    {preview.projects.map((proj: any, i: number) => (
                      <div key={i} className="mb-2">
                        <p className="text-xs font-bold">{proj.title}</p>
                        {(proj.bullets || []).length > 0 && (
                          <ul className="text-xs space-y-0.5 mt-0.5">
                            {proj.bullets.map((b: string, j: number) => (
                              <li key={j}>• {b}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Skills */}
                {preview.skills.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2">技能</h2>
                    <p className="text-xs leading-relaxed">{preview.skills.join(' · ')}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* AI Edit Assistant + Versions */}
        <div className="space-y-3">
          {/* AI Edit */}
          <div className="app-card">
            <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">AI 编辑</h2>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                className="input min-h-[80px] resize-y text-sm"
                placeholder="输入编辑指令，如：让 PM Agent 的描述更简洁"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
              />
              <button className="btn primary w-full text-xs" onClick={handleSaveVersion} disabled={saving || !selectedId}>
                {saving ? '保存中...' : '保存当前版本'}
              </button>
              <div className="h-px bg-app-line-soft" />
              {AI_PRESETS.map(action => (
                <button
                  key={action.id}
                  className="btn w-full text-xs"
                  onClick={() => handleApplyAIPreset(action.prompt)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Version history */}
          <div className="app-card">
            <div className="px-4 py-3.5 border-b border-app-line">
              <h2 className="text-[17px] font-semibold">版本历史</h2>
            </div>
            <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
              {versions.length > 0 ? versions.map((v: any) => (
                <div
                  key={v.id}
                  className={`rounded-[12px] p-2.5 cursor-pointer transition-colors ${
                    currentVersion?.id === v.id ? 'bg-[#eaf0ff] border border-app-blue/20' : 'bg-[#f8f4ef] border border-transparent'
                  }`}
                  onClick={() => setCurrentVersion(v)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">v{v.version_number}</span>
                    <span className="text-[10px] text-app-muted">{v.created_by}</span>
                  </div>
                  <p className="text-[11px] text-app-muted mt-0.5 truncate">{v.change_summary || '—'}</p>
                </div>
              )) : (
                <p className="text-xs text-app-muted">暂无版本记录</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
