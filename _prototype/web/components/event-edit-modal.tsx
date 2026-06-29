'use client'

import { useState, useEffect, useRef } from 'react'
import { EVENT_TYPE_COLORS, type EventType } from '@/lib/event-constants'

export interface EventData {
  id: string
  type: EventType
  title: string
  organization?: string
  role?: string
  time_start?: string
  time_end?: string
  time_precision?: string
  description?: string
  status: string
  visibility?: string
  tags?: string[]
  details?: Record<string, any>
}

interface EventEditModalProps {
  event: EventData | null
  open: boolean
  onClose: () => void
  onSave: (id: string, fields: Record<string, any>) => void
  onConfirm: (id: string) => void
  onDelete: () => void
}

const FIELD_DEFS: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: 'title', label: '标题', placeholder: '例如: 高级前端工程师' },
  { key: 'organization', label: '公司/学校', placeholder: '例如: 字节跳动' },
  { key: 'role', label: '职位/专业', placeholder: '例如: 前端开发' },
  { key: 'time_start', label: '开始时间', placeholder: 'YYYY-MM', type: 'month' },
  { key: 'time_end', label: '结束时间', placeholder: '至今 或 YYYY-MM', type: 'text' },
  { key: 'description', label: '描述', placeholder: '你在这一段经历中的主要贡献和成果', type: 'textarea' },
]

export default function EventEditModal({ event, open, onClose, onSave, onConfirm, onDelete }: EventEditModalProps) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [extraFields, setExtraFields] = useState<{ key: string; value: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Sync form when event changes — use useEffect, not render-body setState
  useEffect(() => {
    if (!event) return
    setForm({
      title: event.title || '',
      organization: event.organization || '',
      role: event.role || '',
      time_start: event.time_start || '',
      time_end: event.time_end || '',
      description: event.description || '',
    })
    if (event.details) {
      const known = ['title', 'organization', 'role', 'time_start', 'time_end', 'description']
      const extras = Object.entries(event.details)
        .filter(([k]) => !known.includes(k))
        .map(([k, v]) => ({ key: k, value: String(v) }))
      setExtraFields(extras)
    } else {
      setExtraFields([])
    }
  }, [event?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !event) return null

  const typeMeta = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.custom

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateExtraField = (idx: number, field: 'key' | 'value', val: string) => {
    setExtraFields(prev => prev.map((f, i) => i === idx ? { ...f, [field]: val } : f))
  }

  const addExtraField = () => {
    setExtraFields(prev => [...prev, { key: '', value: '' }])
  }

  const removeExtraField = (idx: number) => {
    setExtraFields(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setSaving(true)
    // Merge extra fields into details
    const details: Record<string, any> = {}
    extraFields.forEach(f => {
      if (f.key.trim()) details[f.key.trim()] = f.value
    })
    await onSave(event.id, { ...form, details: Object.keys(details).length > 0 ? details : undefined })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ backgroundColor: typeMeta.bg, color: typeMeta.bar }}
            >
              {typeMeta.label}
            </span>
            <span className="text-sm text-[#8E9BAE]">编辑</span>
          </div>
          <div className="flex items-center gap-1">
            {event.status === 'draft' && (
              <button
                onClick={() => { onConfirm(event.id); onClose() }}
                className="px-3 py-1.5 text-xs font-medium text-[#059669] hover:bg-[#ECFDF5] rounded-md"
              >
                确认
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-[#8E9BAE] hover:bg-gray-100 rounded-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
          {FIELD_DEFS.map(field => (
            <div key={field.key}>
              <label className="block text-[11px] font-semibold text-[#8E9BAE] uppercase mb-1">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={form[field.key] || ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg resize-none outline-none focus:border-[#1B4A8F] focus:ring-1 focus:ring-[#1B4A8F]"
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  value={form[field.key] || ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg outline-none focus:border-[#1B4A8F] focus:ring-1 focus:ring-[#1B4A8F]"
                />
              )}
            </div>
          ))}

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8E9BAE] uppercase mb-1">标签</label>
            <div className="flex flex-wrap gap-1.5">
              {(event.tags || []).map(t => (
                <span key={t} className="text-[11px] px-2 py-1 bg-[#F3F4F6] text-[#5A6A7A] rounded-md">{t}</span>
              ))}
              {(!event.tags || event.tags.length === 0) && (
                <span className="text-[11px] text-[#8E9BAE]">暂无标签</span>
              )}
            </div>
          </div>

          {/* Extra fields */}
          {extraFields.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-[11px] font-semibold text-[#8E9BAE] uppercase mb-2">额外字段</p>
              <div className="space-y-2">
                {extraFields.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={f.key}
                      onChange={e => updateExtraField(i, 'key', e.target.value)}
                      placeholder="字段名"
                      className="w-1/3 px-2 py-1.5 text-xs border border-[#E5E7EB] rounded outline-none focus:border-[#1B4A8F]"
                    />
                    <input
                      value={f.value}
                      onChange={e => updateExtraField(i, 'value', e.target.value)}
                      placeholder="值"
                      className="flex-1 px-2 py-1.5 text-xs border border-[#E5E7EB] rounded outline-none focus:border-[#1B4A8F]"
                    />
                    <button
                      onClick={() => removeExtraField(i)}
                      className="p-1.5 text-[#8E9BAE] hover:text-[#DC2626] shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add extra field button */}
          <button
            onClick={addExtraField}
            className="flex items-center gap-1.5 text-xs text-[#1B4A8F] hover:text-[#2563EB] font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加字段
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-[#F9FAFB]">
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] rounded-md"
          >
            删除
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#5A6A7A] border border-[#D0D5DD] rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-[#1B4A8F] text-white rounded-lg hover:bg-[#2563EB] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
