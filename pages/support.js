import Navbar from "../components/Navbar";
import { MessageSquare, Mail, Phone, FileText, Send, HelpCircle, Headphones, Settings as SettingsIcon, ToggleRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { me, createSupportTicket, getUserTickets, getFAQs, getFAQCategories, getWalletBalance, sendAIChatMessage } from "../services/api";
import { showAlert, showToast } from "../utils/alerts";

export default function SupportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [credits, setCredits] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "technical",
  });

  // AI Chat states
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, faqsRes, catsRes, ticketsRes, walletRes] = await Promise.all([
          me(),
          getFAQs(),
          getFAQCategories(),
          getUserTickets(),
          getWalletBalance(),
        ]);
        setUser(userRes.data);
        setFaqs(faqsRes.data);
        setCategories(catsRes.data);
        setTickets(ticketsRes.data);
        setCredits(walletRes.data.credits_balance || 0);
      } catch (err) {
        showAlert("Lỗi", "Không thể tải dữ liệu hỗ trợ", "error");
        if (err.response?.status === 401) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const loadFAQs = async () => {
    try {
      const response = await getFAQs();
      setFaqs(response.data);
    } catch (error) {
      console.error("Failed to load FAQs:", error);
      // Fallback to default FAQs - thêm nhiều câu hỏi mẫu
      setFaqs([
        { question: "Làm thế nào để nạp thêm Credits?", answer: "Bạn có thể vào mục Billing, chọn gói Credits phù hợp và thanh toán qua MoMo hoặc chuyển khoản ngân hàng." },
        { question: "Cabin dịch có chính xác không?", answer: "Cabin sử dụng mô hình AI tiên tiến nhất hiện nay, đảm bảo độ chính xác lên đến 95% cho các văn bản kỹ thuật." },
        { question: "Tôi gặp lỗi khi dịch giọng nói?", answer: "Vui lòng kiểm tra quyền truy cập Microphone trên trình duyệt của bạn và đảm bảo kết nối internet ổn định." },
        { question: "Credits có hạn sử dụng không?", answer: "Không, Credits của bạn không có hạn sử dụng. Credits sẽ tồn tại trong tài khoản của bạn cho đến khi được sử dụng." },
        { question: "Tôi có thể hoàn lại Credits không?", answer: "Có, bạn có thể yêu cầu hoàn lại Credits trong vòng 30 ngày kể từ ngày mua. Vui lòng liên hệ với bộ phận hỗ trợ." },
        { question: "Cabin hỗ trợ dịch những ngôn ngữ nào?", answer: "Cabin hỗ trợ dịch từ hơn 100 ngôn ngữ trên thế giới, bao gồm các ngôn ngữ châu Á, châu Âu, châu Mỹ, v.v." },
        { question: "Làm sao để cải thiện chất lượng dịch?", answer: "Hãy cung cấp ngữ cảnh đầy đủ, tránh sử dụng từ viết tắt, và kiểm tra lại kết quả dịch. Bạn cũng có thể sử dụng tính năng 'Dịch lại'." },
        { question: "Tôi có thể dùng Cabin trên điện thoại không?", answer: "Có, Cabin hoạt động trên tất cả các thiết bị có trình duyệt web, bao gồm điện thoại, máy tính bảng và máy tính để bàn." },
        { question: "Dữ liệu của tôi có an toàn không?", answer: "Cabin sử dụng mã hóa SSL và lưu trữ dữ liệu trên máy chủ bảo mật. Chúng tôi không chia sẻ dữ liệu của bạn với bên thứ ba." },
        { question: "Làm sao để xóa lịch sử dịch của tôi?", answer: "Bạn có thể xóa lịch sử dịch trong mục Profile > Cài đặt > Xóa lịch sử. Hoặc liên hệ với bộ phận hỗ trợ để xóa toàn bộ dữ liệu." }
      ]);
    }
  };

  const loadUserData = async () => {
    try {
      // Lấy từ localStorage trước
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        setUser(userObj);
      } else if (token) {
        // Fetch từ /me nếu không có trong localStorage
        const res = await me();
        setUser(res.data);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
    }
  };

  const loadCredits = async () => {
    try {
      const response = await getWalletBalance();
      setCredits(response.data.credits_balance || 0);
    } catch (error) {
      console.error("Failed to load credits:", error);
      setCredits(0);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSupportTicket({
        title: formData.title,
        description: formData.description,
        category: "technical"
      });
      showToast("Gửi yêu cầu thành công!");
      setFormData({ title: "", description: "" });
    } catch (error) {
      console.error("Failed to submit ticket:", error);
      showAlert("Lỗi", "Gửi yêu cầu thất bại. Vui lòng thử lại.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAIChatSend = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages([...chatMessages, { role: "user", content: userMessage }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await sendAIChatMessage(userMessage);
      setChatMessages((prev) => [...prev, { role: "ai", content: response.data.reply }]);
    } catch (error) {
      console.error("AI Chat error:", error);
      const errorMsg = "Xin lỗi, hệ thống đang bận. Vui lòng thử lại.";
      setChatMessages((prev) => [...prev, { role: "ai", content: errorMsg }]);
      showToast(errorMsg, "error");
    } finally {
      setChatLoading(false);
    }
  };

  const defaultUser = {
    email: "user@example.com",
    full_name: "User",
    balance: "0",
    token_balance: 0
  };

  const displayUser = user || defaultUser;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <h1 className="text-4xl font-black tracking-tight mb-4 text-white">Hỗ trợ khách hàng</h1>
            <p className="text-slate-400 mb-12 max-w-lg leading-relaxed">
              Chúng tôi luôn sẵn sàng lắng nghe và giải đáp mọi thắc mắc của bạn về dịch vụ Cabin.
            </p>

            {/* Quick Contact Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
              {/* Card AI Chat */}
              <div
                onClick={() => setShowAIChat(true)}
                className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl text-center hover:border-blue-500/50 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquare className="text-blue-500" size="24" />
                </div>
                <h3 className="font-bold mb-2 text-lg text-white">Chat với AI</h3>
                <p className="text-sm text-slate-400 mb-4">Hỗ trợ trả lời tự động 24/7</p>
                <p className="text-blue-500 font-bold text-sm">Bắt đầu ngay →</p>
              </div>

              {/* Card Email */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl text-center hover:border-purple-500/50 transition-all group">
                <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Mail className="text-purple-400" size="24" />
                </div>
                <h3 className="font-bold mb-2 text-lg text-white">Email</h3>
                <p className="text-sm text-slate-400 mb-4">Gửi yêu cầu qua hòm thư hỗ trợ</p>
                <p className="text-purple-400 font-bold text-sm">support@cabin.vn</p>
              </div>

              {/* Card Hotline */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl text-center hover:border-green-500/50 transition-all group">
                <div className="w-12 h-12 bg-green-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Phone className="text-green-400" size="24" />
                </div>
                <h3 className="font-bold mb-2 text-lg text-white">Hotline</h3>
                <p className="text-sm text-slate-400 mb-4">Gọi trực tiếp để được xử lý nhanh</p>
                <p className="text-green-400 font-bold text-sm">0987.654.321</p>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
                <FileText className="text-blue-500" size="24" /> Câu hỏi thường gặp
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div key={index} className="bg-white/5 border border-white/10 p-5 rounded-xl hover:border-white/20 transition-all">
                    <h4 className="font-bold text-blue-400 mb-2 text-sm">{faq.question || faq.q}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{faq.answer || faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Form - Moved to left side */}
            <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-white">Gửi yêu cầu hỗ trợ</h3>
              {successMessage && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                  {successMessage}
                </div>
              )}
              <form onSubmit={handleSubmitTicket} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-wide">Tiêu đề</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                    placeholder="Vấn đề bạn gặp..."
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block tracking-wide">Nội dung</label>
                  <textarea
                    rows="3"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-all text-foreground"
                    placeholder="Mô tả chi tiết..."
                    required
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-muted text-white font-bold py-2 rounded-lg text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Send size={16} /> {loading ? "Đang gửi..." : "Gửi"}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar - User Profile */}
          <div className="lg:col-span-1">
            {/* User Info Card */}
            <div className="bg-card border border-border rounded-2xl p-6 mb-6 sticky top-20">
              {/* Premium Status */}
              <div className="mb-6 pb-6 border-b border-border">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Thành viên Premium</p>
                <p className="text-sm font-bold text-foreground truncate">{displayUser.email}</p>
              </div>

              {/* Credits Balance */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Số dư Credits</p>
                  <p className="text-base font-black text-foreground mt-1">{credits.toLocaleString()} <span className="text-xs text-muted-foreground">Credits</span></p>
                </div>
                <div
                  onClick={() => router.push("/billing")}
                  className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center hover:bg-blue-600/40 transition-colors cursor-pointer"
                >
                  <span className="text-blue-400 font-bold text-lg">+</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6"></div>

              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-all cursor-pointer">
                  <div className="w-8 h-8 bg-muted border border-border rounded-lg flex items-center justify-center">
                    <HelpCircle size={16} className="text-muted-foreground" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Hỗ trợ kỹ thuật</span>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-all cursor-pointer">
                  <div className="w-8 h-8 bg-muted border border-border rounded-lg flex items-center justify-center">
                    <Headphones size={16} className="text-muted-foreground" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Giao diện: Tự động</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Modal */}
      {showAIChat && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-3xl w-full md:w-96 max-h-[80vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">Trợ lý AI Cabin</h3>
                <p className="text-xs text-muted-foreground mt-1">Hỗ trợ 24/7 với AI tự động</p>
              </div>
              <button
                onClick={() => setShowAIChat(false)}
                className="p-2 hover:bg-muted rounded-lg transition-all"
              >
                <X size={20} className="text-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-center">
                  <p className="text-muted-foreground text-sm">Xin chào! Tôi là trợ lý AI của Cabin. Hãy hỏi tôi bất cứ điều gì! 👋</p>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-xl ${msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none"
                        }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-3 rounded-xl rounded-bl-none">
                    <p className="text-sm text-muted-foreground">Đang suy nghĩ...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-border flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !chatLoading && handleAIChatSend()}
                placeholder="Nhập tin nhắn..."
                disabled={chatLoading}
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-all text-foreground disabled:opacity-50"
              />
              <button
                onClick={handleAIChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-muted text-white p-2 rounded-lg transition-all"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
