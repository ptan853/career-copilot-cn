'use client'

import { useState } from 'react'

const DOCUMENTS = [
  { id: 'r1', letter: 'R', title: 'DeepSeek Resume', version: 'v3 · saved', active: true },
  { id: 'c1', letter: 'C', title: 'Cover Letter', version: 'v1 · draft', active: false },
  { id: 'b1', letter: 'B', title: 'Boss Opening', version: 'ready', active: false },
]

const AI_ACTIONS = [
  'Make it more concise',
  'Use stronger action verbs',
  'Add JD keywords',
  'Compress to one page',
]

export default function EditorPage() {
  const [selectedDoc, setSelectedDoc] = useState('r1')
  const [template, setTemplate] = useState('ats')
  const [aiPrompt, setAiPrompt] = useState('')

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">编辑器</h1>
          <p className="text-[13px] text-app-muted mt-1.5">A4 preview, structured editing, source view, version history, verified export.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={template} onChange={e => setTemplate(e.target.value)} className="input w-[150px] h-[34px] text-sm">
            <option value="ats">ATS Classic</option>
            <option value="modern">Engineer Modern</option>
          </select>
          <button className="btn text-xs">Preview</button>
          <button className="btn text-xs">Source</button>
          <button className="btn text-xs">Copy Markdown</button>
          <button className="btn primary text-xs">Export PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-[240px_minmax(0,1fr)_330px] gap-4 items-start">
        {/* Document list */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line">
            <h2 className="text-[17px] font-semibold">Documents</h2>
          </div>
          <div className="p-4 space-y-3">
            {DOCUMENTS.map(doc => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc.id)}
                className={`flex gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  selectedDoc === doc.id ? 'border-[#aac0ff] bg-[#f7f9ff]' : 'border-app-line-soft bg-white'
                }`}
              >
                <div className="source-dot">{doc.letter}</div>
                <div>
                  <h3 className="text-sm font-semibold">{doc.title}</h3>
                  <p className="text-xs text-app-muted">{doc.version}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* A4 Preview */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="p-[40px] max-w-[680px] mx-auto">
            <h1 className="text-xl font-bold text-center tracking-tight mb-1">谭沛烽</h1>
            <p className="text-xs text-center text-app-muted mb-5">tan19991103@outlook.com · 178-0123-1696 · 长沙 / 深圳 · GitHub Portfolio</p>

            <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2.5">Summary</h2>
            <p className="text-xs leading-relaxed mb-5">帝国理工大学硕士，专注 LLM Agent 架构、工具调用、多步任务拆解与上下文管理。具备企业级 Agent 工具编排、算法服务化和优化系统落地经验。</p>

            <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2.5">Experience</h2>
            <p className="text-xs font-bold mt-2.5">Agent 算法工程师 — 武汉光庭信息科技 · 2026</p>
            <ul className="text-xs space-y-1 mt-1 mb-3">
              <li>• 设计 PM Agent 智能项目管理助手，支持项目、任务、人员信息的自然语言查询与可视化报告生成。</li>
              <li>• 通过 ToolManager 统一管理本地与远程工具，支持模型自主规划多步工具调用、复杂查询拆解与上下文注入。</li>
              <li>• 构造 search/call/list 元工具，将 PM Agent 迁移至 LangGraph DeepAgent 架构，实现工具发现、执行与结果查看统一接口。</li>
            </ul>

            <p className="text-xs font-bold mt-2.5">深度学习与预测优化算法工程师 — 吉利-利星能储能科技 · 2025-2026</p>
            <ul className="text-xs space-y-1 mt-1 mb-3">
              <li>• 构建面向储能电站收益最大化的 MILP 优化系统，使用 Pyomo 与 HiGHS 综合考虑 SOC、功率、效率等约束。</li>
              <li>• 使用 FastAPI 将核心算法封装为 RESTful 服务，支持内部系统调用与外部平台集成。</li>
            </ul>

            <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2.5">Projects</h2>
            <p className="text-xs font-bold mt-2.5">Career Vault Resume Skill — Python CLI, JSON Schema, Agents</p>
            <ul className="text-xs space-y-1 mt-1 mb-3">
              <li>• 设计 local-first 职业身份与经历记忆 vault skill，支持 profile、source material、career events 和 claims。</li>
            </ul>

            <h2 className="text-sm font-bold border-b-2 border-app-blue pb-1 mb-2.5">Skills</h2>
            <p className="text-xs leading-relaxed mt-2.5"><strong>Agent:</strong> LangChain, LangGraph, Tool Calling, Context Injection, Memory</p>
            <p className="text-xs leading-relaxed"><strong>Engineering:</strong> Python, FastAPI, Docker, Linux, RESTful API</p>
          </div>
        </div>

        {/* AI Edit Assistant */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">AI Edit Assistant</h2>
            <span className="badge-violet">Scoped</span>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              className="input min-h-[80px] resize-y text-sm"
              placeholder="e.g. Make the PM Agent bullets more concise, but keep source-backed claims only."
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
            />
            <button className="btn primary w-full text-xs">Apply AI edit</button>
            <div className="h-px bg-app-line-soft" />
            {AI_ACTIONS.map(action => (
              <button key={action} className="btn w-full text-xs">{action}</button>
            ))}
            <div className="h-px bg-app-line-soft" />
            <div className="p-3 border border-app-line-soft rounded-md bg-[#f9fafb] text-xs text-app-muted">
              <p className="font-semibold mb-1">Last change:</p>
              <p>summary rewritten from confirmed claims only. No weak claims used.</p>
            </div>
            <div className="p-3.5 rounded-md bg-app-panel-soft border border-app-line-soft">
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Export verification</h3>
              <div className="flex gap-1.5 flex-wrap">
                <span className="badge-green">Text layer</span>
                <span className="badge-green">1 page</span>
                <span className="badge-green">Contact present</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .input { border: 1px solid #d9dee7; border-radius: 7px; background: #fff; color: #172033; padding: 8px 11px; font-size: 14px; width: 100%; }
        .input:focus { outline: none; border-color: #1f5eff; }
        .badge-green { background: #e7f6ef; color: #16805d; border: 1px solid #cceada; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-violet { background: #f4eaff; color: #6d1fff; border: 1px solid #e2d4ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .source-dot { width: 26px; height: 26px; border-radius: 6px; background: #eef2f8; border: 1px solid #d9dee7; color: #526176; display: grid; place-items: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; font-size: 11px; flex-shrink: 0; }
      `}</style>
    </div>
  )
}
