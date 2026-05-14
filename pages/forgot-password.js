import { useState } from "react";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { forgotPassword } from "../services/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await forgotPassword(email);
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300 items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md space-y-8 bg-white/5 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Quên mật khẩu
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Nhập email của bạn. Chúng tôi sẽ gửi một mật khẩu mới ngẫu nhiên để bạn có thể truy cập lại tài khoản.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div className="p-4 text-sm text-emerald-400 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              {message}
            </div>
          )}
          {error && (
            <div className="p-4 text-sm text-red-400 bg-red-500/10 rounded-2xl border border-red-500/20 animate-shake">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500 tracking-widest ml-1">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="name@gmail.com"
              className="h-12 bg-white/5 text-white border-white/10 focus:border-blue-500 rounded-xl px-4 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Gửi mật khẩu mới"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Đã nhớ mật khẩu?{" "}
          <a href="/login" className="font-black text-blue-400 hover:text-blue-300 transition-colors">
            Quay lại đăng nhập
          </a>
        </p>
      </div>
    </div>
  );
}

