import AuthGate from '@/components/auth/auth-gate'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Career Copilot CN',
  description: 'Evidence-first job application OS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-app-bg text-app-ink" suppressHydrationWarning>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  )
}
