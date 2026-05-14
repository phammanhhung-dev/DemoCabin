import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AdminLayout from "../../components/admin/AdminLayout";
import { History as HistoryIcon, ArrowRight, Languages, Calendar, User, Search, ArrowUpDown } from "lucide-react";
import { getAdminHistory } from "../../services/api";
import { getUsers } from "../../services/adminApi";

const PAGE_SIZE = 10;

export default function AdminHistory() {
  const router = useRouter();
  const { userId } = router.query;

  // Trang danh sách người dịch
  const [users, setUsers] = useState([]);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [sortBy, setSortBy] = useState("recent_translation");

  // Trang chi tiết lịch sử
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch danh sách người dịch (trang chính)
  useEffect(() => {
    if (!mounted || router.isReady === false) return;

    if (!userId) {
      const timer = setTimeout(() => {
        loadUsers(0, search, sortBy);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [search, mounted, router.isReady, userId, sortBy]);

  // Fetch lịch sử chi tiết (khi có userId)
  useEffect(() => {
    if (!router.isReady || !userId) return;

    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        setError(null);
        const res = await getAdminHistory(userId);
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.detail || "Không thể tải lịch sử");
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [router.isReady, userId]);

  const loadUsers = async (offset, currentSearch = search, currentSortBy = sortBy) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`[DEBUG Frontend] loadUsers called: offset=${offset}, search=${currentSearch}, sort_by=${currentSortBy}`);
      const res = await getUsers({
        skip: offset,
        limit: PAGE_SIZE,
        search: currentSearch,
        sort_by: currentSortBy
      });
      const payload = res.data;
      const baseUsers = Array.isArray(payload?.items) ? payload.items : [];
      setTotal(typeof payload?.total === "number" ? payload.total : baseUsers.length);
      setSkip(typeof payload?.skip === "number" ? payload.skip : offset);

      // Fetch history để tính usage stats (vẫn cần nếu backend chưa trả stats)
      const withUsage = await Promise.all(
        baseUsers.map(async (u) => {
          // Nếu backend đã trả sẵn last_translation_at thì dùng luôn
          const last_translation_at = u.last_translation_at || null;

          const hasUsageFields =
            u.recognized_words !== undefined &&
            u.translated_words !== undefined &&
            u.estimated_tokens !== undefined &&
            u.estimated_cost_usd !== undefined;

          if (hasUsageFields) return { ...u, last_translation_at };

          const hRes = await getAdminHistory(u.id);
          const historyData = hRes.data;
          const rows = Array.isArray(historyData) ? historyData : [];

          const countWords = (text) =>
            String(text || "")
              .trim()
              .split(/\s+/)
              .filter(Boolean).length;

          const recognized_words = rows.reduce(
            (sum, item) => sum + countWords(item.original_text || item.original),
            0
          );
          const translated_words = rows.reduce(
            (sum, item) => sum + countWords(item.translated_text || item.translated),
            0
          );
          const estimated_tokens = recognized_words + translated_words;
          const estimated_cost_usd = Number(((estimated_tokens / 1000) * 0.002).toFixed(6));

          return {
            ...u,
            recognized_words,
            translated_words,
            estimated_tokens,
            estimated_cost_usd,
            last_translation_at: last_translation_at || (rows.length > 0 ? rows[0].created_at : null),
          };
        })
      );

      setUsers(withUsage);
    } catch (err) {
      setError(err?.response?.data?.detail || "Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!mounted || !dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return "-";
    }
  };

  const hasNext = skip + users.length < total;
  const hasPrev = skip > 0;

  const goNext = () => {
    if (!hasNext || loading) return;
    loadUsers(skip + PAGE_SIZE, search, sortBy);
  };

  const goPrev = () => {
    if (!hasPrev || loading) return;
    loadUsers(Math.max(0, skip - PAGE_SIZE), search, sortBy);
  };

  // ========== TRANG CHI TIẾT LỊCH SỬ (khi có userId) ==========
  if (userId) {
    return (
      <AdminLayout>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-black">Chi tiết lịch sử người dùng</h2>
              <p className="text-xs font-medium text-gray-500 mt-1">
                User ID: <span className="font-mono text-blue-600">#{userId}</span>
              </p>
            </div>
            <button
              onClick={() => router.push("/admin/history")}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              ← Quay lại
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 text-sm">
            <span>⚠️</span> {error}
          </div>
        )}

        {historyLoading ? (
          <div className="flex items-center justify-center py-32 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Đang tải lịch sử...</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
            <HistoryIcon className="text-gray-300 mb-4" size={48} />
            <p className="text-gray-700 text-lg font-medium">Không tìm thấy dữ liệu</p>
            <p className="text-gray-500 text-sm">Người dùng này chưa thực hiện bản dịch nào.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {history.map((item, index) => (
              <div
                key={item.id || index}
                className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600 uppercase tracking-wider">
                        Original
                      </div>
                      <p className="text-gray-700 text-base leading-relaxed">{item.original_text || item.original}</p>
                    </div>

                    <div className="flex items-center gap-2 text-gray-400 pl-14">
                      <ArrowRight size={16} />
                      <div className="h-[1px] flex-1 bg-gray-200"></div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 text-[10px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-600 uppercase tracking-wider">
                        Dịch
                      </div>
                      <p className="text-gray-900 text-base font-semibold leading-relaxed">{item.translated_text || item.translated}</p>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end gap-2 border-t md:border-t-0 border-gray-200 pt-4 md:pt-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600 font-medium">
                      <Languages size={13} />
                      <span>Auto Detect</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600 font-medium">
                      <Calendar size={13} />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    );
  }

  // ========== TRANG DANH SÁCH NGƯỜI DỊCH (trang chính) ==========
  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Danh sách người dịch gần nhất</h2>

        <div className="flex flex-1 max-w-md relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setSkip(0);
            }}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="recent_translation">Lần dịch cuối (mới nhất trước)</option>
            <option value="recent_translation_asc">Người dịch gần nhất (cũ nhất trước)</option>
          </select>
          <button
            type="button"
            onClick={() => loadUsers(0, search, sortBy)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50"
          >
            Tải lại
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Tên</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Lần dịch cuối</th>
              <th className="text-right px-4 py-3">Từ nhận dạng</th>
              <th className="text-right px-4 py-3">Từ dịch</th>
              <th className="text-right px-4 py-3">Token ước tính</th>
              <th className="text-right px-4 py-3">Chi phí (USD)</th>
              <th className="text-center px-4 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Chưa có dữ liệu người dùng.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Đang tải dữ liệu...
                </td>
              </tr>
            )}

            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.id}</td>
                  <td className="px-4 py-3 font-medium">{u.full_name || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {u.last_translation_at ? formatDate(u.last_translation_at) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono">{u.recognized_words ?? 0}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono">{u.translated_words ?? 0}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono">{u.estimated_tokens ?? 0}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">${(u.estimated_cost_usd ?? 0).toFixed(4)}</td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/history?userId=${u.id}`}
                      className="inline-block px-3 py-1.5 rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600 transition text-xs"
                    >
                      Xem lịch sử
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Hiển thị{" "}
            <strong>
              {users.length ? skip + 1 : 0}–{skip + users.length}
            </strong>{" "}
            / <strong>{total}</strong> người dùng
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!hasPrev || loading}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!hasNext || loading}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Tiếp
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
