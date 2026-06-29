import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Career Copilot CN',
  description: '国内版 AI 求职 Copilot',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#F5F7FA] text-[#1A1A2E]">
        {children}
      </body>
    </html>
  )
}
