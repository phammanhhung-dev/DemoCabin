import { Mic, Square } from "lucide-react"

export default function Recorder({ onRecord, isRecording }) {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* Nút ghi âm chính */}
      <button
        onClick={onRecord}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-500 transform hover:scale-105 active:scale-95 z-10
        ${isRecording
            ? "bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)]"
            : "bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:bg-blue-500"}`}
      >
        {isRecording ? (
          <Mic size={36} className="animate-pulse" />
        ) : (
          <Mic size={36} />
        )}

        {/* Hiệu ứng vòng tròn lan tỏa */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-10" />
        )}
      </button>

      {/* Text hướng dẫn */}
      <p className={`font-black uppercase tracking-[0.2em] transition-all duration-500 ${isRecording
          ? "text-xs text-red-500 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
          : "text-xs text-slate-500 opacity-60"
        }`}>
        {isRecording ? "● Recording... Tap to stop" : "Tap to start speaking"}
      </p>
    </div>
  )
}