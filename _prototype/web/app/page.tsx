import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-4xl font-bold text-[#1B4A8F] mb-2">Career Copilot CN</h1>
      <p className="text-[#5A6A7A] mb-8">国内版 AI 求职工作台</p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-[#1B4A8F] text-white rounded-lg font-medium hover:bg-[#2563EB] transition-colors"
        >
          进入工作台
        </Link>
      </div>
    </div>
  )
}
