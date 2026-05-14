import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getAdminAllTickets, updateTicket } from "../../services/api";
import { ChevronDown, CheckCircle, AlertCircle, Clock, MessageSquare, Send, X } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { showAlert } from "../../utils/alerts";

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // all, open, in_progress, resolved, closed
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [updatingTicketId, setUpdatingTicketId] = useState(null);

  useEffect(() => {
    // Check admin role
    const role = localStorage.getItem("role");
    if (role !== "admin") {
      router.replace("/");
      return;
    }

    loadTickets();
  }, [filter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const statusParam = filter !== "all" ? filter : null;
      const response = await getAdminAllTickets(statusParam);
      setTickets(response.data || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
      showAlert("Lỗi", "Không thể tải danh sách ticket", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicket = async (status) => {
    if (!selectedTicket) return;

    setUpdatingTicketId(selectedTicket.id);
    try {
      const data = {
        status: status,
        response: responseText
      };
      await updateTicket(selectedTicket.id, data);

      // Update local state
      setTickets(tickets.map(t =>
        t.id === selectedTicket.id
          ? { ...t, status, response: responseText, updated_at: new Date().toISOString() }
          : t
      ));

      setSelectedTicket(null);
      setResponseText("");
      showAlert("Thành công", "Cập nhật ticket thành công!", "success");
    } catch (error) {
      console.error("Failed to update ticket:", error);
      showAlert("Lỗi", "Cập nhật ticket thất bại", "error");
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      open: { label: "Mở", color: "bg-blue-100 text-blue-700 border border-blue-200" },
      in_progress: { label: "Đang xử lý", color: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
      resolved: { label: "Đã giải quyết", color: "bg-green-100 text-green-700 border border-green-200" },
      closed: { label: "Đóng", color: "bg-gray-100 text-gray-700 border border-gray-200" }
    };
    const item = statusMap[status] || statusMap.open;
    return <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${item.color}`}>{item.label}</span>;
  };

  const getPriorityColor = (priority) => {
    const colorMap = {
      low: "text-blue-600",
      normal: "text-gray-600",
      high: "text-orange-600",
      urgent: "text-red-600"
    };
    return colorMap[priority] || "text-gray-600";
  };

  const filteredTickets = filter === "all" ? tickets : tickets.filter(t => t.status === filter);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Quản lý Support
        </h2>
        <p className="text-muted-foreground">Quản lý tất cả các yêu cầu hỗ trợ từ người dùng</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
        {["all", "open", "in_progress", "resolved", "closed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-6 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${filter === status
              ? "bg-blue-600 text-white shadow-md"
              : "bg-card text-muted-foreground border border-border hover:bg-muted"
              }`}
          >
            {status === "all"
              ? "Tất cả"
              : status === "open"
                ? "Mở"
                : status === "in_progress"
                  ? "Đang xử lý"
                  : status === "resolved"
                    ? "Đã giải quyết"
                    : "Đóng"}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets Column */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-muted-foreground">Đang tải...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-sm">
              <MessageSquare className="mx-auto mb-4 text-muted-foreground/50" size={40} />
              <p className="text-muted-foreground">Không có ticket nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`bg-card border-2 p-6 rounded-2xl cursor-pointer transition-all hover:shadow-md ${selectedTicket?.id === ticket.id
                    ? "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10"
                    : "border-border hover:border-blue-500/30"
                    }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-foreground">{ticket.title}</h3>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">#{ticket.id} • {new Date(ticket.created_at).toLocaleString("vi-VN")}</p>
                    </div>
                    <span className={`text-sm font-bold px-2 py-1 rounded ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                  {ticket.response && (
                    <div className="mt-3 p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">Phản hồi của admin:</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{ticket.response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Detail Panel */}
        <div className="lg:col-span-1">
          {selectedTicket ? (
            <div className="bg-card border border-border shadow-sm rounded-2xl p-6 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-foreground">Chi tiết Ticket</h4>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 hover:bg-muted rounded-full transition-all text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Ticket Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Tiêu đề</p>
                  <p className="text-sm font-bold text-foreground">{selectedTicket.title}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Mô tả</p>
                  <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Trạng thái</p>
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Ưu tiên</p>
                    <p className={`font-bold text-sm ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority}
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 mb-6"></div>

              {/* Response Area */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                    Phản hồi
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="💬 Nhập phản hồi cho khách hàng..."
                    rows="4"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-all text-gray-900"
                  ></textarea>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleUpdateTicket("in_progress")}
                    disabled={updatingTicketId === selectedTicket.id}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-300 text-white font-bold py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Clock size={16} /> {updatingTicketId === selectedTicket.id ? "Đang cập nhật..." : "Đang xử lý"}
                  </button>
                  <button
                    onClick={() => handleUpdateTicket("resolved")}
                    disabled={updatingTicketId === selectedTicket.id}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white font-bold py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={16} /> {updatingTicketId === selectedTicket.id ? "Đang cập nhật..." : "Đã giải quyết"}
                  </button>
                  <button
                    onClick={() => handleUpdateTicket("closed")}
                    disabled={updatingTicketId === selectedTicket.id}
                    className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-300 text-white font-bold py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <AlertCircle size={16} /> {updatingTicketId === selectedTicket.id ? "Đang cập nhật..." : "Đóng"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 flex flex-col items-center justify-center h-96">
              <MessageSquare className="text-gray-300 mb-4" size={40} />
              <p className="text-gray-400 text-center">Chọn một ticket để xem chi tiết và phản hồi</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
