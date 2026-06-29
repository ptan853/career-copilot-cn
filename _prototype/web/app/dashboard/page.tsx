export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-[#1B4A8F] uppercase tracking-wider">YOUR JOB SEARCH</p>
          <h1 className="text-2xl font-bold text-[#1A1A2E] mt-1">今天该推进哪一步？</h1>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-sm font-medium hover:bg-gray-50">
            上传材料
          </button>
          <button className="px-4 py-2 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB]">
            新建岗位
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '已生成材料', value: '0', sub: '上传简历开始' },
          { label: '目标公司', value: '0', sub: '添加目标岗位' },
          { label: '面试率', value: '--', sub: '投递后显示' },
          { label: '连续推进', value: '0d', sub: '开始使用' },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-[#D0D5DD] rounded-lg p-4">
            <p className="text-xs text-[#5A6A7A] mb-2">{m.label}</p>
            <p className="text-2xl font-bold text-[#1A1A2E]">{m.value}</p>
            <p className="text-xs text-[#5A6A7A] mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* 空状态引导 */}
      <div className="bg-white border border-dashed border-[#D0D5DD] rounded-lg p-12 text-center">
        <p className="text-lg font-medium text-[#1A1A2E] mb-2">开始你的求职准备</p>
        <p className="text-sm text-[#5A6A7A] mb-6">上传一份简历或粘贴 JD，AI 会自动帮你分析和管理</p>
        <div className="flex justify-center gap-4">
          <button className="px-6 py-2.5 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB]">
            上传简历
          </button>
          <button className="px-6 py-2.5 border border-[#D0D5DD] rounded-lg text-sm font-medium hover:bg-gray-50">
            粘贴 JD
          </button>
        </div>
      </div>
    </div>
  )
}
