import AdminLayout from "../../components/admin/AdminLayout";
import { Zap, ShieldCheck, CreditCard, AlertCircle, Zap as GiftIcon } from "lucide-react";
import { useState, useEffect } from "react";
import API from "../../services/api";
import { showAlert, showToast } from "../../utils/alerts";

export default function AdminBillingPage() {
  const [loading, setLoading] = useState(null);
  const [plans, setPlans] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);

  // Admin Section
  const [wallets, setWallets] = useState([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [creditingUserId, setCreditingUserId] = useState(null);
  const [adminError, setAdminError] = useState(null);

  // Fetch plans & user wallet on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [plansRes, walletRes] = await Promise.all([
          API.get("/billing/plans"),
          API.get("/billing/wallet")
        ]);
        setPlans(plansRes.data);
        setWallet(walletRes.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Không thể tải dữ liệu");
      } finally {
        setPlansLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch all wallets for admin
  useEffect(() => {
    const fetchWallets = async () => {
      try {
        setAdminError(null);
        const res = await API.get("/admin/billing/wallets");
        setWallets(res.data.items);
      } catch (err) {
        setAdminError(err.response?.data?.detail || "Không thể tải ví");
      } finally {
        setWalletsLoading(false);
      }
    };
    fetchWallets();
  }, []);

  const handleBuy = async (planId) => {
    setLoading(planId);
    setError(null);
    try {
      const res = await API.post("/billing/purchase", { plan_id: planId });
      setWallet(res.data);
      showAlert("Thành công", `${res.data.message}\n\nSố dư: ${res.data.credits_balance.toLocaleString()} credits`, "success");
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Thanh toán thất bại";
      setError(errMsg);
      showAlert("Lỗi", errMsg, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleCreditUser = async (e) => {
    e.preventDefault();
    if (!creditUserId || !creditAmount) {
      setAdminError("Vui lòng nhập User ID và số credits");
      return;
    }

    setCreditingUserId(creditUserId);
    setAdminError(null);
    try {
      const res = await API.post("/admin/billing/credit", {
        user_id: parseInt(creditUserId),
        credits: parseInt(creditAmount),
        note: creditNote || undefined
      });
      showToast("Cập nhật Credits thành công");
      // Refresh wallets
      const walletsRes = await API.get("/admin/billing/wallets");
      setWallets(walletsRes.data.items);
      // Reset form
      setCreditUserId("");
      setCreditAmount("");
      setCreditNote("");
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Cộng credits thất bại";
      setAdminError(errMsg);
      showAlert("Lỗi", errMsg, "error");
    } finally {
      setCreditingUserId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* User Billing Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-black mb-3">Nạp thêm Token</h1>
            <p className="text-slate-400">Chọn gói phù hợp để tiếp tục sử dụng dịch vụ dịch Cabin AI chuyên nghiệp.</p>
          </div>

          {/* Wallet Balance */}
          {wallet && (
            <div className="max-w-4xl mx-auto mb-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-8">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Số dư hiện tại:</span>
                <span className="text-2xl font-bold text-blue-600">{wallet.credits_balance.toLocaleString()} credits</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="max-w-4xl mx-auto mb-8 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {plansLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 mt-4">Đang tải gói giá...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-[#1C2434] rounded-3xl border-2 p-8 transition-all hover:scale-[1.02] shadow-2xl ${plan.recommended ? "border-amber-500 ring-4 ring-amber-500/10" : "border-[#2B3544]"
                    }`}
                >
                  {plan.recommended && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                      Khuyên dùng
                    </span>
                  )}

                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 my-4">
                      <span className="text-4xl font-black text-white">{plan.credits.toLocaleString()}</span>
                      <span className="text-slate-400">credits</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-500">{plan.price_vnd.toLocaleString()}đ</p>
                    <p className="text-sm text-slate-500 mt-4 leading-relaxed">{plan.desc}</p>
                  </div>

                  <button
                    onClick={() => handleBuy(plan.id)}
                    disabled={loading !== null}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${plan.recommended
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "bg-slate-700 text-white hover:bg-slate-600"
                      } ${loading === plan.id ? "opacity-75" : ""}`}
                  >
                    {loading === plan.id ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <CreditCard size={18} /> Mua ngay
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security badges */}
          <div className="mt-16 flex flex-wrap justify-center gap-8 opacity-50">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <ShieldCheck size={16} /> Thanh toán bảo mật SSL
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Zap size={16} /> Nhận Token tức thì
            </div>
          </div>
        </div>

        <hr className="my-16 border-slate-300" />

        {/* Admin Section */}
        <div>
          <h2 className="text-2xl font-bold text-black mb-8 flex items-center gap-3">
            <GiftIcon size={28} className="text-blue-600" />
            Quản lý Ví Credits
          </h2>

          {adminError && (
            <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-red-700">{adminError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Credit User Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow">
              <h3 className="text-lg font-bold text-black mb-6">Cộng Credits cho User</h3>
              <form onSubmit={handleCreditUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
                  <input
                    type="number"
                    value={creditUserId}
                    onChange={(e) => setCreditUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="💯 VD: 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Số Credits</label>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="💰 VD: 10000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ghi chú (tùy chọn)</label>
                  <input
                    type="text"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="📝 VD: Hỗ trợ khách hàng"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creditingUserId !== null}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creditingUserId !== null ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <GiftIcon size={18} /> Cộng Credits
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Wallets List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow">
              <h3 className="text-lg font-bold text-black mb-6">Danh sách Ví ({wallets.length})</h3>
              {walletsLoading ? (
                <div className="text-center py-6">
                  <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : wallets.length === 0 ? (
                <p className="text-slate-500 text-center py-6">Chưa có ví</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {wallets.map((w) => (
                    <div key={w.user_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-gray-700 font-medium">User #{w.user_id}</span>
                      <span className="text-sm font-bold text-blue-600">{w.credits_balance.toLocaleString()} 💳</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}