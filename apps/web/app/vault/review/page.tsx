'use client'

import { useState, useEffect } from 'react'
import { getReviewQueue, confirmEvent, updateEvent } from '@/lib/api-client'

export default function ReviewPage() {
  const [queue, setQueue] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res: any = await getReviewQueue()
      const items = res.data || []
      setQueue(items)
      if (items[0] && !selected) setSelected(items[0])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleConfirm = async (id: string) => {
    await confirmEvent(id)
    load()
    setSelected(null)
  }

  const handleSkip = async (id: string) => {
    await updateEvent(id, { status: 'archived' })
    load()
    setSelected(null)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">审核队列</h1>
          <p className="text-[13px] text-app-muted mt-1.5">AI 输出保持草稿状态，直到你确认。这是我们超越简单简历工具的核心能力。</p>
        </div>
        <div className="flex gap-2">
          <button className="btn">跳过低置信度</button>
          <button className="btn primary">批量确认</button>
        </div>
      </div>

      <div className="grid grid-cols-[260px_1fr_360px] gap-4 items-start">
        {/* Queue list */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">队列</h2>
            <span className="badge-amber">{queue.length} pending</span>
          </div>
          <div className="p-4 space-y-3">
            {queue.map((item, i) => (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                className={`flex gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  selected?.id === item.id ? 'border-[#aac0ff] bg-[#f7f9ff]' : 'border-app-line-soft bg-white'
                }`}
              >
                <div className="source-dot warning">{i + 1}</div>
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-xs text-app-muted">{item.status === 'draft' ? '新草稿' : '需审核'}</p>
                </div>
              </div>
            ))}
            {queue.length === 0 && (
              <p className="text-xs text-app-muted">没有待审核事件</p>
            )}
          </div>
        </div>

        {/* Detail card */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">草稿事件</h2>
            <span className="badge-amber">待审核</span>
          </div>
          <div className="p-4 space-y-4">
            {selected ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-app-muted">标题</p>
                    <p className="text-sm font-semibold mt-0.5">{selected.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-app-muted">类型</p>
                    <p className="text-sm mt-0.5">{selected.event_type}</p>
                  </div>
                </div>
                <div className="h-px bg-app-line-soft" />
                <div>
                  <p className="text-xs text-app-muted">AI 提取详情</p>
                  <p className="text-sm mt-1.5">此事件需要你确认其准确性和归属。</p>
                </div>
                <div className="p-2.5 bg-[#fffaf2] border border-[#ffe2ae] rounded-md text-xs text-[#6b4b17]">
                  置信度: {selected.source_confidence ? `${(selected.source_confidence * 100).toFixed(0)}%` : '未评估'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button className="btn primary text-xs h-8" onClick={() => handleConfirm(selected.id)}>确认</button>
                  <button className="btn text-xs h-8">编辑</button>
                  <button className="btn text-xs h-8 text-app-red border-[#f0caca]" onClick={() => handleSkip(selected.id)}>跳过</button>
                </div>
              </>
            ) : (
              <p className="text-xs text-app-muted">选择左侧事件查看详情</p>
            )}
          </div>
        </div>

        {/* Uncertainty panel */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line">
            <h2 className="text-[17px] font-semibold">不确定性</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <span className="badge-red">归属不确定</span>
              <p className="text-xs text-app-muted mt-1.5">源材料提到参与，请确认你个人负责的部分。</p>
            </div>
            <div>
              <span className="badge-amber">指标缺失</span>
              <p className="text-xs text-app-muted mt-1.5">未发现量化影响。不要编造数字。</p>
            </div>
            <div>
              <span className="badge-blue">可复用声明</span>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <span className="badge-gray text-[11px]">Tool orchestration</span>
                <span className="badge-gray text-[11px]">LangGraph migration</span>
              </div>
            </div>
            <textarea className="input min-h-[80px]" placeholder="添加修正或确认备注..." />
            <button className="btn primary w-full text-xs">保存审核决定</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; }
        .input { width: 100%; border: 1px solid #d9dee7; border-radius: 7px; background: #fff; color: #172033; padding: 10px 11px; font-size: 14px; }
        .input:focus { outline: none; border-color: #1f5eff; }
        .badge-amber { background: #fff2dc; color: #b97913; border: 1px solid #ffe1ad; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-red { background: #fdecec; color: #bd3b3b; border: 1px solid #f6cfcf; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-gray { background: #f1f3f6; color: #5f6b7c; border: 1px solid #e2e6ec; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-blue { background: #eaf0ff; color: #1741a6; border: 1px solid #d8e3ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .source-dot { width: 26px; height: 26px; border-radius: 6px; background: #eef2f8; border: 1px solid #d9dee7; color: #526176; display: grid; place-items: center; font-family: ui-monospace, monospace; font-weight: 800; font-size: 11px; flex-shrink: 0; }
        .source-dot.warning { background: #fff2dc; border-color: #ffe1ad; color: #b97913; }
      `}</style>
    </div>
  )
}
