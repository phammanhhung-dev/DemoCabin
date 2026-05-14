import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export default function AnalyticsChart({ data = [] }) {
  const chartData = data.length > 0 ? data : [
    { name: "T2", revenue: 0, translations: 0 },
    { name: "T3", revenue: 0, translations: 0 },
    { name: "T4", revenue: 0, translations: 0 },
    { name: "T5", revenue: 0, translations: 0 },
    { name: "T6", revenue: 0, translations: 0 },
    { name: "T7", revenue: 0, translations: 0 },
    { name: "CN", revenue: 0, translations: 0 },
  ];

  // Calculate totals from data
  const totalTranslations = chartData.reduce((sum, item) => sum + (item.translations || 0), 0);
  const totalRevenue = chartData.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const avgMonthly = chartData.length > 0 ? Math.round(totalRevenue / chartData.length) : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-gray-800 mb-2">{payload[0].payload.name}</p>
          <div className="space-y-1">
            <p className="text-blue-600 text-xs font-bold">Doanh thu: {payload[0].value.toLocaleString()}đ</p>
            <p className="text-emerald-500 text-xs font-bold">Lượt dịch: {payload[1].value} lần</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-1">Doanh số hàng tháng</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-tight opacity-70">Thống kê dữ liệu dịch thuật</p>
        </div>

        <div className="flex items-center gap-2">
          <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
            <option>Năm nay</option>
            <option>Năm ngoái</option>
          </select>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F8FAFC" />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 600 }}
              dy={15}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 600 }}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC', radius: 10 }} />
            <Legend verticalAlign="top" align="right" iconType="rect" iconSize={8} wrapperStyle={{ paddingBottom: '30px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B' }} />

            <Bar
              name="Doanh thu"
              dataKey="revenue"
              fill="#3B82F6"
              radius={[6, 6, 0, 0]}
              barSize={32}
            />

            <Bar
              name="Lượt dịch"
              dataKey="translations"
              fill="#818CF8"
              radius={[4, 4, 0, 0]}
              barSize={16}
            />

            <Line
              name="Xu hướng"
              type="monotone"
              dataKey="revenue"
              stroke="#F59E0B"
              strokeWidth={3}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-gray-50">
        <div className="text-center">
          <p className="text-2xl font-bold text-black">{totalTranslations.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Tổng lượt dịch</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-black">{totalRevenue.toLocaleString()}đ</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Tổng doanh thu</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-black">{avgMonthly.toLocaleString()}đ</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Trung bình/tháng</p>
        </div>
      </div>
    </div>
  );
}