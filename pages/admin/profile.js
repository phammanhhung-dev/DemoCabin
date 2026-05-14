import AdminLayout from "../../components/admin/AdminLayout";
import { User, Mail, Database, Lock, Trash2, ShieldCheck, ChevronRight, Edit2, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import API from "../../services/api";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const res = await API.get("/me");
        setUser(res.data);
        setFullName(res.data.full_name || "");
        setEmail(res.data.email || "");
      } catch (err) {
        console.error("Lỗi fetch user:", err);
        setError(err.response?.data?.detail || "Không thể tải thông tin người dùng");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Vui lòng nhập họ tên");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await API.put("/admin/users/" + user.id, {
        full_name: fullName,
        email: email
      });
      setUser(res.data);
      setSuccessMsg("✅ Cập nhật thông tin thành công!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Lỗi cập nhật thông tin");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Vui lòng điền đầy đủ các trường");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới không trùng khớp");
      return;
    }
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    try {
      setPasswordLoading(true);
      setError(null);
      await API.put("/admin/users/" + user.id, {
        password: newPassword
      });
      setSuccessMsg("✅ Đổi mật khẩu thành công!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Lỗi đổi mật khẩu");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    try {
      setDeleteLoading(true);
      setError(null);
      await API.delete("/admin/users/" + user.id + "?force=1");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = "/login";
    } catch (err) {
      setError(err.response?.data?.detail || "Lỗi xóa tài khoản");
      setDeleteLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500">Đang tải thông tin...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-black text-black tracking-tighter">Hồ sơ cá nhân</h2>
                <p className="text-[#94a3b8] text-sm mt-1">Quản lý thông tin và bảo mật tài khoản Cabin của bạn</p>
              </div>
              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white text-sm hover:bg-blue-700 disabled:bg-blue-400 transition-all shadow-md active:scale-95"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>

            {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">❌ {error}</div>}
            {successMsg && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded text-green-700">{successMsg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column: Overview */}
              <div className="md:col-span-4 space-y-8">
                <div className="bg-[#1C2434] p-8 rounded-2xl border border-[#2B3544] text-center shadow-lg relative overflow-hidden group">
                  <div className="absolute inset-0 bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="w-28 h-28 bg-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl font-black text-white shadow-xl">
                      {user?.full_name?.charAt(0).toUpperCase() || "A"}
                    </div>
                    <h3 className="text-xl font-bold text-white">{user?.full_name || "Admin"}</h3>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Zap size={14} className="text-blue-400" />
                      <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{user?.role || "Admin"}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1C2434] p-8 rounded-2xl border border-[#2B3544] shadow-lg relative overflow-hidden group">
                  <div className="absolute inset-0 bg-amber-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[#94a3b8] text-sm font-medium">Thông tin tài khoản</span>
                      <User size={20} className="text-amber-500" />
                    </div>
                    <p className="text-white font-semibold mb-2">ID: #{user?.id || "-"}</p>
                    <p className="text-[#94a3b8] text-sm">Email: {user?.email || "-"}</p>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-[11px] text-[#64748b] mt-3 italic">* Tài khoản Admin có quyền truy cập toàn bộ hệ thống.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Settings */}
              <div className="md:col-span-8 space-y-8">
                {/* Edit Profile */}
                <form onSubmit={handleSaveProfile} className="bg-[#1C2434] rounded-2xl border border-[#2B3544] overflow-hidden shadow-lg">
                  <div className="px-6 py-5 border-b border-[#2B3544] bg-[#242D3D] flex items-center gap-3">
                    <User size={20} className="text-blue-500" />
                    <h4 className="font-bold text-white">Thông tin cơ bản</h4>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-[#94a3b8] mb-2 uppercase tracking-wide">Họ và tên</label>
                        <input 
                          type="text" 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-[#0F172A] border border-[#2B3544] rounded-lg px-4 py-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" 
                          placeholder="👤 Nhập họ tên..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#94a3b8] mb-2 uppercase tracking-wide">Email</label>
                        <input 
                          type="email" 
                          value={email}
                          disabled 
                          className="w-full bg-[#161D2D] border border-[#2B3544] rounded-lg px-4 py-3 text-[#64748b] text-sm cursor-not-allowed" 
                        />
                      </div>
                    </div>
                  </div>
                </form>

                {/* Security */}
                <div className="bg-[#1C2434] rounded-2xl border border-[#2B3544] overflow-hidden shadow-lg">
                  <div className="px-6 py-5 border-b border-[#2B3544] bg-[#242D3D] flex items-center gap-3">
                    <Lock size={20} className="text-amber-500" />
                    <h4 className="font-bold text-white">Bảo mật & Tài khoản</h4>
                  </div>
                  <div className="p-8 divide-y divide-[#2B3544]">
                    {/* Change Password */}
                    <button 
                      type="button"
                      onClick={() => setChangePasswordOpen(!changePasswordOpen)}
                      className="w-full flex items-center justify-between py-4 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={18} className="text-blue-500" />
                        <span className="text-sm text-white font-medium group-hover:text-blue-500">Đổi mật khẩu đăng nhập</span>
                      </div>
                      <ChevronRight size={18} className={`text-[#64748b] group-hover:text-blue-500 transition-transform ${changePasswordOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {changePasswordOpen && (
                      <form onSubmit={handleChangePassword} className="py-4 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-[#94a3b8] mb-2 uppercase">Mật khẩu hiện tại</label>
                          <input 
                            type="password" 
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full bg-[#0F172A] border border-[#2B3544] rounded-lg px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
                            placeholder="🔑 Nhập mật khẩu hiện tại..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#94a3b8] mb-2 uppercase">Mật khẩu mới</label>
                          <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-[#0F172A] border border-[#2B3544] rounded-lg px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
                            placeholder="🔒 Nhập mật khẩu mới..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#94a3b8] mb-2 uppercase">Xác nhận mật khẩu</label>
                          <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-[#0F172A] border border-[#2B3544] rounded-lg px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
                            placeholder="🔒 Xác nhận mật khẩu mới..."
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={passwordLoading}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded-lg transition"
                        >
                          {passwordLoading ? "Đang đổi..." : "Đổi mật khẩu"}
                        </button>
                      </form>
                    )}

                    {/* Delete Account */}
                    <button 
                      type="button"
                      onClick={() => handleDeleteAccount()}
                      className="w-full flex items-center justify-between py-4 transition-colors group pt-4"
                    >
                      <div className="flex items-center gap-3">
                        <Trash2 size={18} className="text-red-900/60" />
                        <span className="text-sm text-red-500 font-medium group-hover:text-red-400">
                          {deleteConfirm ? "Xác nhận xóa?" : "Xóa tài khoản vĩnh viễn"}
                        </span>
                      </div>
                      <ChevronRight size={18} className="text-[#64748b] group-hover:text-red-400" />
                    </button>

                    {deleteConfirm && (
                      <div className="py-4 bg-red-900/10 border border-red-500/20 rounded-lg p-4">
                        <p className="text-red-400 text-sm mb-4">⚠️ Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xóa vĩnh viễn.</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setDeleteConfirm(false)}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded font-semibold"
                          >
                            Hủy
                          </button>
                          <button 
                            onClick={handleDeleteAccount}
                            disabled={deleteLoading}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 rounded font-semibold"
                          >
                            {deleteLoading ? "Đang xóa..." : "Xóa ngay"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}