'use client'
import { useState } from 'react'
import AppShell from '@/components/app-shell'

export default function VaultPage() {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    setUploading(true)
    // TODO: 文件上传逻辑
    setTimeout(() => setUploading(false), 1000)
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-[#1B4A8F] uppercase tracking-wider">CAREER VAULT</p>
          <h1 className="text-2xl font-bold text-[#1A1A2E] mt-1">职业档案库</h1>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50"
        >
          {uploading ? '解析中...' : '上传材料'}
        </button>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-1">
          {['Profile', 'Sources', 'Review Queue', 'Timeline', 'Claims'].map((item) => (
            <div
              key={item}
              className="px-3 py-2 rounded-md text-sm text-[#5A6A7A] hover:bg-gray-100 cursor-pointer"
            >
              {item}
            </div>
          ))}
        </div>

        {/* Main */}
        <div>
          <div className="bg-white border border-dashed border-[#D0D5DD] rounded-lg p-8 text-center mb-6">
            <p className="text-sm text-[#5A6A7A]">拖拽文件到此处，或点击选择</p>
            <p className="text-xs text-[#5A6A7A] mt-1">PDF / DOCX / Markdown / TXT</p>
          </div>

          <div className="text-sm text-[#5A6A7A] text-center py-12">
            上传简历后，AI 会自动提取你的职业事件
          </div>
        </div>
      </div>
    </AppShell>
  )
}
