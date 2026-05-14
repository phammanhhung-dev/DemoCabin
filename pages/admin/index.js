import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Sidebar from "../../components/admin/Sidebar"
import Navbar from "../../components/admin/Navbar"
import StatCard from "../../components/admin/StatCard"
import AnalyticsChart from "../../components/admin/AnalyticsChart"
import { Users, Coins, BarChart3, DollarSign, Calendar, MoreHorizontal, ArrowUpRight } from "lucide-react"
import API from "../../services/api";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role !== "admin") {
        router.push("/translate");
        return;
      }
      fetchStats();
    } catch (err) {
      router.push("/login");
    }
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await API.get("/tp/admin/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Lỗi fetch stats:", err);
      setError(err.response?.data?.detail || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <Navbar />

        <main className="p-4 md:p-6 2xl:p-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Section 1: Stat Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5 mb-6">
            <StatCard
              title="Người Dùng"
              value={stats?.users?.total || 0}
              percentage="0"
              isUp={true}
              icon={Users}
              subtitle={`Active: ${stats?.users?.active || 0} | Banned: ${stats?.users?.banned || 0}`}
              onClick={() => router.push('/admin/users')}
            />
            <StatCard
              title="Token"
              value={stats?.tokens?.current_balance?.toLocaleString() || 0}
              percentage="38.76"
              isUp={true}
              icon={Coins}
              subtitle={`Đã cấp: ${stats?.tokens?.total_issued?.toLocaleString() || 0} | Đã dùng: ${stats?.tokens?.total_used?.toLocaleString() || 0}`}
              chartColor="#10B981"
            />
            <StatCard
              title="Lượt Dịch"
              value={stats?.translations?.total || 0}
              percentage="0"
              isUp={true}
              icon={BarChart3}
              subtitle={`Hôm nay: ${stats?.translations?.today || 0}`}
              chartColor="#8B5CF6"
            />
            <StatCard
              title="Doanh Thu"
              value={`${stats?.revenue?.total?.toLocaleString() || 0}đ`}
              percentage="0"
              isUp={true}
              icon={DollarSign}
              subtitle="Chưa có dữ liệu"
              chartColor="#F59E0B"
            />
          </div>

          {/* Section 2: Charts & Monthly Goal */}
          <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5 mb-6">
            <div className="col-span-12 xl:col-span-8">
              <AnalyticsChart data={stats?.chart_data} />
            </div>

            <div className="col-span-12 xl:col-span-4 bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-[2px]">Mục tiêu hàng tháng</h3>
                <button className="text-gray-400 hover:text-black transition-colors"><MoreHorizontal size={20} /></button>
              </div>

              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative flex items-center justify-center">
                  <svg className="w-64 h-64 transform -rotate-90">
                    <circle className="text-gray-50" strokeWidth="16" stroke="currentColor" fill="transparent" r="95" cx="128" cy="128" />
                    <circle
                      className="text-blue-600"
                      strokeWidth="16"
                      strokeDasharray={597}
                      strokeDashoffset={597 - (597 * 75.55) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="95" cx="128" cy="128"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center rotate-90">
                    <span className="text-5xl font-black text-slate-900">75.55%</span>
                    <div className="flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full mt-2">
                      <ArrowUpRight size={14} className="text-green-600" />
                      <span className="text-green-600 text-[11px] font-black">+10%</span>
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs text-gray-400 mt-10 px-8 italic leading-relaxed font-medium">
                  Hôm nay bạn kiếm được <span className="text-slate-900 font-bold">3.287 đô la</span>, cao hơn tháng trước. Cứ tiếp tục làm tốt nhé!
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-gray-100 mt-8 pt-8 text-center">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-[1px]">Mục tiêu</p>
                  <p className="font-black text-sm text-slate-900 mt-1">20k $</p>
                </div>
                <div className="border-x border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-[1px]">Doanh thu</p>
                  <p className="font-black text-sm text-slate-900 mt-1">20k $</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-[1px]">Hôm nay</p>
                  <p className="font-black text-sm text-slate-900 mt-1">20k $</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Tables */}
          <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
            {/* Recent Recharges */}
            <div className="col-span-12 xl:col-span-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-black text-sm uppercase tracking-wider">Nạp Token Gần Đây</h3>
                <button onClick={() => router.push('/admin/billing')} className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>
              <div className="space-y-4">
                {stats?.recent_recharges?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                        <Coins size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">{item.user_name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{new Date(item.time).toLocaleTimeString('vi-VN')} - {new Date(item.time).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-emerald-600">{item.amount.toLocaleString()}đ</p>
                  </div>
                ))}
                {(!stats?.recent_recharges || stats.recent_recharges.length === 0) && (
                  <div className="py-10 text-center text-gray-400 text-sm italic">Chưa có giao dịch nạp token nào</div>
                )}
              </div>
            </div>

            {/* Top Users */}
            <div className="col-span-12 xl:col-span-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-black text-sm uppercase tracking-wider">Top Người Dùng</h3>
                <button onClick={() => router.push('/admin/users')} className="text-[11px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>
              <div className="space-y-4">
                {stats?.top_users?.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">{user.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">Người dùng tiêu biểu</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-blue-600">{user.used_tokens.toLocaleString()} token</p>
                  </div>
                ))}
                {(!stats?.top_users || stats.top_users.length === 0) && (
                  <div className="py-10 text-center text-gray-400 text-sm italic">Chưa có dữ liệu người dùng tiêu biểu</div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}