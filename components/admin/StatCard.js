import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export default function StatCard({ title, value, percentage, isUp, icon: Icon, subtitle, onClick, chartColor = "#3C50E0" }) {
  return (
    <div
      onClick={onClick}
      className={`group relative bg-white p-7 rounded-[2rem] border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex flex-col transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-xl hover:border-blue-200 hover:-translate-y-1' : ''
        }`}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${title === 'Người Dùng' ? 'bg-blue-50 text-blue-500' :
              title === 'Token' ? 'bg-indigo-50 text-indigo-500' :
                title === 'Lượt Dịch' ? 'bg-emerald-50 text-emerald-500' :
                  'bg-amber-50 text-amber-500'
            }`}>
            <Icon size={22} strokeWidth={2.5} />
          </div>

          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black tracking-wider ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
            {isUp ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
            {percentage}%
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] block mb-1">
            {title}
          </span>
          <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {value}
          </h4>
          {subtitle && (
            <div className="mt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider">
                {subtitle.split('|').map((part, index) => {
                  let colorClass = 'text-gray-400';
                  const p = part.trim();

                  if (p.includes('Đã cấp') || p.includes('Active')) colorClass = 'text-blue-500/80';
                  else if (p.includes('Đã dùng')) colorClass = 'text-emerald-500/80';
                  else if (p.includes('Banned')) colorClass = 'text-red-400/80';
                  else if (p.includes('Hôm nay')) colorClass = 'text-indigo-500/80';
                  else if (p.includes('Chưa có dữ liệu')) colorClass = 'text-slate-400/60';

                  return (
                    <span key={index}>
                      {index > 0 && <span className="mx-1.5 text-gray-200">|</span>}
                      <span className={colorClass}>
                        {p}
                      </span>
                    </span>
                  );
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}