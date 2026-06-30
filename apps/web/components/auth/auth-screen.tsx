'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  ChevronDown,
  FileStack,
  FileText,
  FolderKanban,
  Link as LinkIcon,
  Lock,
  Mail,
  Menu,
  MessageSquareText,
  Plus,
  Sparkles,
  Target,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react'
import {
  getCurrentUser,
  getGoogleLoginUrl,
  login,
  logout,
  signup,
} from '@/lib/api-client'
import type { AuthUser } from '@/lib/api-client'

type AuthMode = 'login' | 'signup'

export function AuthEntryPage({
  initialMode,
  initialModalOpen = true,
}: {
  initialMode: AuthMode
  initialModalOpen?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const authError = searchParams.get('error')
  const isHomePage = pathname === '/'
  const authReturnTo = isHomePage ? '/' : next

  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getCurrentUser().then(user => {
      if (!active) return
      setCurrentUser(user)
      setCheckingUser(false)
      setModalOpen(!user && initialModalOpen)
    })

    return () => {
      active = false
    }
  }, [initialModalOpen])

  useEffect(() => {
    setMode(initialMode)
    if (!checkingUser && !currentUser) {
      setModalOpen(initialModalOpen)
    }
  }, [initialMode, initialModalOpen, checkingUser, currentUser])

  useEffect(() => {
    if (authError === 'google_not_configured') {
      setError('Google 登录还没有配置，请先使用邮箱密码登录。')
      setModalOpen(true)
    } else if (authError === 'google_auth_failed') {
      setError('Google 登录失败，请稍后重试或使用邮箱密码登录。')
      setModalOpen(true)
    }
  }, [authError])

  const openAuth = (nextMode: AuthMode) => {
    setMode(nextMode)
    setModalOpen(true)
    clearFlowState()
  }

  const handleLogout = async () => {
    await logout()
    setCurrentUser(null)
    setModalOpen(false)
  }

  const clearFlowState = () => {
    setError('')
  }

  const handlePasswordAuth = async () => {
    setError('')
    if (!email || !password) {
      setError('请输入邮箱和密码')
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setError('密码至少需要 8 个字符')
      return
    }
    setLoading(true)
    try {
      let response
      if (mode === 'signup') {
        response = await signup({ email, password, name: name || undefined })
      } else {
        response = await login({ email, password })
      }
      if (isHomePage) {
        setCurrentUser(response.user)
        setModalOpen(false)
        setPassword('')
      } else {
        router.push(next)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fcff] text-[#172033]">
      <TopNav
        currentUser={currentUser}
        checkingUser={checkingUser}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
      />

      <section className="relative border-b border-[#e4edf7] bg-[linear-gradient(135deg,#f9fcff_0%,#eefcff_42%,#f7fbff_72%,#fff7f2_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#6ee7f9]/45 to-transparent" />
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-5 pb-20 pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="flex flex-col items-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d6eef8] bg-white/75 px-4 py-2 text-sm font-bold text-app-blue-ink shadow-[0_10px_24px_rgba(74,125,255,0.08)]">
              <Sparkles className="h-4 w-4" />
              中文求职资料库 · 面向国内岗位场景
            </div>

            <h1 className="mt-8 max-w-[760px] text-[42px] font-black leading-[1.08] tracking-[-0.01em] text-[#102033] md:text-[64px]">
              让每一段经历，都成为下一次机会的证据
            </h1>

            <p className="mt-6 max-w-[690px] rounded-[16px] border border-[#dceefa] bg-white/62 px-5 py-4 text-xl font-bold leading-8 text-app-blue-ink shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
              路漫漫其修远兮，吾将上下而求索。
            </p>

            <p className="mt-5 max-w-[690px] text-lg leading-8 text-[#52627a] md:text-xl">
              上传简历、粘贴 BOSS 直聘/拉勾/猎聘等岗位描述，或者直接输入项目记录与面试复盘。系统会把零散材料沉淀成可编辑、可追溯、可复用的求职资产。
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-[12px] bg-[#4a7dff] px-8 text-base font-extrabold text-white shadow-[0_18px_34px_rgba(74,125,255,0.25)] transition hover:bg-[#4a7dff]"
              >
                开始整理我的经历
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="inline-flex h-14 items-center justify-center rounded-[12px] border border-[#d9e6f3] bg-white/85 px-8 text-base font-extrabold text-[#24364f] shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:bg-white"
              >
                登录 / 注册
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-sm font-bold text-[#52627a]">
              {['BOSS 直聘 JD', '拉勾岗位', '猎聘职位', '简历 PDF', '项目复盘', '面试记录'].map(item => (
                <span key={item} className="rounded-full border border-[#ddebf6] bg-white/70 px-3 py-1.5 shadow-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <HeroProductMockup />
        </div>
      </section>

      <section id="workflow" className="bg-white px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="text-center">
            <p className="text-sm font-black tracking-[0.16em] text-[#4a7dff]">从经历资料到职业身份层</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.01em] text-[#102033] md:text-5xl">
              让 Agent 先认识你，再替你完成求职任务
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['第一步', '统一输入', '简历、岗位 JD、项目记录、面试复盘都进入同一个输入框。', UploadCloud, 'bg-[#eaf6ff] text-app-blue-ink'],
              ['第二步', '识别经历', 'AI 抽取工作、项目、教育、奖项、技能和成果指标。', UserRound, 'bg-[#eafbf5] text-[#0f9f8f]'],
              ['第三步', '匹配岗位', '针对 BOSS、拉勾、猎聘等岗位描述提取能力要求。', BriefcaseBusiness, 'bg-[#fff2e7] text-[#ea7a2a]'],
              ['第四步', '生成材料', '按目标岗位组合证据，生成简历、求职信和面试故事。', MessageSquareText, 'bg-[#f2efff] text-[#6d5dfc]'],
            ].map(([step, title, text, Icon, tone]) => (
              <article key={title as string} className={`rounded-[22px] border border-white ${(tone as string).split(' ')[0]} p-7 text-center shadow-[0_18px_42px_rgba(15,23,42,0.06)]`}>
                <div className={`mx-auto grid h-16 w-16 place-items-center rounded-[18px] bg-white/72 ${(tone as string).split(' ')[1]}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <p className="mt-7 text-sm font-black tracking-[0.12em] text-[#7b8aa0]">{step as string}</p>
                <h3 className="mt-2 text-xl font-black text-[#102033]">{title as string}</h3>
                <p className="mt-3 text-sm leading-6 text-[#60708a]">{text as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#f6fbff] px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['多来源输入', '一个输入框接收文件、岗位描述、自由文本和后续浏览器插件采集内容。', LinkIcon],
              ['可编辑经历事件', '识别出的经历按 section 展示，每个事件都能点开修改固定字段。', FolderKanban],
              ['证据资料库', '生成材料时能追溯到原始经历、指标和上下文，而不是黑盒文本。', FileStack],
              ['岗位材料包', '围绕目标岗位生成中文简历版本、求职信、匹配说明和面试故事。', FileText],
              ['准备度检查', '标出缺失字段、薄弱证据、表达空泛和需要补充的数据。', Target],
              ['账号与隐私', '邮箱密码和 Google 登录共用统一会话，后续再扩展验证码。', Lock],
            ].map(([title, text, Icon]) => (
              <article key={title as string} className="rounded-[20px] border border-[#e3eef8] bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.055)]">
                <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#eaf6ff] text-[#4a7dff]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-black text-[#102033]">{title as string}</h3>
                <p className="mt-3 text-sm leading-6 text-[#60708a]">{text as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {modalOpen && (
        <AuthModal
          mode={mode}
          loading={loading}
          error={error}
          name={name}
          email={email}
          password={password}
          next={authReturnTo}
          onClose={() => setModalOpen(false)}
          onModeChange={nextMode => {
            setMode(nextMode)
            clearFlowState()
          }}
          onNameChange={setName}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onPasswordAuth={handlePasswordAuth}
        />
      )}
    </main>
  )
}

function TopNav({
  currentUser,
  checkingUser,
  onOpenAuth,
  onLogout,
}: {
  currentUser: AuthUser | null
  checkingUser: boolean
  onOpenAuth: (mode: AuthMode) => void
  onLogout: () => void
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName = currentUser?.name || currentUser?.email || currentUser?.phone || '用户'
  const avatarLabel = getAvatarLabel(displayName)

  return (
    <header className="sticky top-0 z-30 border-b border-[#e4edf7] bg-white/78 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#0f172a] text-xl font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]">
            求
          </div>
          <span className="text-xl font-black tracking-[-0.01em] text-[#102033]">求索 Copilot</span>
        </div>

        <nav className="hidden items-center gap-9 text-base font-bold text-[#5c6f8a] lg:flex">
          <a href="#features" className="inline-flex items-center gap-1 hover:text-[#4a7dff]">
            产品能力 <ChevronDown className="h-4 w-4" />
          </a>
          <a href="#workflow" className="hover:text-[#4a7dff]">工作流</a>
          <a href="#features" className="hover:text-[#4a7dff]">国内岗位</a>
          <a href="#features" className="hover:text-[#4a7dff]">关于我们</a>
        </nav>

        <div className="flex items-center gap-3">
          {checkingUser ? (
            <div className="hidden h-11 w-[138px] animate-pulse rounded-[12px] bg-[#eaf2fb] sm:block" />
          ) : currentUser ? (
            <>
              <a
                href="/dashboard"
                className="hidden h-11 items-center justify-center rounded-[12px] bg-[#4a7dff] px-5 text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(74,125,255,0.24)] transition hover:bg-[#4a7dff] sm:inline-flex"
              >
                进入工作台
              </a>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(open => !open)}
                  className="inline-flex h-11 max-w-[240px] items-center gap-2 rounded-[999px] border border-[#dbe8f5] bg-white px-2.5 pr-3 text-sm font-extrabold text-[#24364f] shadow-sm transition hover:bg-[#f7fbff]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f3ff] text-xs font-black text-[#4a7dff]">
                    {avatarLabel}
                  </span>
                  <span className="hidden max-w-[150px] truncate sm:block">{displayName}</span>
                  <ChevronDown className="h-4 w-4 text-[#8a9bb2]" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-[14px] border border-[#e3eef8] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                    <div className="border-b border-[#edf4fb] px-4 py-3">
                      <p className="truncate text-sm font-black text-[#102033]">{displayName}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#60708a]">已登录</p>
                    </div>
                    <a href="/dashboard" className="block px-4 py-3 text-sm font-bold text-[#24364f] hover:bg-[#f7fbff]">
                      进入工作台
                    </a>
                    <a href="/vault" className="block px-4 py-3 text-sm font-bold text-[#24364f] hover:bg-[#f7fbff]">
                      我的资料库
                    </a>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="block w-full px-4 py-3 text-left text-sm font-bold text-[#bd3b3b] hover:bg-[#fff4f4]"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex h-11 items-center justify-center rounded-[12px] bg-[#4a7dff] px-5 text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(74,125,255,0.24)] transition hover:bg-[#4a7dff]"
            >
              登录 / 注册
            </button>
          )}
          <button type="button" className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#dbe8f5] lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}

function getAvatarLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'U'
  return trimmed[0].toUpperCase()
}

function HeroProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:mt-8">
      <div className="rounded-[30px] border border-white/80 bg-white/78 p-3 shadow-[0_34px_90px_rgba(74,125,255,0.16)] backdrop-blur">
        <div className="rounded-[24px] border border-[#e3eef8] bg-[#fbfdff]">
          <div className="flex items-center justify-between border-b border-[#e3eef8] px-5 py-4">
            <div>
              <p className="text-xs font-black tracking-[0.14em] text-[#8a9bb2]">资料库构建中</p>
              <h3 className="mt-1 text-lg font-black text-[#102033]">统一输入</h3>
            </div>
            <span className="rounded-full bg-[#eafbf5] px-3 py-1 text-xs font-black text-[#0f9f8f]">已识别 12 条经历</span>
          </div>

          <div className="grid gap-4 p-5">
            <div className="rounded-[20px] border border-dashed border-[#b7d9f5] bg-white p-4 shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#eaf6ff] text-[#4a7dff]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-[#102033]">粘贴 JD、简历或经历记录</p>
                  <p className="mt-1 truncate text-sm text-[#60708a]">支持 BOSS / 拉勾 / 猎聘岗位描述，以及自由文本</p>
                </div>
              </div>
            </div>

            {[
              ['工作', '增长产品实习 · 字节跳动', '4 条可引用证据', BriefcaseBusiness, 'bg-[#ffeef0] text-[#e25570]'],
              ['项目', 'AI 简历评估器', '识别到 3 个量化指标', FolderKanban, 'bg-[#eaf6ff] text-app-blue-ink'],
              ['奖项', '国家奖学金', '字段完整，可用于简历', Award, 'bg-[#fff2d8] text-[#d97817]'],
            ].map(([type, title, meta, Icon, tone]) => (
              <div key={title as string} className="grid grid-cols-[76px_1fr_28px] items-center gap-3 rounded-[18px] border border-white bg-white px-4 py-3 shadow-[0_12px_26px_rgba(15,23,42,0.045)]">
                <span className={`rounded-full px-2 py-1 text-center text-xs font-black ${tone as string}`}>{type as string}</span>
                <div className="min-w-0">
                  <p className="truncate font-black text-[#102033]">{title as string}</p>
                  <p className="mt-1 text-sm text-[#60708a]">{meta as string}</p>
                </div>
                <Icon className="h-5 w-5 text-[#4a7dff]" />
              </div>
            ))}

            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-[16px] border border-[#dbe8f5] bg-white px-4 py-3 text-sm font-black text-[#4a7dff] shadow-sm"
            >
              <Plus className="h-4 w-4" />
              自定义添加经历 section
            </button>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-5 hidden rounded-[20px] border border-[#e3eef8] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(74,125,255,0.13)] md:block">
        <p className="text-xs font-bold text-[#60708a]">岗位材料包</p>
        <p className="mt-1 text-2xl font-black text-[#102033]">7 份待生成</p>
      </div>
    </div>
  )
}

function AuthModal(props: {
  mode: AuthMode
  loading: boolean
  error: string
  name: string
  email: string
  password: string
  next: string
  onClose: () => void
  onModeChange: (mode: AuthMode) => void
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPasswordAuth: () => void
}) {
  const isSignup = props.mode === 'signup'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#eef7ff]/82 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-[520px] rounded-[28px] border border-white/85 bg-white p-8 shadow-[0_30px_80px_rgba(74,125,255,0.18)] md:p-10">
        <button
          type="button"
          onClick={props.onClose}
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-[#8a9bb2] hover:bg-[#f0f7ff] hover:text-[#24364f]"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-7">
          <div className="mb-5 inline-flex items-center gap-3 text-sm font-black tracking-[0.08em] text-[#4a7dff]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eaf6ff]">
              <ArrowRight className="h-4 w-4" />
            </span>
            {isSignup ? '创建账号' : '欢迎回来'}
          </div>
          <h2 className="text-3xl font-black tracking-[-0.02em] text-[#102033]">
            {isSignup ? '开始建立你的求职资料库' : '登录求索 Copilot'}
          </h2>
          <p className="mt-2 text-base font-semibold text-[#60708a]">
            {isSignup ? '把简历、岗位和经历记录沉淀成可复用资产。' : '继续整理经历、匹配岗位和生成材料。'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#f0f7ff] p-1">
          {(['login', 'signup'] as AuthMode[]).map(authMode => (
            <button
              key={authMode}
              type="button"
              onClick={() => props.onModeChange(authMode)}
              className={`h-10 rounded-[8px] text-sm font-black transition ${
                props.mode === authMode ? 'bg-white text-[#4a7dff] shadow-sm' : 'text-[#60708a] hover:text-[#24364f]'
              }`}
            >
              {authMode === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <a
          href={getGoogleLoginUrl(props.next)}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[14px] border border-[#dbe8f5] bg-white text-lg font-black text-[#24364f] shadow-sm transition hover:bg-[#f7fbff]"
        >
          <GoogleMark />
          继续使用 Google
        </a>

        <div className="my-7 flex items-center gap-4 text-sm font-bold text-[#8a9bb2]">
          <div className="h-px flex-1 bg-[#e3eef8]" />
          <span>或使用账号登录</span>
          <div className="h-px flex-1 bg-[#e3eef8]" />
        </div>

        <div className="flex h-10 items-center gap-2 rounded-[12px] bg-[#eaf6ff] px-3 text-sm font-black text-[#4a7dff]">
          <Lock className="h-4 w-4" />
          邮箱密码登录
        </div>

        <div className="mt-5 space-y-4">
          {isSignup && (
            <Field icon={<UserRound className="h-5 w-5" />}>
              <input className={inputClass} value={props.name} onChange={e => props.onNameChange(e.target.value)} placeholder="你的名字" />
            </Field>
          )}

          <Field icon={<Mail className="h-5 w-5" />}>
            <input className={inputClass} type="email" value={props.email} onChange={e => props.onEmailChange(e.target.value)} placeholder="you@example.com" />
          </Field>

          <Field icon={<Lock className="h-5 w-5" />}>
            <input
              className={inputClass}
              type="password"
              value={props.password}
              onChange={e => props.onPasswordChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && props.onPasswordAuth()}
              placeholder={isSignup ? '密码，至少 8 个字符' : '请输入密码'}
            />
          </Field>

          {props.error && (
            <div className="rounded-[10px] border border-[#f1b8b8] bg-[#fff4f4] px-4 py-3 text-sm font-bold text-[#a63838]">
              {props.error}
            </div>
          )}

          <button
            type="button"
            onClick={props.onPasswordAuth}
            disabled={props.loading}
            className="h-[52px] w-full rounded-[14px] bg-[#4a7dff] px-4 py-3.5 text-base font-black text-white shadow-[0_14px_30px_rgba(74,125,255,0.22)] transition hover:bg-[#4a7dff] disabled:cursor-not-allowed disabled:bg-[#eef3f8] disabled:text-[#60708a]"
          >
            {isSignup ? '创建账号' : '登录'}
          </button>
        </div>

        <div className="mt-7 text-center text-base font-semibold text-[#60708a]">
          {isSignup ? '已经有账号？' : '还没有账号？'}{' '}
          <button
            type="button"
            onClick={() => props.onModeChange(isSignup ? 'login' : 'signup')}
            className="font-black text-[#4a7dff] hover:text-app-blue-ink"
          >
            {isSignup ? '去登录' : '去注册'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-14 items-center gap-3 rounded-[14px] border border-[#dbe8f5] bg-white px-4 text-[#8a9bb2] focus-within:border-[#4a7dff] focus-within:ring-4 focus-within:ring-[#4a7dff]/10">
      {icon}
      {children}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

const inputClass =
  'h-full min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-[#24364f] outline-none placeholder:text-[#8a9bb2]'
