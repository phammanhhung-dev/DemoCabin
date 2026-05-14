import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import { getHistory, deleteHistory, deleteAllHistory } from "../services/api";
import { showAlert, showConfirm, showToast } from "../utils/alerts";
import {
  ArrowRight,
  Calendar,
  Copy,
  Check,
  Languages,
  Loader2,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

function formatWhen(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    const loadInitial = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getHistory(0, limit);
        if (cancelled) return;
        const arr = Array.isArray(res.data) ? res.data : [];
        setItems(arr);
        setHasMore(arr.length === limit);
      } catch (err) {
        if (!cancelled) setError("Không tải được lịch sử. Thử đăng nhập lại.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitial();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (loading || loadingMore || error || !hasMore) return;

    const sentinel = document.getElementById("history-sentinel");
    if (!sentinel) return;

    const io = new IntersectionObserver(
      async (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;

        setLoadingMore(true);
        const skip = items.length;

        try {
          const res = await getHistory(skip, limit);
          const arr = Array.isArray(res.data) ? res.data : [];
          setItems((prev) => [...prev, ...arr]);
          setHasMore(arr.length === limit);
        } catch (err) {
          console.error("Load more failed:", err);
        } finally {
          setLoadingMore(false);
        }
      },
      { threshold: 0.1 }
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [items, loading, loadingMore, error, hasMore]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const o = String(row.original ?? "").toLowerCase();
      const t = String(row.translated ?? "").toLowerCase();
      return o.includes(q) || t.includes(q);
    });
  }, [items, query]);

  const copyLine = async (text, id) => {
    if (!text?.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      /* ignore */
    }
  };

  const deleteOne = async (id) => {
    const result = await showConfirm(
      "Xóa bản dịch?",
      "Bạn có chắc chắn muốn xóa bản dịch này khỏi lịch sử không?",
      "warning",
      "Xóa",
      "Hủy"
    );

    if (!result.isConfirmed) return;

    try {
      await deleteHistory(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      showToast("Đã xóa bản dịch");
    } catch {
      showAlert("Lỗi", "Xóa thất bại", "error");
    }
  };

  const deleteAll = async () => {
    const result = await showConfirm(
      "Xóa tất cả?",
      "Bạn có chắc chắn muốn xóa tất cả lịch sử không? Hành động này không thể hoàn tác.",
      "warning",
      "Xóa hết",
      "Hủy"
    );

    if (!result.isConfirmed) return;

    try {
      await deleteAllHistory();
      setItems([]);
      setHasMore(false);
      setQuery("");
      showToast("Đã xóa toàn bộ lịch sử");
    } catch {
      showAlert("Lỗi", "Xóa thất bại", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 dark:opacity-50">
        <div className="absolute top-[-10%] right-[-15%] w-[45%] h-[45%] bg-indigo-600/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[55%] h-[40%] bg-blue-600/10 blur-[140px] rounded-full" />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-14 pb-24">
        <header className="mb-10 md:mb-14 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            <Sparkles size={12} />
            Lưu trữ
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">
            Lịch sử dịch
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl">
            Các bản dịch bạn đã lưu từ Cabin. Tìm kiếm nhanh hoặc sao chép từng dòng.
          </p>
          {!loading && !error && (
            <p className="mt-4 text-xs font-black text-slate-600 uppercase tracking-widest">
              {filtered.length} mục
            </p>
          )}
        </header>

        {!loading && !error && items.length > 0 && (
          <div className="mb-10 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600"
                size={20}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo nội dung gốc hoặc bản dịch..."
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white/[0.03] border border-white/5 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/30 transition-all text-sm font-medium"
              />
            </div>

            <button
              type="button"
              onClick={deleteAll}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest"
            >
              <Trash2 size={16} />
              Xóa tất cả
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
            <Loader2 className="animate-spin text-blue-400" size={40} />
            <p className="text-sm font-medium">Đang tải lịch sử…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
            <p className="text-red-200 text-sm mb-4">{error}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-blue-50 transition"
            >
              Đăng nhập
            </Link>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && items.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-border bg-card px-8 py-20 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 text-blue-400 mb-6">
              <Languages size={40} strokeWidth={1.25} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Chưa có lịch sử</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
              Bắt đầu dịch trên Cabin — mỗi câu hoàn chỉnh sẽ được lưu tại đây.
            </p>
            <Link
              href="/translate"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition active:scale-[0.98]"
            >
              Mở Cabin
              <ArrowRight size={18} />
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground text-sm">
            Không có kết quả khớp “{query}”.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-6">
            {filtered.map((row, index) => {
              const id = row.id ?? `idx-${index}`;
              const when = formatWhen(row.created_at);
              return (
                <li
                  key={id}
                  className="bg-[#1E293B]/30 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:border-blue-500/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400/60">
                        <Languages size={14} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                        Bản ghi #{typeof row.id === "number" ? row.id : index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {when && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          <Calendar size={12} className="opacity-50" />
                          {when}
                        </div>
                      )}
                      {typeof row.id === "number" && (
                        <button
                          type="button"
                          onClick={() => deleteOne(row.id)}
                          className="p-2 text-slate-700 hover:text-red-500 transition-colors"
                          aria-label="Xóa bản ghi"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-black/20 backdrop-blur-md p-6 rounded-2xl border border-white/5 relative group">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Gốc</span>
                        <button
                          type="button"
                          onClick={() => copyLine(row.original, `o-${id}`)}
                          className="p-2 text-slate-700 hover:text-white transition-colors"
                        >
                          {copiedId === `o-${id}` ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                      <p className="text-white text-base md:text-lg font-medium leading-relaxed opacity-80">
                        {row.original || "—"}
                      </p>
                    </div>

                    <div className="bg-black/20 backdrop-blur-md p-6 rounded-2xl border border-white/5 relative group">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/40">Dịch</span>
                        <button
                          type="button"
                          onClick={() => copyLine(row.translated, `t-${id}`)}
                          className="p-2 text-slate-700 hover:text-white transition-colors"
                        >
                          {copiedId === `t-${id}` ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                      <p className="text-white text-base md:text-lg font-medium leading-relaxed opacity-80">
                        {row.translated || "—"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && query.trim() === "" && items.length > 0 && (
          <div className="mt-6">
            <div id="history-sentinel" className="h-1" />
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
                <Loader2 className="animate-spin text-blue-400" size={18} />
                Đang tải thêm…
              </div>
            )}
            {!hasMore && (
              <p className="py-6 text-center text-[11px] text-slate-600">Đã tải hết.</p>
            )}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <p className="mt-12 text-center text-[11px] text-slate-600">
            Dữ liệu từ máy chủ Cabin ·{" "}
            <Link href="/translate" className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">
              Quay lại dịch
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
