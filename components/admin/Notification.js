import { useState, useEffect } from "react";
import { Bell, CheckCircle, AlertTriangle, Gift, MessageSquare, UserPlus, DollarSign, Info } from "lucide-react";
import Link from "next/link";
import { getNotifications, getUnreadCount, markAllRead } from "../../services/api";

export default function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data);
      const countRes = await getUnreadCount();
      setUnreadCount(countRes.data.count);
    } catch (error) {
      console.error("Lỗi khi lấy thông báo:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc:", error);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'user_registration':
        return <UserPlus className="text-blue-500" size={16} />;
      case 'revenue':
        return <DollarSign className="text-green-500" size={16} />;
      case 'support':
        return <MessageSquare className="text-amber-500" size={16} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500" size={16} />;
      case 'promo':
        return <Gift className="text-purple-500" size={16} />;
      default:
        return <Info className="text-gray-500" size={16} />;
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="relative">
      {/* Icon Chuông trên Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell size={22} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {/* Dropdown thông báo */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-800">Thông báo mới nhất</span>
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-blue-600 hover:underline uppercase"
              >
                Đánh dấu đã đọc
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <Link key={n.id} href={n.link || "/admin/notifications"}>
                    <div
                      className={`p-4 border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors flex gap-3 ${!n.is_read ? 'bg-blue-50/10' : ''}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="mt-1 flex-shrink-0">{getIcon(n.type)}</div>
                      <div className="flex-grow">
                        <h5 className="text-sm font-semibold text-gray-900 leading-tight">{n.title}</h5>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                        <span className="text-[10px] text-gray-400 mt-2 block font-medium">{formatTime(n.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-400">Bạn không có thông báo nào</p>
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-gray-50 text-center border-t border-gray-100">
              <Link href="/admin/notifications">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors py-1 w-full uppercase tracking-tighter"
                >
                  Xem tất cả thông báo
                </button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
