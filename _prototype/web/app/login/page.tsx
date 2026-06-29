'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'phone' | 'email'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  const requestCode = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/phone-code/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) throw new Error('发送失败')
      setCodeSent(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const login = async () => {
    setLoading(true)
    setError('')
    try {
      let res
      if (mode === 'phone') {
        res = await fetch('/api/auth/phone-code/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code }),
        })
      } else {
        res = await fetch('/api/auth/email-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
      }
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '登录失败')
      }
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-[#D0D5DD] p-8">
        <h1 className="text-xl font-bold text-[#1A1A2E] mb-1">登录</h1>
        <p className="text-sm text-[#5A6A7A] mb-6">欢迎使用 Career Copilot</p>

        {/* Tab 切换 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => { setMode('phone'); setError('') }}
            className={`text-sm font-medium pb-1 border-b-2 ${mode === 'phone' ? 'border-[#1B4A8F] text-[#1B4A8F]' : 'border-transparent text-[#5A6A7A]'}`}
          >
            手机号
          </button>
          <button
            onClick={() => { setMode('email'); setError('') }}
            className={`text-sm font-medium pb-1 border-b-2 ${mode === 'email' ? 'border-[#1B4A8F] text-[#1B4A8F]' : 'border-transparent text-[#5A6A7A]'}`}
          >
            邮箱
          </button>
        </div>

        {mode === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#5A6A7A] mb-1 block">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="w-full h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
              />
            </div>
            <div>
              <label className="text-sm text-[#5A6A7A] mb-1 block">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="输入验证码"
                  className="flex-1 h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
                />
                <button
                  onClick={requestCode}
                  disabled={loading || !phone || codeSent}
                  className="px-4 h-10 text-sm font-medium text-[#1B4A8F] border border-[#D0D5DD] rounded-lg hover:bg-gray-50 disabled:opacity-50 shrink-0"
                >
                  {codeSent ? '已发送' : '获取验证码'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#5A6A7A] mb-1 block">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
              />
            </div>
            <div>
              <label className="text-sm text-[#5A6A7A] mb-1 block">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <button
          onClick={login}
          disabled={loading}
          className="w-full h-10 mt-5 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50"
        >
          {loading ? '处理中...' : '登录'}
        </button>

        <p className="text-sm text-center text-[#5A6A7A] mt-4">
          还没有账号？
          <Link href="/signup" className="text-[#1B4A8F] font-medium ml-1">注册</Link>
        </p>
      </div>
    </div>
  )
}
