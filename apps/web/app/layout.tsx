import AuthGate from '@/components/auth/auth-gate'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '求索 Copilot',
  description: '让每一段经历，都成为下一次机会的证据',
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
