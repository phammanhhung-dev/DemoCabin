import { Sparkles, Trash2, Copy } from "lucide-react";
import { useState } from "react";

export default function ConversationSummary({ summary, onClear }) {
  const [copied, setCopied] = useState(false);

  const handleClear = () => {
    if (onClear) onClear();
  };

  const handleCopy = () => {
    const text = `GỐC:\n${summary?.original || "Chưa có tóm tắt."}\n\nDỊCH:\n${summary?.translated || "Chưa có tóm tắt."}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <h3 className="text-xl font-black flex items-center gap-3 text-white">
          <span className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
            <Sparkles size={18} />
          </span>
          Tóm tắt cuộc hội thoại
        </h3>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Copy size={14} />
            {copied ? "Đã copy!" : "Copy Result"}
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-all border border-white/5 active:scale-95"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-6">GỐC</div>
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar whitespace-pre-wrap leading-relaxed text-white text-lg font-medium opacity-80">
              {summary?.original || "Chưa có tóm tắt."}
            </div>
          </div>
          <div className="p-8 md:p-10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-6">DỊCH</div>
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar whitespace-pre-wrap leading-relaxed text-white text-lg font-medium opacity-80">
              {summary?.translated || "Chưa có tóm tắt."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

