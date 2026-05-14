import AdminLayout from "../../components/admin/AdminLayout";
import AnalyticsChart from "../../components/admin/AnalyticsChart";
import { TrendingUp, Globe, Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import API from "../../services/api";

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await API.get("/tp/admin/stats");
        setStats(res.data);
      } catch (err) {
        console.error("Lỗi fetch stats:", err);
        setError(err.response?.data?.detail || "Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <AdminLayout>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black">Lưu lượng dịch thuật theo tháng</h2>
        <p className="text-xs font-medium text-gray-500 mt-1">Thống kê dữ liệu trong 12 tháng gần nhất</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 text-sm">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-[500px] text-gray-500 font-medium">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p>Đang tải dữ liệu phân tích...</p>
            </div>
          </div>
        ) : (
          <AnalyticsChart data={stats?.chart_data} />
        )}
      </div>
    </AdminLayout>
  );
}