import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { register } from "../services/api";
import { showAlert } from "../utils/alerts";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await register({
        full_name: fullName,
        email,
        password,
      });

      if (res.status === 200) {
        showAlert("Thành công", "Đăng ký thành công! Vui lòng đăng nhập.", "success").then(() => {
          router.push("/login");
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">

      {/* LEFT Decorative Section */}
      <div className="hidden lg:flex w-1/2 bg-slate-950 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full" />

        <div className="relative z-10 text-center">
          <h2 className="text-white text-4xl md:text-5xl font-black tracking-tight mb-6">
            Tham gia vào tương lai của <br />
            <span className="text-blue-500">truyền thông</span>
          </h2>
          <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
            Kiến tạo thế giới không khoảng cách với công nghệ dịch thuật AI tiên tiến nhất.
          </p>
        </div>
      </div>

      {/* RIGHT Form Section */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 relative z-10 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 bg-white/5 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">

          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-black text-white tracking-tight">
              Tạo tài khoản
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Đăng ký thành viên để truy cập hệ thống
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 text-sm text-red-400 bg-red-500/10 rounded-2xl border border-red-500/20 animate-shake">
                {error}
              </div>
            )}

            {/* FULL NAME */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
                Họ và tên
              </label>
              <Input
                name="full_name"
                className="h-12 bg-white/5 text-white border-white/10 focus:border-blue-500 rounded-xl px-4 transition-all"
                placeholder="Họ và tên của bạn"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* EMAIL */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
                Địa chỉ Email
              </label>
              <Input
                name="email"
                type="email"
                className="h-12 bg-white/5 text-white border-white/10 focus:border-blue-500 rounded-xl px-4 transition-all"
                placeholder="abc@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PASSWORD */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="h-12 pr-12 bg-white/5 text-white border-white/10 focus:border-blue-500 rounded-xl px-4 transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* CONFIRM */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
                  Xác nhận
                </label>
                <div className="relative">
                  <Input
                    name="confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    className="h-12 pr-12 bg-white/5 text-white border-white/10 focus:border-blue-500 rounded-xl px-4 transition-all"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* BUTTON */}
            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Đăng ký tài khoản"
              )}
            </Button>

          </form>

          <div className="text-center text-sm text-slate-500">
            Đã có tài khoản?{" "}
            <Link
              href="/login"
              className="font-black text-blue-400 hover:text-blue-300 transition-colors"
            >
              Đăng nhập
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}