export default function History({ history }) {
  return (
    <div className="max-w-3xl mx-auto">
      <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
        <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400">🕒</span>
        Recent Translations
      </h3>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
          <p className="text-slate-500">Your history is empty</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item, index) => (
            <div key={index} className="group bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
              <p className="text-slate-400 text-sm mb-1">{item.original}</p>
              <p className="text-white font-medium text-lg">{item.translated}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}