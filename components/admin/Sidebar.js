import { LayoutDashboard, Users, History, BarChart3, X, Zap, Bell, UserCircle, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const pathname = usePathname();
  return (
    <>
      <div
        className={`fixed inset-0 z-[50] bg-black/50 transition-opacity lg:hidden ${sidebarOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
          }`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <aside
        className={`fixed inset-y-0 left-0 z-[60] flex w-72 flex-col bg-[#1c2434] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-8 py-8 lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="bg-[#3B82F6] p-2.5 rounded-xl text-white font-black text-xl shadow-lg shadow-blue-500/20 tracking-tighter">CB</div>
            <span className="text-white text-2xl font-black tracking-tight">Cabin</span>
          </div>

          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col overflow-y-auto px-4 custom-scrollbar">
          <nav className="mt-2 px-2">
            <p className="mb-4 ml-4 text-[10px] font-black text-[#8a99af] uppercase tracking-[2px] opacity-60">MENU CHÍNH</p>
            <ul className="space-y-1.5 mb-8">
              <li>
                <Link href="/admin" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <LayoutDashboard size={20} className={pathname === '/admin' ? 'text-[#3B82F6]' : 'text-[#8a99af] group-hover:text-[#3B82F6]'} /> Bảng điều khiển
                </Link>
              </li>
              <li>
                <Link href="/admin/users" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/users' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <Users size={20} className={pathname === '/admin/users' ? 'text-[#3B82F6]' : 'text-[#8a99af] group-hover:text-[#3B82F6]'} /> Người dùng
                </Link>
              </li>
              <li>
                <Link href="/admin/history" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/history' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <History size={20} className={pathname === '/admin/history' ? 'text-[#3B82F6]' : 'text-[#8a99af] group-hover:text-[#3B82F6]'} /> Lịch sử dịch
                </Link>
              </li>
              <li>
                <Link href="/admin/analytics" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/analytics' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <BarChart3 size={20} className={pathname === '/admin/analytics' ? 'text-[#3B82F6]' : 'text-[#8a99af] group-hover:text-[#3B82F6]'} /> Phân tích
                </Link>
              </li>
            </ul>

            {/* PHẦN MỚI: TÀI KHOẢN & DỊCH VỤ */}
            <p className="mb-4 ml-4 text-[10px] font-black text-[#8a99af] uppercase tracking-[2px] opacity-60">DỊCH VỤ & TÀI KHOẢN</p>
            <ul className="space-y-1.5">
              <li>
                <Link href="/admin/billing" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/billing' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <Zap size={20} className={pathname === '/admin/billing' ? 'text-amber-500' : 'text-[#8a99af] group-hover:text-amber-500'} /> Nạp Token
                </Link>
              </li>
              <li>
                <Link href="/admin/notifications" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/notifications' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <Bell size={20} className={pathname === '/admin/notifications' ? 'text-green-500' : 'text-[#8a99af] group-hover:text-green-500'} /> Thông báo
                </Link>
              </li>
              <li>
                <Link href="/admin/support" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/support' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <MessageSquare size={20} className={pathname === '/admin/support' ? 'text-blue-400' : 'text-[#8a99af] group-hover:text-blue-400'} /> Hỗ trợ
                </Link>
              </li>
              <li>
                <Link href="/admin/profile" className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 ${pathname === '/admin/profile' ? 'bg-[#333a48] text-white shadow-sm' : 'text-[#8a99af] hover:bg-[#333a48] hover:text-white'}`}>
                  <UserCircle size={20} className={pathname === '/admin/profile' ? 'text-purple-500' : 'text-[#8a99af] group-hover:text-purple-500'} /> Hồ sơ cá nhân
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333a48; border-radius: 10px; }
      `}</style>
    </>
  );
}