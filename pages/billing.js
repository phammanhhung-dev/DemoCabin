import Navbar from "../components/Navbar";
import { Zap, ShieldCheck, CreditCard, AlertCircle, Star, Crown, Rocket, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import API from "../services/api";
import { showAlert } from "../utils/alerts";

export default function Billing() {
  const router = useRouter();
  const [loading, setLoading] = useState(null);
  const [plans, setPlans] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState("momo");

  const paymentMethods = [
    { id: "momo", name: "MoMo", icon: "https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png" },
    { id: "zalopay", name: "ZaloPay", icon: "https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png" },
    { id: "mock", name: "Demo (Free)", icon: null },
  ];

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'basic': return <Zap className="text-blue-400" size={28} />;
      case 'pro': return <Star className="text-indigo-400" size={28} />;
      case 'vip': return <Crown className="text-purple-400" size={28} />;
      case 'premium': return <Rocket className="text-amber-400" size={28} />;
      default: return <Gift className="text-slate-400" size={28} />;
    }
  };

  // Require login
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login?next=/billing");
    }
  }, [router]);

  // Fetch plans & wallet on mount
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

  const handleBuy = async (planId) => {
    setLoading(planId);
    setError(null);
    try {
      const res = await API.post("/billing/purchase", {
        plan_id: planId,
        method: selectedMethod
      });

      if (res.data.payment_url) {
        window.location.href = res.data.payment_url;
        return;
      }

      // Update wallet balance (for mock/free)
      setWallet(prev => ({
        ...prev,
        credits_balance: res.data.credits_balance
      }));

      // Cập nhật localStorage để đồng bộ dữ liệu người dùng
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        user.token_balance = res.data.credits_balance;
        localStorage.setItem("user", JSON.stringify(user));
      }

      // Phát sự kiện để Navbar và các thành phần khác cập nhật số dư ngay lập tức
      window.dispatchEvent(new Event("userUpdate"));
      window.dispatchEvent(new Event("notificationUpdate"));

      showAlert(
        "Thanh toán thành công",
        `${res.data.message}\n\nSố dư mới: ${(res.data.credits_balance || 0).toLocaleString()} Credits`,
        "success"
      );
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Thanh toán thất bại";
      setError(errMsg);
      showAlert("Lỗi thanh toán", errMsg, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-3">
            Nạp thêm Credits
          </h1>
          <p className="text-slate-400">Chọn gói phù hợp để tiếp tục trải nghiệm dịch Cabin AI với tỷ giá ưu đãi.</p>
        </div>

        {/* Wallet Balance */}
        {wallet && typeof wallet.credits_balance === 'number' && (
          <div className={`max-w-2xl mx-auto mb-12 border rounded-2xl p-6 shadow-lg ${wallet.credits_balance < 10000
            ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/5'
            : 'bg-blue-500/10 border-blue-500/30 shadow-blue-500/5'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-slate-300 font-medium">Số dư hiện tại:</span>
                {wallet.credits_balance < 10000 && (
                  <span className="text-amber-400 text-xs font-bold mt-1 flex items-center gap-1">
                    <AlertCircle size={14} /> Cảnh báo: Sắp hết Credits!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Zap size={20} className={wallet.credits_balance < 10000 ? "text-amber-400" : "text-blue-400"} />
                <span className="text-3xl font-black text-white">{(wallet.credits_balance || 0).toLocaleString()}</span>
                <span className={`${wallet.credits_balance < 10000 ? "text-amber-400" : "text-blue-400"} font-bold`}>Credits</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8 bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-destructive flex-shrink-0 mt-0.5" />
            <span className="text-destructive">{error}</span>
          </div>
        )}

        {plansLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground mt-4">Đang tải gói giá...</p>
          </div>
        ) : (
          <>
            {/* Payment Method Selection */}
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 text-center">Chọn phương thức thanh toán</h2>
              <div className="flex flex-wrap justify-center gap-4">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 transition-all ${selectedMethod === m.id
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                      : "border-white/5 bg-white/5 hover:border-white/10"
                      }`}
                  >
                    {m.icon ? (
                      <img
                        src={m.icon}
                        alt={m.name}
                        className="w-6 h-6 object-contain rounded-sm"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://cdn-icons-png.flaticon.com/512/10434/10434079.png"; // Fallback wallet icon
                        }}
                      />
                    ) : (
                      <Gift size={20} className="text-amber-400" />
                    )}
                    <span className={`font-bold ${selectedMethod === m.id ? "text-white" : "text-slate-400"}`}>{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-[#1E293B]/50 backdrop-blur-xl rounded-3xl border-2 p-6 transition-all hover:scale-[1.02] shadow-2xl flex flex-col ${plan.recommended ? "border-blue-500 ring-4 ring-blue-500/10" : "border-white/5"
                    }`}
                >
                  {plan.recommended && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                      Khuyên dùng
                    </span>
                  )}

                  <div className="mb-6 flex-grow">
                    <div className="flex items-center justify-between mb-4">
                      {getPlanIcon(plan.id)}
                      {plan.recommended && <Star size={16} className="text-blue-400 fill-blue-400" />}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 my-4">
                      <span className="text-3xl font-black text-white">{plan.credits.toLocaleString()}</span>
                      <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Credits</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{plan.price_vnd.toLocaleString()}đ</p>
                    <p className="text-xs text-slate-400 mt-4 leading-relaxed">{plan.desc}</p>
                  </div>

                  <button
                    onClick={() => handleBuy(plan.id)}
                    disabled={loading !== null}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${plan.recommended
                      ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                      : "bg-white/10 text-white hover:bg-white/20"
                      } ${loading === plan.id ? "opacity-75" : ""}`}
                  >
                    {loading === plan.id ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <><CreditCard size={18} /> Mua ngay</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Security badges */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 opacity-50">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <ShieldCheck size={16} /> Thanh toán bảo mật SSL
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Zap size={16} /> Nhận Credits tức thì
          </div>
        </div>
      </main>
    </div>
  );
}