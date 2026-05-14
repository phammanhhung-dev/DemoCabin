import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Languages } from "lucide-react";

function formatTime(d) {
  try {
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export default function ConversationSegments({ segments }) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  // segments are stored newest-first; UI should show oldest -> newest (new lines go down)
  const displaySegments = useMemo(() => (segments || []).slice().reverse(), [segments]);

  useEffect(() => {
    if (!stickToBottom) return;
    // TỐI ƯU: Sử dụng "instant" (hoặc behavior: "auto") để cuộn ngay lập tức khi đang ở chế độ cabin
    // giúp văn bản mới xuất hiện không bị trễ.
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [displaySegments, stickToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceToBottom < 80);
  };

  if (!segments?.length) {
    return (
      <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/5">
        <p className="text-slate-600 font-medium text-sm">Chưa có nội dung. Hãy bắt đầu nói...</p>
      </div>
    );
  }

  const renderDirection = (seg) => {
    if (!seg.sourceLang || !seg.targetLang) return null;

    const sLang = String(seg.sourceLang).toLowerCase();
    const tLang = String(seg.targetLang).toLowerCase();
    const spkLang = seg.speakerLang ? String(seg.speakerLang).toLowerCase() : sLang;

    // Nếu speakerLang là targetLang, thì hướng là target -> source
    if (spkLang === tLang) {
      return `${tLang.toUpperCase()} → ${sLang.toUpperCase()}`;
    }

    // Mặc định hoặc nếu speakerLang là sourceLang, thì hướng là source -> target
    return `${sLang.toUpperCase()} → ${tLang.toUpperCase()}`;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar"
    >
      {displaySegments.map((seg) => (
        <div
          key={seg.id}
          className="bg-[#1E293B]/50 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-2xl transition-all hover:border-blue-500/20 overflow-hidden"
        >
          <div className="p-6 md:p-8 pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                {formatTime(seg.createdAt)}
                {seg.speakerLang ? (
                  <span className="ml-3 text-blue-400/60">({String(seg.speakerLang).toUpperCase()})</span>
                ) : null}
              </div>
              <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5">
                {renderDirection(seg)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-white/10">
            <div className="relative group p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-3 opacity-60">
                <Mic size={14} /> Gốc
              </div>
              <div className="whitespace-pre-wrap text-lg md:text-xl font-medium leading-relaxed text-white">
                {seg.original || ""}
                {seg.interimOriginal ? (
                  <span className="text-slate-500 italic">{seg.original ? "\n" : ""}{seg.interimOriginal}</span>
                ) : null}
              </div>
            </div>

            <div className="relative group p-6 md:p-8">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3 opacity-60">
                <Languages size={14} /> Dịch
              </div>
              <div className="whitespace-pre-wrap text-lg md:text-xl font-medium leading-relaxed text-white">
                {seg.translated || ""}
                {seg.interimTranslated ? (
                  <span className="text-emerald-500/50 italic">{seg.translated ? "\n" : ""}{seg.interimTranslated}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

