import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { Bell, CheckCircle, AlertTriangle, Gift, MessageSquare, UserPlus, DollarSign, Info, Trash2 } from "lucide-react";
import { getNotifications, markAllRead } from "../../services/api";
import Link from "next/link";

export default function AllNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data);
    } catch (error) {
      console.error("Lỗi khi lấy thông báo:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc:", error);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'user_registration':
        return <UserPlus className="text-blue-500" />;
      case 'revenue':
        return <DollarSign className="text-green-500" />;
      case 'support':
        return <MessageSquare className="text-amber-500" />;
      case 'success':
        return <CheckCircle className="text-green-500" />;
      case 'warning':
        return <AlertTriangle className="text-amber-500" />;
      case 'promo':
        return <Gift className="text-purple-500" />;
      default:
        return <Info className="text-gray-500" />;
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-black">Tất cả thông báo</h1>
            <p className="text-slate-400 text-sm">Xem và quản lý các hoạt động của hệ thống</p>
          </div>
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-blue-500 hover:text-blue-400 font-medium flex items-center gap-2"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        <div className="bg-[#1C2434] rounded-2xl border border-[#2B3544] overflow-hidden shadow-lg">
          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-slate-400 mt-4">Đang tải thông báo...</p>
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((n) => (
              <Link key={n.id} href={n.link || "#"}>
                <div className={`p-6 border-b border-[#2B3544] hover:bg-slate-800/50 transition-colors flex gap-5 items-start group cursor-pointer ${!n.is_read ? 'bg-blue-900/20' : 'bg-white/[0.01]'}`}>
                  <div className="p-4 bg-slate-900 rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-white/5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">
                        {n.title}
                        {!n.is_read && <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">{formatTime(n.created_at)}</span>
                    </div>
                    <p className="text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-20 text-center">
              <Bell size={48} className="mx-auto text-slate-700 mb-4 opacity-20" />
              <p className="text-slate-500 font-medium text-lg">Bạn không có thông báo nào</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
