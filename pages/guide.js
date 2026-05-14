import Navbar from "../components/Navbar";
import { BookOpen, Info, Zap, Mic, Languages, DollarSign, HelpCircle, CheckCircle2 } from "lucide-react";
import Head from "next/head";

export default function GuidePage() {
  const pricingData = [
    {
      category: "Dịch không voice (Cabin Mode)",
      items: [
        { label: "Đơn vị tính", value: "1.000 từ" },
        { label: "Giá dịch vụ", value: "100 credits", highlighted: true },
      ],
      icon: <Languages className="text-blue-400" size={24} />,
      link: "/translate"
    },
    {
      category: "Dịch có voice (Voice Mode)",
      items: [
        { label: "Đơn vị tính", value: "1 phút" },
        { label: "Giá dịch vụ", value: "40 credits", highlighted: true },
      ],
      icon: <Mic className="text-emerald-400" size={24} />,
      link: "/voice"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30">
      <Head>
        <title>Hướng dẫn sử dụng & Bảng giá | CABIN AI</title>
      </Head>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-black uppercase tracking-widest mb-6">
            <BookOpen size={14} /> Trung tâm trợ giúp
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">
            Hướng dẫn & <span className="text-blue-500">Bảng giá</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Khám phá cách sử dụng hệ thống dịch Cabin AI và hiểu rõ cách tính phí minh bạch của chúng tôi.
          </p>
        </div>

        {/* Bảng giá Section */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-10 justify-center md:justify-start">
            <div className="p-2.5 bg-blue-600/10 rounded-xl text-blue-500">
              <DollarSign size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Bảng giá Credit chi tiết</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {pricingData.map((group, idx) => (
              <div key={idx} className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all hover:border-blue-500/20 group">
                <div className="mb-8 p-4 bg-white/5 w-fit rounded-2xl group-hover:scale-110 transition-transform">
                  {group.icon}
                </div>
                <h3 className="text-xl font-black mb-8">{group.category}</h3>
                <div className="space-y-6">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center pb-4 border-b border-white/5 last:border-0">
                      <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">{item.label}</span>
                      <span className={`font-black ${item.highlighted ? "text-blue-400 text-xl" : "text-white text-sm"}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Neural TTS Note */}
          <div className="mt-8 bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="p-6 bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-600/30 flex-shrink-0">
                <Mic size={40} className="text-white" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-black mb-3">Phát âm thanh (Edge TTS)</h3>
                <p className="text-slate-400 leading-relaxed mb-6 max-w-3xl">
                  Khi sử dụng tính năng Voice, hệ thống sử dụng công nghệ Edge TTS tiên tiến để phát lại bản dịch với giọng nói tự nhiên. Chi phí này được tính bổ sung dựa trên số lượng ký tự được phát ra.
                </p>
                <div className="inline-flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Mức phí:</span>
                  <span className="text-blue-400 font-black text-lg">~1.500.000 Credits / 1.000.000 ký tự</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hướng dẫn sử dụng */}
        <section>
          <div className="flex items-center gap-3 mb-10 justify-center md:justify-start">
            <div className="p-2.5 bg-emerald-600/10 rounded-xl text-emerald-500">
              <HelpCircle size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Hướng dẫn sử dụng</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-10">
              {[
                { step: 1, title: "Nạp Credits", desc: <>Truy cập trang <a href="/billing" className="text-blue-400 hover:underline font-bold">Nạp Credits</a> để mua các gói credits phù hợp với nhu cầu của bạn.</> },
                { step: 2, title: "Chọn chế độ dịch", desc: <>Sử dụng <strong>Cabin</strong> để dịch văn bản từ micro hoặc <strong>Voice</strong> để vừa dịch vừa phát âm thanh (Voice Mode).</> },
                { step: 3, title: "Cấu hình ngôn ngữ", desc: "Chọn ngôn ngữ nguồn và ngôn ngữ đích. Hệ thống hỗ trợ dịch song phương thông minh." }
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start group">
                  <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-sm font-black text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-black text-lg mb-2 text-white">{item.title}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
              <h4 className="font-black text-lg mb-8 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-500" /> Lưu ý quan trọng
              </h4>
              <ul className="space-y-6">
                {[
                  "Hệ thống tính phí dựa trên thời lượng thực tế sử dụng micro.",
                  "Bản dịch interim (đang nhảy) không bị tính phí, chỉ tính phí trên kết quả cuối cùng.",
                  "Lịch sử hội thoại được lưu trữ để bạn có thể xem lại bất cứ lúc nào."
                ].map((note, i) => (
                  <li key={i} className="flex gap-4 items-start">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-slate-400 text-sm leading-relaxed">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Footer info */}
        <div className="mt-32 text-center border-t border-white/5 pt-16">
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.5em] mb-4">Hệ thống dịch thuật chuyên nghiệp</p>
        </div>
      </main>
    </div>
  );
}
