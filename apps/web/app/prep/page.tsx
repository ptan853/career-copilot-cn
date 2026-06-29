'use client'

import { useState } from 'react'

const PREP_SETS = [
  { id: 'ds', letter: 'DS', title: 'DeepSeek Harness', desc: 'Resume v3 · Tech round', active: true },
  { id: 'ks', letter: 'KS', title: 'Kuaishou Agent', desc: 'Resume v2 · HR round', active: false },
]

const QUESTIONS = [
  { id: 'q1', question: 'Explain your PM Agent architecture.', meta: 'Project deep dive · high probability', status: 'weak', statusLabel: 'Weak', statusCls: 'badge-amber' },
  { id: 'q2', question: 'How did ToolManager reduce tool call failures?', meta: 'Technical · source-backed', status: 'ready', statusLabel: 'Ready', statusCls: 'badge-green' },
  { id: 'q3', question: 'How would you evaluate an Agent Harness?', meta: 'Gap area · needs prep', status: 'review', statusLabel: 'Review', statusCls: 'badge-red' },
  { id: 'q4', question: 'Why DeepSeek Harness instead of application layer roles?', meta: 'Motivation · HR/manager', status: 'new', statusLabel: 'New', statusCls: 'badge-gray' },
]

const STAR_ANSWER = {
  question: 'How did ToolManager reduce tool call failures?',
  situation: 'PM Agent needed to query project, task, and personnel data through multiple local and remote tools.',
  task: 'Reduce missing context and failed calls while preserving flexible multi-step planning.',
  action: 'Centralized tool registration and metadata, injected context into prompts, and exposed search/call/list meta tools.',
  result: 'Created a reusable tool orchestration path that later migrated into a LangGraph DeepAgent architecture.',
  evidence: 'PM Agent event · Source S1 · Resume v3 bullet 2',
}

export default function PrepPage() {
  const [selectedSet, setSelectedSet] = useState('ds')
  const [selectedQuestion, setSelectedQuestion] = useState('q2')
  const [answerStatus, setAnswerStatus] = useState<'know' | 'practice' | null>(null)

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">面试准备</h1>
          <p className="text-[13px] text-app-muted mt-1.5">Prep is grounded in the actual job target and submitted resume version.</p>
        </div>
        <button className="btn primary">Regenerate prep</button>
      </div>

      <div className="grid grid-cols-3 gap-4 items-start">
        {/* Prep sets */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line">
            <h2 className="text-[17px] font-semibold">Prep sets</h2>
          </div>
          <div className="p-4 space-y-3">
            {PREP_SETS.map(set => (
              <div
                key={set.id}
                onClick={() => setSelectedSet(set.id)}
                className={`flex gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  selectedSet === set.id ? 'border-[#aac0ff] bg-[#f7f9ff]' : 'border-app-line-soft bg-white'
                }`}
              >
                <div className="source-dot">{set.letter}</div>
                <div>
                  <h3 className="text-sm font-semibold">{set.title}</h3>
                  <p className="text-xs text-app-muted">{set.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Predicted questions */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Predicted questions</h2>
            <span className="badge-blue">36 total</span>
          </div>
          <div className="p-4 space-y-2.5">
            {QUESTIONS.map(q => (
              <div
                key={q.id}
                onClick={() => setSelectedQuestion(q.id)}
                className={`flex items-start justify-between gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  selectedQuestion === q.id ? 'border-[#aac0ff] bg-[#f7f9ff]' : 'border-app-line-soft bg-white'
                }`}
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{q.question}</h3>
                  <p className="text-xs text-app-muted mt-0.5">{q.meta}</p>
                </div>
                <span className={`${q.statusCls} shrink-0`}>{q.statusLabel}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Answer draft */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Answer draft</h2>
            <span className="badge-cyan">STAR</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-app-muted">Question</p>
              <p className="text-sm font-bold mt-1">{STAR_ANSWER.question}</p>
            </div>
            <div className="h-px bg-app-line-soft" />
            {[
              { label: 'Situation', content: STAR_ANSWER.situation },
              { label: 'Task', content: STAR_ANSWER.task },
              { label: 'Action', content: STAR_ANSWER.action },
              { label: 'Result', content: STAR_ANSWER.result },
            ].map(part => (
              <div key={part.label}>
                <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider">{part.label}</h3>
                <p className="text-sm mt-1">{part.content}</p>
              </div>
            ))}
            <div className="p-2.5 rounded-md bg-[#f9fafb] border border-app-line-soft text-xs text-app-muted">
              <p className="font-semibold mb-0.5">Evidence:</p>
              {STAR_ANSWER.evidence}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                className={`btn text-xs h-8 ${answerStatus === 'know' ? 'bg-[#e7f6ef] border-[#cceada] text-app-green font-bold' : ''}`}
                onClick={() => setAnswerStatus('know')}
              >
                Know
              </button>
              <button
                className={`btn text-xs h-8 ${answerStatus === 'practice' ? 'bg-[#fff2dc] border-[#ffe1ad] text-app-amber font-bold' : ''}`}
                onClick={() => setAnswerStatus('practice')}
              >
                Needs practice
              </button>
              <button className="btn primary text-xs h-8">Save edits</button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .badge-amber { background: #fff2dc; color: #b97913; border: 1px solid #ffe1ad; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-green { background: #e7f6ef; color: #16805d; border: 1px solid #cceada; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-red { background: #fdecec; color: #bd3b3b; border: 1px solid #f6cfcf; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-gray { background: #f1f3f6; color: #5f6b7c; border: 1px solid #e2e6ec; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-blue { background: #eaf0ff; color: #1741a6; border: 1px solid #d8e3ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-cyan { background: #e6f5f5; color: #0f8b8d; border: 1px solid #c8e8e9; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .source-dot { width: 26px; height: 26px; border-radius: 6px; background: #eef2f8; border: 1px solid #d9dee7; color: #526176; display: grid; place-items: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; font-size: 11px; flex-shrink: 0; }
      `}</style>
    </div>
  )
}
