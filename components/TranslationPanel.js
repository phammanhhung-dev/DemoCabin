import { Mic, Languages, Copy, Trash2 } from "lucide-react";

function Box({ title, icon: Icon, value, color, onCopy, onClear }) {
  return (
    <div className="group relative bg-card backdrop-blur-2xl p-6 rounded-[2rem] border border-border shadow-2xl transition-all hover:border-blue-500/50">
      <div className="flex justify-between items-center mb-4">
        <h3 className={`flex items-center gap-2 font-bold uppercase tracking-widest text-xs ${color}`}>
          <Icon size={18} />
          {title}
        </h3>
      </div>

      <textarea
        value={value}
        readOnly
        placeholder="⏳ Đang chờ nội dung..."
        className="w-full h-48 md:h-[400px] bg-transparent text-foreground text-xl md:text-3xl font-light outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
      />
    </div>
  );
}

export default function TranslationPanel({ original, translated }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <Box title="Original" icon={Mic} value={original} color="text-blue-400" />
      <Box title="Translated" icon={Languages} value={translated} color="text-emerald-400" />
    </div>
  );
}

