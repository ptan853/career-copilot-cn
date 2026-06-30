'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getReviewQueue, confirmEvent, updateEvent, batchConfirmEvents,
  getClaims, createClaim, updateClaim, deleteClaim,
} from '@/lib/api-client'

const EVENT_TYPE_CONFIG: Record<string, string> = {
  work: '工作', internship: '实习', project: '项目', education: '教育',
  certification: '证书', award: '获奖', publication: '发表', patent: '专利',
  course: '课程', competition: '竞赛', open_source: '开源', startup: '创业',
  volunteer: '志愿', language: '语言', custom: '其他',
}

const CLAIM_TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  achievement:    { label: '成果', cls: 'badge-green' },
  skill:          { label: '技能', cls: 'badge-blue' },
  metric:         { label: '量化', cls: 'badge-amber' },
  responsibility: { label: '职责', cls: 'badge-gray' },
  credential:     { label: '资质', cls: 'badge-cyan' },
  preference:     { label: '偏好', cls: 'badge-purple' },
}

const STRENGTH_CONFIG: Record<string, { label: string; dot: string }> = {
  confirmed: { label: '明确', dot: '#34a47f' },
  inferred:  { label: '推断', dot: '#c78733' },
  weak:      { label: '薄弱', dot: '#6d7382' },
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  // Inline edit state for selected event
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Claims inline
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [newClaimText, setNewClaimText] = useState('')
  const [newClaimType, setNewClaimType] = useState('achievement')
  const [newClaimStrength, setNewClaimStrength] = useState('confirmed')
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null)
  const [editingClaimText, setEditingClaimText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getReviewQueue()
      const items = res.data || []
      setQueue(items)
      setMeta(res.meta || null)
      if (items[0] && !selected) setSelected(items[0])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Update selected when queue changes
  useEffect(() => {
    if (selected && queue.length > 0) {
      const updated = queue.find(q => q.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [queue, selected?.id])

  const handleConfirm = async (id: string) => {
    await confirmEvent(id)
    load()
    setCheckedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    setSelected(null)
  }

  const handleSkip = async (id: string) => {
    await updateEvent(id, { status: 'archived' })
    load()
    setCheckedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    setSelected(null)
  }

  const handleBatchConfirm = async () => {
    const ids = checkedIds.size > 0 ? [...checkedIds] : queue.map(e => e.id)
    setBatchLoading(true)
    try {
      await batchConfirmEvents(ids)
      setCheckedIds(new Set())
      load()
      setSelected(null)
    } catch {} finally { setBatchLoading(false) }
  }

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // Inline edit
  const startEditField = (field: string, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }

  const saveFieldEdit = async () => {
    if (!selected || !editingField) return
    try {
      await updateEvent(selected.id, { [editingField]: editValue })
      const updated = { ...selected, [editingField]: editValue }
      setSelected(updated)
      setQueue(prev => prev.map(e => e.id === selected.id ? updated : e))
      setEditingField(null)
    } catch {}
  }

  // Claim CRUD
  const handleAddClaim = async () => {
    if (!selected || !newClaimText.trim()) return
    try {
      await createClaim({ event_id: selected.id, claim_text: newClaimText.trim(), claim_type: newClaimType, strength: newClaimStrength })
      setNewClaimText('')
      setShowClaimForm(false)
      load()
    } catch {}
  }

  const handleUpdateClaim = async (claimId: string) => {
    if (!editingClaimText.trim()) return
    try {
      await updateClaim(claimId, { claim_text: editingClaimText.trim() })
      setEditingClaimId(null)
      setEditingClaimText('')
      load()
    } catch {}
  }

  const handleDeleteClaim = async (claimId: string) => {
    try { await deleteClaim(claimId); load() } catch {}
  }

  const confidenceLabel = (val: number | null | undefined) => {
    if (val == null) return { label: '未知', cls: 'badge-gray' }
    if (val >= 0.8) return { label: '高', cls: 'badge-green' }
    if (val >= 0.5) return { label: '中', cls: 'badge-amber' }
    return { label: '低', cls: 'badge-red' }
  }

  const conf = confidenceLabel(selected?.source_confidence)

  // Uncertainty checks
  const uncertaintyFlags: { key: string; label: string; cls: string; desc: string }[] = []
  if (selected) {
    if (!selected.role) uncertaintyFlags.push({ key: 'no_role', label: '缺少角色', cls: 'badge-red', desc: '未从源材料提取到职位/角色信息' })
    if (!selected.organization) uncertaintyFlags.push({ key: 'no_org', label: '缺少组织', cls: 'badge-amber', desc: '未提取到公司/学校名称' })
    if (!selected.time_start) uncertaintyFlags.push({ key: 'no_time', label: '缺少时间', cls: 'badge-amber', desc: '时间范围未明确' })
    if (!selected.description || selected.description.length < 20) uncertaintyFlags.push({ key: 'short_desc', label: '描述过短', cls: 'badge-gray', desc: '详细描述有助于后续生成更精准的简历' })
    if ((selected.source_confidence || 0) < 0.6) uncertaintyFlags.push({ key: 'low_conf', label: '低置信度', cls: 'badge-red', desc: 'AI 对此提取结果把握较低' })
    if ((selected.claims || []).length === 0) uncertaintyFlags.push({ key: 'no_claims', label: '无声明', cls: 'badge-gray', desc: '建议添加至少一条可验证的能力声明' })
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">审核队列</h1>
          <p className="text-[13px] text-app-muted mt-1.5">AI 输出保持草稿状态，直到你确认。这是超越简单简历工具的核心。</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={handleBatchConfirm} disabled={batchLoading || queue.length === 0}>
            {batchLoading ? '处理中...' : checkedIds.size > 0 ? `确认选中 (${checkedIds.size})` : '全部确认'}
          </button>
          <button className="btn primary" onClick={() => load()}>刷新</button>
        </div>
      </div>

      {/* Progress bar */}
      {meta && (
        <div className="app-card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-app-muted uppercase tracking-wider">审核进度</span>
            <span className="text-xs font-bold">{meta.confirmed_events}/{meta.total_events} 已确认 ({meta.progress_pct}%)</span>
          </div>
          <div className="h-2 bg-[#eef2f8] rounded-full overflow-hidden">
            <div className="h-full bg-app-green rounded-full transition-all duration-500" style={{ width: `${meta.progress_pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-[260px_1fr_340px] gap-4 items-start">
        {/* Queue list */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">队列</h2>
            <span className="badge-amber">{queue.length} 待审核</span>
          </div>
          <div className="p-3 space-y-2">
            {loading && <p className="text-xs text-app-muted px-2">加载中...</p>}
            {!loading && queue.length === 0 && (
              <p className="text-xs text-app-muted px-2">没有待审核事件🎉</p>
            )}
            {queue.map((item, i) => {
              const cf = confidenceLabel(item.source_confidence)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 p-2.5 rounded-[14px] cursor-pointer transition-colors ${
                    selected?.id === item.id ? 'bg-[#eaf0ff] border border-app-blue/20' : 'bg-[#f8f4ef] border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="flex-shrink-0"
                    checked={checkedIds.has(item.id)}
                    onChange={e => { e.stopPropagation(); toggleCheck(item.id) }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0" onClick={() => setSelected(item)}>
                    <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                    <div className="flex gap-1.5 mt-0.5">
                      <span className="text-[10px] text-app-muted">{EVENT_TYPE_CONFIG[item.event_type] || item.event_type}</span>
                      <span className={`${cf.cls} text-[9px]`}>{cf.label}置信</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail card with inline editing */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">草稿事件</h2>
            {selected && <span className={`${conf.cls}`}>{conf.label}置信度</span>}
          </div>
          <div className="p-4 space-y-3">
            {selected ? (
              <>
                {/* Confidence bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#eef2f8] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (selected.source_confidence || 0) >= 0.8 ? 'bg-app-green' :
                        (selected.source_confidence || 0) >= 0.5 ? 'bg-app-amber' : 'bg-app-red'
                      }`}
                      style={{ width: `${((selected.source_confidence || 0) * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-app-muted w-8 text-right">
                    {selected.source_confidence ? `${(selected.source_confidence * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>

                {/* Editable fields */}
                <div className="space-y-2">
                  {[
                    { key: 'title', label: '标题', value: selected.title },
                    { key: 'role', label: '角色', value: selected.role || '—' },
                    { key: 'organization', label: '组织', value: selected.organization || '—' },
                    { key: 'time_start', label: '开始时间', value: selected.time_start || '—' },
                    { key: 'time_end', label: '结束时间', value: selected.time_end || '—' },
                    { key: 'description', label: '描述', value: selected.description || '—', long: true },
                  ].map(field => (
                    <div key={field.key}>
                      <div className="flex items-start gap-2 group">
                        <span className="text-[11px] font-extrabold text-app-muted uppercase w-16 flex-shrink-0 pt-0.5">{field.label}</span>
                        {editingField === field.key ? (
                          <div className="flex-1 flex gap-1">
                            {field.long ? (
                              <textarea
                                className="input text-xs flex-1 min-h-[60px]"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              <input
                                className="input text-xs flex-1 h-7"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') saveFieldEdit() }}
                              />
                            )}
                            <button className="btn primary text-[10px] h-6 px-2" onClick={saveFieldEdit}>保存</button>
                            <button className="btn text-[10px] h-6 px-2" onClick={() => setEditingField(null)}>取消</button>
                          </div>
                        ) : (
                          <span
                            className="text-sm flex-1 cursor-pointer hover:bg-[#f0f4ff] rounded px-1 -mx-1 min-h-[20px]"
                            onClick={() => startEditField(field.key, field.value === '—' ? '' : field.value)}
                            title="点击编辑"
                          >
                            {field.value}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {selected.tags?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {selected.tags.map((t: string) => <span key={t} className="badge-blue text-[10px]">{t}</span>)}
                  </div>
                )}

                {/* Claims */}
                <div className="border-t border-app-line-soft pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider">
                      Claims ({selected.claims?.length || 0})
                    </h3>
                    <button
                      className="text-[10px] font-bold text-app-blue"
                      onClick={() => setShowClaimForm(!showClaimForm)}
                    >
                      {showClaimForm ? '取消' : '+ 添加'}
                    </button>
                  </div>
                  {showClaimForm && (
                    <div className="rounded-[14px] bg-[#f8f4ef] p-3 space-y-2 mb-2">
                      <textarea
                        className="input text-xs min-h-[40px] w-full"
                        placeholder="新声明..."
                        value={newClaimText}
                        onChange={e => setNewClaimText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <select className="input text-xs" value={newClaimType} onChange={e => setNewClaimType(e.target.value)}>
                          {Object.entries(CLAIM_TYPE_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
                        </select>
                        <select className="input text-xs" value={newClaimStrength} onChange={e => setNewClaimStrength(e.target.value)}>
                          {Object.entries(STRENGTH_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
                        </select>
                      </div>
                      <button className="btn primary text-xs h-7 w-full" onClick={handleAddClaim}>添加声明</button>
                    </div>
                  )}
                  {(selected.claims || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(selected.claims || []).map((cl: any) => {
                        const ct = CLAIM_TYPE_CONFIG[cl.claim_type] || CLAIM_TYPE_CONFIG.achievement
                        const st = STRENGTH_CONFIG[cl.strength] || STRENGTH_CONFIG.confirmed
                        return (
                          <div key={cl.id} className="flex items-start gap-2 rounded-[12px] bg-[#f8f4ef] p-2">
                            <div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: st.dot }} title={st.label} />
                            <div className="flex-1 min-w-0">
                              {editingClaimId === cl.id ? (
                                <div className="flex gap-1">
                                  <input
                                    className="input text-[11px] flex-1 h-6"
                                    value={editingClaimText}
                                    onChange={e => setEditingClaimText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateClaim(cl.id) }}
                                    autoFocus
                                  />
                                  <button className="btn primary text-[10px] h-6 px-2" onClick={() => handleUpdateClaim(cl.id)}>保存</button>
                                  <button className="btn text-[10px] h-6 px-2" onClick={() => { setEditingClaimId(null); setEditingClaimText('') }}>取消</button>
                                </div>
                              ) : (
                                <span
                                  className="text-xs cursor-pointer"
                                  onClick={() => { setEditingClaimId(cl.id); setEditingClaimText(cl.claim_text) }}
                                  title="点击编辑"
                                >
                                  {cl.claim_text}
                                </span>
                              )}
                              <div className="flex gap-1 mt-0.5">
                                <span className={`${ct.cls} text-[9px]`}>{ct.label}</span>
                                <button
                                  className="text-[9px] text-red-400 hover:text-red-600"
                                  onClick={() => handleDeleteClaim(cl.id)}
                                >删除</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-app-muted">暂无声明，AI 解析后会自动生成，或手动添加。</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-app-line-soft">
                  <button className="btn primary text-xs h-9" onClick={() => handleConfirm(selected.id)}>确认</button>
                  <button className="btn text-xs h-9" onClick={() => setEditingField('description')}>编辑</button>
                  <button className="btn text-xs h-9 text-app-red" onClick={() => handleSkip(selected.id)}>跳过</button>
                </div>
              </>
            ) : (
              <p className="text-xs text-app-muted p-4 text-center">选择左侧事件查看详情</p>
            )}
          </div>
        </div>

        {/* Uncertainty panel */}
        <div className="app-card">
          <div className="px-4 py-3.5 border-b border-app-line">
            <h2 className="text-[17px] font-semibold">不确定性扫描</h2>
          </div>
          <div className="p-4 space-y-3">
            {selected && uncertaintyFlags.length > 0 ? (
              uncertaintyFlags.map(flag => (
                <div key={flag.key} className="rounded-[14px] bg-[#f8f4ef] p-3">
                  <span className={flag.cls}>{flag.label}</span>
                  <p className="text-xs text-app-muted mt-1.5">{flag.desc}</p>
                </div>
              ))
            ) : selected ? (
              <div className="rounded-[14px] bg-[#f0f7f1] p-4 text-center">
                <p className="text-sm font-bold text-app-green">信息完整</p>
                <p className="text-xs text-app-muted mt-1">此事件已包含角色、组织、时间和描述。</p>
              </div>
            ) : (
              <p className="text-xs text-app-muted">选择事件后自动扫描</p>
            )}

            {selected && (
              <>
                <div className="h-px bg-app-line-soft" />
                <div>
                  <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">可复用声明</h3>
                  {(selected.claims || []).length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                      {(selected.claims || []).map((cl: any) => (
                        <span key={cl.id} className="badge-gray text-[10px]">{cl.claim_text.slice(0, 30)}{cl.claim_text.length > 30 ? '...' : ''}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-app-muted">暂无声明</p>
                  )}
                </div>
              </>
            )}

            <div className="h-px bg-app-line-soft" />
            <textarea
              className="input min-h-[70px] text-xs"
              placeholder="添加审核备注..."
            />
            <button className="btn primary w-full text-xs" onClick={() => load()}>刷新审核队列</button>
          </div>
        </div>
      </div>
    </div>
  )
}
