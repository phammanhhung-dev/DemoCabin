import Navbar from "../components/Navbar";
import { User, Lock, Mail, FileText, Upload, Save, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { me, updateProfile, uploadAvatarFile } from "../services/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await me();
        const data = res.data;
        setUser(data);
        setFormData((prev) => ({
          ...prev,
          full_name: data.full_name || "",
          email: data.email || "",
        }));
      } catch (err) {
        setError("Không thể tải thông tin cá nhân");
        if (err.response?.status === 401) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setSuccess("");
    setError("");

    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setError("Mật khẩu mới không khớp");
      setUpdating(false);
      return;
    }

    try {
      const updateData = {
        full_name: formData.full_name,
      };

      if (formData.new_password) {
        if (!formData.old_password) {
          setError("Vui lòng nhập mật khẩu cũ để đổi mật khẩu mới");
          setUpdating(false);
          return;
        }
        updateData.old_password = formData.old_password;
        updateData.password = formData.new_password;
      }

      await updateProfile(updateData);
      setSuccess("Cập nhật thông tin thành công");
      const res = await me();
      setUser(res.data);
      setFormData((prev) => ({
        ...prev,
        old_password: "",
        new_password: "",
        confirm_password: "",
      }));
    } catch (err) {
      setError(err.response?.data?.detail || "Cập nhật thất bại");
    } finally {
      setUpdating(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      await uploadAvatarFile(file);
      setSuccess("Cập nhật ảnh đại diện thành công");
      const res = await me();
      setUser(res.data);
    } catch (err) {
      setError("Không thể upload ảnh");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white transition-colors duration-300">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white transition-colors duration-300">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-white mb-3">
            Hồ sơ cá nhân
          </h1>
          <p className="text-slate-400">Quản lý thông tin tài khoản của bạn</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Avatar Section */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm">
              <div className="mb-6">
                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-4xl border-4 border-white/20 overflow-hidden shadow-lg">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.email?.[0]?.toUpperCase() || user?.full_name?.[0]?.toUpperCase() || "U"
                  )}
                </div>
              </div>

              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={updating}
                />
                <div className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-600/20 ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Upload size={16} /> {updating ? "Đang xử lý..." : "Cập nhật ảnh"}
                </div>
              </label>
            </div>
          </div>

          {/* Profile Form */}
          <div className="lg:col-span-3">
            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-2">
                <span>✓</span>
                {success}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                <span>✕</span>
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Personal Info Section */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                  <User size={24} className="text-blue-500" />
                  Thông tin cá nhân
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Họ và tên</label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                      placeholder="Nhập tên đầy đủ"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-slate-500 focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                  <Lock size={24} className="text-purple-500" />
                  Đổi mật khẩu
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Mật khẩu cũ (để cập nhật)</label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? "text" : "password"}
                        name="old_password"
                        value={formData.old_password}
                        onChange={handleInputChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-10 text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Nhập mật khẩu cũ nếu muốn đổi mật khẩu mới"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white focus:outline-none"
                      >
                        {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          name="new_password"
                          value={formData.new_password}
                          onChange={handleInputChange}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-10 text-white focus:outline-none focus:border-blue-500 transition-all"
                          placeholder="Mật khẩu mới"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white focus:outline-none"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Xác nhận mật khẩu</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirm_password"
                          value={formData.confirm_password}
                          onChange={handleInputChange}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-10 text-white focus:outline-none focus:border-blue-500 transition-all"
                          placeholder="Nhập lại mật khẩu"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white focus:outline-none"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={updating}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Save size={20} />
                  {updating ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
