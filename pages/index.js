import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState(null);

  useEffect(() => {
    setToken(getToken());
  }, []);

  const goTranslate = () => {
    if (getToken()) router.push("/translate");
    else router.push("/login?next=/translate");
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/20 transition-colors duration-300">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-14 shadow-2xl overflow-hidden relative">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full dark:opacity-100 opacity-30" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-600/10 blur-[120px] rounded-full dark:opacity-100 opacity-30" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest">
              Cabin Translation Platform
            </div>

            <h1 className="mt-6 text-3xl md:text-5xl font-black tracking-tight text-white">
              Dịch nhanh, chuẩn, tối ưu cho tiếng Việt.
            </h1>
            <p className="mt-4 text-slate-400 max-w-2xl leading-relaxed">
              Bạn có thể xem trang chủ tự do. Để dùng tính năng <strong>Dịch</strong>, hệ thống sẽ yêu cầu
              đăng nhập hoặc tạo tài khoản.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={goTranslate}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition"
              >
                Dịch ngay
              </button>
              {!token ? (
                <>
                  <Link
                    href="/login"
                    className="px-6 py-3 rounded-2xl bg-white text-slate-900 hover:bg-blue-50 font-bold active:scale-95 transition"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    href="/register"
                    className="px-6 py-3 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 font-bold active:scale-95 transition"
                  >
                    Tạo tài khoản
                  </Link>
                </>
              ) : (
                <Link
                  href="/translate"
                  className="px-6 py-3 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 font-bold active:scale-95 transition"
                >
                  Vào trang dịch
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

