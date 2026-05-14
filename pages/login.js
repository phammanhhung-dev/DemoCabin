import { useState } from "react";
import { useRouter } from "next/router";
import { Loader2, Github, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, me } from "../services/api";

export default function LoginPage() {
  const router = useRouter();
  const nextPath = typeof router.query?.next === "string" ? router.query.next : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await login(email, password);
      const data = res.data;

      localStorage.setItem("token", data.access_token);

      // Lấy thông tin role từ endpoint /me
      const userRes = await me();
      const userData = userRes.data;
      localStorage.setItem("role", userData.role);

      if (userData.role === "admin") {
        router.push("/admin");
      } else {
        router.push(nextPath || "/translate");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 selection:bg-blue-500/30 transition-colors duration-300">
      {/* Form Section */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 overflow-y-auto relative z-10 bg-white">
        <div className="w-full max-w-sm space-y-8 p-4 md:p-6">
          <div className="text-center lg:text-left mb-10">
            <h1 className="text-4xl font-black tracking-tight text-[#1E293B]">
              Chào mừng trở lại
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Nhập thông tin đăng nhập để truy cập Cabin
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 text-sm text-red-600 bg-red-50 rounded-2xl border border-red-100 animate-shake">
                {error}
              </div>
            )}

            {/* EMAIL */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
                EMAIL
              </label>
              <Input
                type="email"
                placeholder="abc@gmail.com"
                className="h-12 bg-[#F8FAFC] text-[#1E293B] border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
                MẬT KHẨU
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••"
                  className="h-12 pr-12 bg-[#F8FAFC] text-[#1E293B] border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <a
                  href="/forgot-password"
                  className="text-xs font-bold text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Quên mật khẩu?
                </a>
              </div>
            </div>

            {/* BUTTON */}
            <Button
              type="submit"
              className="w-full h-12 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>Đăng nhập ngay</>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 pt-4">
            Chưa có tài khoản?{" "}
            <a href="/register" className="font-black text-blue-600 hover:text-blue-500 transition-colors">
              Đăng ký
            </a>
          </p>
        </div>
      </div>

      {/* Right Decorative Section */}
      <div className="hidden lg:flex w-1/2 bg-[#0F172A] items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 text-center">
          <h2 className="text-white text-4xl md:text-5xl font-black tracking-tight">
            Nền tảng dịch thuật thông minh
          </h2>
        </div>
      </div>
    </div>
  );
}