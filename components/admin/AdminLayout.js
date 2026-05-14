import { useState, useEffect } from "react";
import Sidebar from "./Sidebar"
import Navbar from "./Navbar"

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1">
        <Navbar setSidebarOpen={setSidebarOpen} />
        <main className="p-8 overflow-y-auto bg-muted/30">
          {mounted ? children : <div className="flex items-center justify-center h-full text-muted-foreground">Đang tải...</div>}
        </main>
      </div>
    </div>
  )
}