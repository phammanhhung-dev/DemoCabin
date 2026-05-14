import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import {
  History as HistoryIcon,
  User,
  Zap,
  Bell,
  LogOut,
  Settings,
  PlusCircle,
  LifeBuoy,
  BookOpen,
  Coins,
  ChevronDown,
  Moon
} from "lucide-react";

import { me, getUnreadCount } from "../services/api";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [userData, setUserData] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);

  // Fetch user data khi token thay đổi
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      setIsLoggedIn(true);
      fetchUserProfile();
      fetchUnreadCount();
    }

    // Lắng nghe sự kiện cập nhật thông báo từ các trang khác
    const handleUpdate = () => fetchUnreadCount();
    const handleUserUpdate = () => fetchUserProfile();

    window.addEventListener("notificationUpdate", handleUpdate);
    window.addEventListener("userUpdate", handleUserUpdate);

    return () => {
      window.removeEventListener("notificationUpdate", handleUpdate);
      window.removeEventListener("userUpdate", handleUserUpdate);
    };
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await me();
      const data = res.data;
      const userInfo = {
        name: data.full_name || data.name || "User",
        email: data.email,
        balance: data.balance || "0",
        token_balance: data.token_balance || 0,
        avatar_url: data.avatar_url || null,
        id: data.id,
      };
      setUserData(userInfo);
      localStorage.setItem("user", JSON.stringify(userInfo));

      // Kiểm tra cảnh báo nếu credits thấp
      if (data.token_balance < 10000) {
        console.warn("Cảnh báo: Số dư credits của bạn đang ở mức thấp!");
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get first letter of email or name for avatar
  const getInitial = (user) => {
    if (user?.email) return user.email.charAt(0).toUpperCase();
    if (user?.name) return user.name.charAt(0).toUpperCase();
    return "U";
  };

  const defaultUserData = {
    name: "Nguyễn Thành Dư",
    email: "kn1949799@gmail.com",
    balance: "1.250",
    token_balance: 0,
    avatar_url: null
  };

  const user = userData || defaultUserData;

  return (
    <nav className="sticky top-0 z-50 bg-[#0F172A]/80 backdrop-blur-xl border-b border-white/5 text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-4 md:px-6 py-4">

        {/* LOGO & NAVIGATION */}
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/translate">
            <h1 className="text-2xl font-black text-blue-500 tracking-tighter cursor-pointer">
              CABIN
            </h1>
          </Link>

          <div className="flex gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
            {["/translate", "/voice"].map((path) => (
              <Link
                key={path}
                href={path}
                className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${pathname === path ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"
                  }`}
              >
                {path === "/translate" ? "Cabin" : "Voice"}
              </Link>
            ))}
          </div>
        </div>

        {/* CÁC TIỆN ÍCH & USER SECTION */}
        <div className="flex items-center gap-2 md:gap-3">


          <Link href="/guide" className="hidden lg:flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-white transition-all group">
            <BookOpen size={14} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black tracking-widest uppercase">
              Hướng dẫn sử dụng
            </span>
          </Link>

          <Link href="/notifications" className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#0F172A]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <Link href="/history" className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
            <HistoryIcon size={18} />
          </Link>

          {/* HIỂN THỊ CREDITS 1 */}
          {isLoggedIn && userData && (
            <Link
              href="/billing"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              <Zap size={14} className="text-blue-400" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-black tracking-tight">
                  {Number(userData.token_balance).toLocaleString('vi-VN')}
                </span>
                <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Credits</span>
              </div>
            </Link>
          )}

          {/* LOGIC ĐĂNG NHẬP / DROPDOWN MENU */}
          {!isLoggedIn ? (
            <Link
              href="/login"
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-500 transition-all active:scale-95"
            >
              <User size={16} />
              <span>Đăng nhập</span>
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <div
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-3 p-1.5 pr-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs border border-white/20 overflow-hidden shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitial(user)
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">
                    {Number(user.token_balance).toLocaleString('vi-VN')}
                  </span>
                  <ChevronDown size={14} className={`text-gray-500 transition-transform ${showMenu ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* DROPDOWN MENU */}
              {showMenu && (
                <div className="absolute right-0 mt-3 w-64 bg-[#1E293B] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-4 text-foreground overflow-hidden z-[100] animate-in fade-in zoom-in duration-200">
                  <div className="px-6 py-2 mb-4">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Thành viên Premium</p>
                    <p className="text-sm font-bold text-white truncate">{user.email}</p>
                  </div>

                  <div className="px-6 mb-6">
                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => router.push('/billing')}>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Số dư hiện tại</span>
                        <p className="text-sm font-black text-white">
                          {user.token_balance ? Number(user.token_balance).toLocaleString('vi-VN') : '0'} <span className="text-[10px] text-slate-500 lowercase font-bold">credits</span>
                        </p>
                      </div>
                      <PlusCircle size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>

                  <div className="space-y-1 px-2">
                    <Link href="/profile" className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-all group">
                      <User size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Hồ sơ cá nhân</span>
                    </Link>

                    <Link href="/support" className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-all group">
                      <LifeBuoy size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Hỗ trợ kỹ thuật</span>
                    </Link>

                    <div className="flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-xl transition-all group cursor-default">
                      <div className="flex items-center gap-4">
                        <Moon size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Giao diện: Tối</span>
                      </div>
                      <div className="w-8 h-4 bg-blue-600 rounded-full relative">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 px-2">
                    <button
                      onClick={() => {
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                        localStorage.removeItem("role");
                        setIsLoggedIn(false);
                        setShowMenu(false);
                        router.push("/login");
                      }}
                      className="w-full px-4 py-3 flex items-center gap-4 hover:bg-red-500/10 text-red-500 transition-all rounded-xl font-bold text-sm group"
                    >
                      <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div >
    </nav >
  );
}