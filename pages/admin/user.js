import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { getUsers, deleteUser, createUser, updateUser } from "../../services/adminApi";
import { getAdminHistory } from "../../services/api";
import { showAlert, showConfirm, showToast } from "../../utils/alerts";

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    role: "user",
    password: "",
  });

  const loadPage = async (offset, currentSearch = search) => {
    try {
      setLoading(true);
      setError("");
      const res = await getUsers({ skip: offset, limit: PAGE_SIZE, search: currentSearch });
      const payload = res.data;
      const baseUsers = Array.isArray(payload?.items) ? payload.items : [];
      setTotal(typeof payload?.total === "number" ? payload.total : baseUsers.length);
      setSkip(typeof payload?.skip === "number" ? payload.skip : offset);

      // Nếu backend chưa trả sẵn thống kê usage thì tự tính từ history.
      const withUsage = await Promise.all(
        baseUsers.map(async (u) => {
          const hasUsageFields =
            u.recognized_words !== undefined &&
            u.translated_words !== undefined &&
            u.estimated_tokens !== undefined &&
            u.estimated_cost_usd !== undefined;

          if (hasUsageFields) return u;

          const hRes = await getAdminHistory(u.id);
          const history = hRes.data;
          const rows = Array.isArray(history) ? history : [];

          const countWords = (text) =>
            String(text || "")
              .trim()
              .split(/\s+/)
              .filter(Boolean).length;

          const recognized_words = rows.reduce(
            (sum, item) => sum + countWords(item.original),
            0
          );
          const translated_words = rows.reduce(
            (sum, item) => sum + countWords(item.translated),
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
          };
        })
      );

      setUsers(withUsage);
    } catch (err) {
      setError(err?.response?.data?.detail || "Không thể tải danh sách user");
    } finally {
      setLoading(false);
    }
  };

  // Load initial page and handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPage(0, search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const hasNext = skip + users.length < total;
  const hasPrev = skip > 0;

  const goNext = () => {
    if (!hasNext || loading) return;
    loadPage(skip + PAGE_SIZE);
  };

  const goPrev = () => {
    if (!hasPrev || loading) return;
    loadPage(Math.max(0, skip - PAGE_SIZE));
  };

  const handleDelete = async (user) => {
    const result = await showConfirm(
      "Xóa người dùng?",
      `Xoá user ${user.email}? Hành động này không thể hoàn tác.`,
      "warning",
      "Xóa",
      "Hủy"
    );
    if (!result.isConfirmed) return;

    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      await loadPage(skip);
      showToast("Đã xóa người dùng");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 400 && String(detail || "").includes("dữ liệu liên quan")) {
        const forceResult = await showConfirm(
          "Xóa cưỡng chế?",
          `${detail}\n\nBạn có muốn XÓA LUÔN toàn bộ dữ liệu liên quan để xóa user này không?`,
          "error",
          "Xóa sạch",
          "Hủy"
        );
        if (forceResult.isConfirmed) {
          try {
            await deleteUser(user.id, { force: true });
            await loadPage(skip);
            showToast("Đã xóa sạch dữ liệu người dùng");
          } catch (e2) {
            showAlert("Lỗi", e2?.response?.data?.detail || "Xoá user thất bại", "error");
          }
        }
      } else {
        showAlert("Lỗi", detail || "Xoá user thất bại", "error");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    const full_name = window.prompt("Nhập họ tên (tiếng Việt OK):", "");
    if (!full_name) return;
    const email = window.prompt("Nhập email:", "");
    if (!email) return;
    const password = window.prompt("Nhập mật khẩu:", "");
    if (!password) return;
    const role = window.prompt("Nhập role (admin/staff/user):", "user") || "user";

    try {
      setLoading(true);
      setError("");
      await createUser({ full_name, email, password, role });
      await loadPage(0);
      showToast("Tạo user thành công");
    } catch (err) {
      showAlert("Lỗi", err?.response?.data?.detail || "Tạo user thất bại", "error");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "user",
      password: "",
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (loading) return;
    setEditOpen(false);
    setEditUser(null);
    setEditForm({ full_name: "", email: "", role: "user", password: "" });
  };

  const submitEdit = async (e) => {
    e?.preventDefault?.();
    if (!editUser) return;

    const payload = {};
    if (editForm.full_name !== String(editUser.full_name || "")) payload.full_name = editForm.full_name;
    if (editForm.email !== String(editUser.email || "")) payload.email = editForm.email;
    if (editForm.role !== String(editUser.role || "")) payload.role = editForm.role;
    if (editForm.password) payload.password = editForm.password;

    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }

    try {
      setLoading(true);
      setError("");
      await updateUser(editUser.id, payload);
      await loadPage(skip);
      showToast("Cập nhật thành công");
      closeEdit();
    } catch (err) {
      showAlert("Lỗi", err?.response?.data?.detail || "Cập nhật user thất bại", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Quản lý người dùng</h2>

        <div className="flex flex-1 max-w-md relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50"
          >
            Thêm user
          </button>
          <button
            type="button"
            onClick={() => loadPage(0)}
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
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-right px-4 py-3">Từ nhận dạng</th>
              <th className="text-right px-4 py-3">Từ dịch</th>
              <th className="text-right px-4 py-3">Token ước tính</th>
              <th className="text-right px-4 py-3">Chi phí ước tính (USD)</th>
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
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3">{u.id}</td>
                  <td className="px-4 py-3">{u.full_name || "-"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3 text-right">{u.recognized_words ?? 0}</td>
                  <td className="px-4 py-3 text-right">{u.translated_words ?? 0}</td>
                  <td className="px-4 py-3 text-right">{u.estimated_tokens ?? 0}</td>
                  <td className="px-4 py-3 text-right">{u.estimated_cost_usd ?? 0}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/admin/history?userId=${u.id}`}
                        className="inline-block px-2 py-1 rounded-md bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition text-xs"
                      >
                        Lịch sử
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        disabled={loading}
                        className="px-2 py-1 rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 transition text-xs"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="px-2 py-1 rounded-md bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition text-xs"
                      >
                        {deletingId === u.id ? "Đang xoá..." : "Xoá"}
                      </button>
                    </div>
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

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-bold">Sửa user</h3>
                <p className="text-sm text-slate-500">ID: {editUser?.id}</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={loading}
                className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={submitEdit} className="px-5 py-4">
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Họ tên</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="👤 VD: Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="📧 VD: user@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    value={editForm.role}
                    onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  >
                    <option value="user">user</option>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Mật khẩu mới <span className="font-normal text-slate-500">(bỏ trống nếu không đổi)</span>
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    value={editForm.password}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="🔒 Nhập mật khẩu..."
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-40"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}