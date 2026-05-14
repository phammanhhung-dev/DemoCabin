import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import {
  Bell, CheckCircle, AlertTriangle, Gift, Trash2,
  MoreVertical, Mail, MailOpen, Info, CheckCheck, CheckCircle2
} from "lucide-react";
import {
  getNotifications, markAllRead, markNotificationRead,
  markNotificationUnread, deleteNotification, deleteAllNotifications
} from "../services/api";
import { showConfirm, showToast } from "../utils/alerts";

export default function AllNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const limit = 10;

  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);
  const observerRef = useRef(null);
  const lastElementRef = useRef(null);

  const fetchNotifications = async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
      setSkip(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentSkip = isInitial ? 0 : skip;
      const res = await getNotifications(currentSkip, limit);
      const newData = res.data || [];

      if (isInitial) {
        setNotifications(newData);
        setSkip(newData.length);
      } else {
        setNotifications(prev => [...prev, ...newData]);
        setSkip(prev => prev + newData.length);
      }

      if (newData.length < limit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Lỗi lấy thông báo:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    if (loading || !hasMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchNotifications(false);
      }
    });

    if (lastElementRef.current) {
      observerRef.current.observe(lastElementRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, hasMore, loadingMore, skip]);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      fetchNotifications(true);
      window.dispatchEvent(new Event("notificationUpdate"));
    } catch (err) {
      console.error("Lỗi đánh dấu tất cả:", err);
    }
  };

  const handleDeleteAll = async () => {
    const result = await showConfirm(
      "Xóa tất cả?",
      "Bạn có chắc chắn muốn xóa tất cả thông báo không? Hành động này không thể hoàn tác.",
      "warning",
      "Xóa hết",
      "Hủy"
    );

    if (!result.isConfirmed) return;

    try {
      await deleteAllNotifications();
      setNotifications([]);
      setHasMore(false);
      showToast("Đã xóa toàn bộ thông báo");
      window.dispatchEvent(new Event("notificationUpdate"));
    } catch (err) {
      console.error("Lỗi xóa tất cả:", err);
    }
  };

  const handleMarkOneRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      window.dispatchEvent(new Event("notificationUpdate"));
    } catch (err) {
      console.error("Lỗi đánh dấu đã đọc:", err);
    }
  };

  const handleToggleRead = async (e, id, currentRead) => {
    e.stopPropagation();
    try {
      if (currentRead) {
        await markNotificationUnread(id);
      } else {
        await markNotificationRead(id);
      }
      setActiveMenu(null);
      // Thay vì fetchNotifications(true) làm reset cả trang, ta chỉ cập nhật item đó cục bộ
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: !currentRead } : n));
      window.dispatchEvent(new Event("notificationUpdate"));
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái đọc:", err);
    }
  };

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setActiveMenu(null);
      setNotifications(notifications.filter(n => n.id !== id));
      window.dispatchEvent(new Event("notificationUpdate"));
    } catch (err) {
      console.error("Lỗi xóa thông báo:", err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-400" size={24} />;
      case 'warning': return <AlertTriangle className="text-amber-400" size={24} />;
      case 'error': return <AlertTriangle className="text-red-400" size={24} />;
      case 'promo': return <Gift className="text-blue-400" size={24} />;
      case 'user_registration': return <Info className="text-purple-400" size={24} />;
      default: return <Bell className="text-slate-400" size={24} />;
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    }) + " " + d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (<div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">
    <Navbar />

    <main className="max-w-4xl mx-auto px-4 py-12 md:py-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">Tất cả thông báo</h1>
          <p className="text-slate-400 text-sm">Xem và quản lý các hoạt động của bạn</p>
        </div>
        <div className="flex items-center gap-4">
          {notifications.length > 0 && (
            <>
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-widest transition-all"
              >
                <CheckCheck size={16} />
                Đọc tất cả
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest transition-all"
              >
                <Trash2 size={16} />
                Xóa tất cả
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-[#1E293B]/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="py-32 text-center">
            <div className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 mt-6 font-medium">Đang tải thông báo...</p>
          </div>
        ) : notifications.length > 0 ? (
          <>
            {notifications.map((n, index) => (
              <div
                key={n.id}
                ref={index === notifications.length - 1 ? lastElementRef : null}
                onClick={() => handleMarkOneRead(n.id, n.is_read)}
                className={`p-6 md:p-8 border-b border-white/5 hover:bg-white/[0.03] transition-all flex gap-6 items-start group relative cursor-pointer ${!n.is_read ? 'bg-blue-500/[0.05] border-l-4 border-l-blue-500' : 'bg-white/[0.01]'}`}
              >
                {/* Wrapper cho nội dung để áp dụng opacity khi đã đọc */}
                <div className={`flex gap-6 items-start flex-grow min-w-0 transition-opacity duration-300 ${n.is_read ? 'opacity-40' : 'opacity-100'}`}>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all shrink-0 ${!n.is_read
                    ? 'bg-emerald-500/20 border-emerald-500/30'
                    : 'bg-white/10 border-white/10'}`}>
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-black text-lg md:text-xl text-white truncate">
                          {n.title}
                        </h3>
                        {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 mt-1.5">
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed mb-1 line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                </div>

                {/* Menu hành động - Luôn sáng rõ (opacity-100) */}
                <div className="relative z-10" ref={activeMenu === n.id ? menuRef : null}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === n.id ? null : n.id);
                    }}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <MoreVertical size={20} />
                  </button>

                  {activeMenu === n.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                      <button
                        onClick={(e) => handleToggleRead(e, n.id, n.is_read)}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-white hover:bg-white/5 flex items-center gap-3"
                      >
                        {n.is_read ? <Mail size={16} className="text-blue-400" /> : <MailOpen size={16} className="text-blue-400" />}
                        {n.is_read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                      </button>
                      <button
                        onClick={(e) => handleDeleteOne(e, n.id)}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-3"
                      >
                        <Trash2 size={16} />
                        Xóa thông báo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loadingMore && (
              <div className="py-8 text-center border-t border-white/5">
                <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 mt-2 text-xs font-medium uppercase tracking-widest">Đang tải thêm...</p>
              </div>
            )}

            {!hasMore && notifications.length > limit && (
              <div className="py-8 text-center opacity-40">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Bạn đã xem hết thông báo</p>
              </div>
            )}
          </>
        ) : (
          <div className="py-32 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell size={32} className="text-slate-700" />
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Không có thông báo mới</p>
          </div>
        )}
      </div>
    </main>
  </div>
  );
}
