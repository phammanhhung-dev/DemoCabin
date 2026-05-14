"use client";

import { useState, useEffect } from "react";
import { Search, Bell, MessageSquare, ChevronDown, Menu } from "lucide-react";
import { useRouter } from "next/router";
import Notification from "./Notification";
import { me } from "../../services/api";

export default function Navbar({ setSidebarOpen }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchUser = async () => {
      try {
        const res = await me();
        setUser(res.data);
      } catch (err) {
        console.error("Failed to fetch user in Navbar:", err);
      }
    };
    fetchUser();
  }, [mounted]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/login");
  };

  if (!mounted) {
    return (
      <header className="sticky top-0 z-40 flex w-full bg-card border-b border-border shadow-sm">
        <div className="flex flex-grow items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-muted-foreground hover:bg-muted rounded-md"
            >
              <Menu size={24} />
            </button>
          </div>

          <div className="relative w-96">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="🔍 Tìm kiếm..."
              className="w-full bg-muted/50 rounded-md border border-border py-2.5 pl-11 pr-4 focus:outline-none focus:border-blue-500 transition-all"
              disabled
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="px-4 py-1.5 text-xs font-bold bg-muted text-muted-foreground rounded-md">
                ...
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex w-full bg-card border-b border-border shadow-sm">
      <div className="flex flex-grow items-center justify-between px-8 py-4">

        <div className="flex items-center gap-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-muted-foreground hover:bg-muted rounded-md"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-96">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="🔍 Tìm kiếm..."
            className="w-full bg-muted/50 rounded-md border border-border py-2.5 pl-11 pr-4 focus:outline-none focus:border-blue-500 transition-all text-foreground"
          />
        </div>

        {/* Icons & User */}
        <div className="flex items-center gap-4">


          {/* Buttons mới */}
          <div className="flex items-center gap-2 mr-2">
            <button
              onClick={() => router.push("/translate")}
              className="px-6 py-2 text-sm font-bold bg-[#3B82F6] text-white rounded-xl hover:bg-blue-600 transition shadow-sm"
            >
              Translate
            </button>

            <button
              onClick={handleLogout}
              className="px-6 py-2 text-sm font-bold bg-[#EF4444] text-white rounded-xl hover:bg-red-600 transition shadow-sm"
            >
              Đăng xuất
            </button>
          </div>

          {/* Notification icons */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Notification />
            <div
              onClick={() => router.push("/admin/support")}
              className="p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
            >
              <MessageSquare size={22} strokeWidth={1.5} />
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-4 pl-4 border-l border-border cursor-pointer group" onClick={() => router.push("/admin/profile")}>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-foreground group-hover:text-blue-600 transition-colors leading-tight">admin</p>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">ADMIN</p>
            </div>
            <div className="relative">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  className="h-10 w-10 rounded-full object-cover border-2 border-background shadow-md ring-1 ring-border"
                  alt="User"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-sm font-black uppercase border-2 border-background shadow-md ring-1 ring-border">
                  {user?.full_name ? user.full_name.charAt(0) : "A"}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#22C55E] border-2 border-background rounded-full shadow-sm"></div>
            </div>
            <ChevronDown size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>
      </div>
    </header>
  );
}