import axios from "axios";

// Tự động xác định địa chỉ Backend
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Nếu đang dùng Dev Tunnel (ví dụ: zsh551pf-3000.asse.devtunnels.ms)
    if (host.includes("devtunnels.ms") && host.includes("-3000")) {
      return `https://${host.replace("-3000", "-8000")}`;
    }
    // Nếu truy cập bằng IP mạng nội bộ (ví dụ: 192.168.1.x)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `http://${host}:8000`;
    }
  }
  return "http://localhost:8000";
};

export const BASE_URL = getBaseUrl();
console.log("Backend API URL:", BASE_URL);

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    "X-Tunnel-Skip-Antiphishing-Page": "true",
  }
});


API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.detail || error.message;
    const reqUrl = String(error.config?.url ?? "");

    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !reqUrl.includes("/login")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = "/login";
    }

    // Centralized error logging
    if (typeof window !== "undefined") {
      console.error(`[API Error] ${status}: ${message}`);
    }

    return Promise.reject(error);
  }
);

// ================= AUTH =================

export const login = (email, password) => {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  return API.post("/login", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const register = (data) => {
  return API.post("/register", data);
};

export const me = () => {
  return API.get("/me");
};

export const forgotPassword = (email) => {
  return API.post("/forgot-password", { email });
};

// ================= TRANSLATION =================

export const saveTranslation = (data) => {
  return API.post("/translation/save", data);
};

export const getHistory = (skip = 0, limit = 20) => {
  return API.get("/translation/history", {
    params: { skip, limit },
  });
};

export const deleteHistory = (id) => {
  return API.delete(`/translation/history/${id}`);
};

export const deleteAllHistory = () => {
  return API.delete("/translation/history/all");
};

// ================= USER PROFILE =================

export const getUserProfile = () => {
  return API.get("/api/users/profile");
};

export const updateProfile = (data) => {
  return API.put("/api/users/profile", data);
};

export const updateAvatar = (avatarUrl) => {
  return API.put("/api/users/profile/avatar", { avatar_url: avatarUrl });
};

export const uploadAvatarFile = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/api/users/profile/avatar-upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// ================= SUPPORT =================

export const createSupportTicket = (data) => {
  return API.post("/api/support/tickets", data);
};

export const getUserTickets = (status = null) => {
  return API.get("/api/support/tickets", {
    params: { status: status || undefined },
  });
};

export const getTicketDetail = (ticketId) => {
  return API.get(`/api/support/tickets/${ticketId}`);
};

export const getFAQs = (category = null) => {
  return API.get("/api/support/faq", {
    params: { category: category || undefined },
  });
};

export const getFAQCategories = () => {
  return API.get("/api/support/faq/categories");
};

export const getAdminAllTickets = (status = null) => {
  return API.get("/api/support/tickets-admin", {
    params: { status: status || undefined },
  });
};

export const updateTicket = (ticketId, data) => {
  return API.put(`/api/support/tickets/${ticketId}`, data);
};

export const sendAIChatMessage = (message) => {
  return API.post("/api/support/ai-chat", { message });
};

// ================= BILLING / NOTIFICATIONS =================

export const getWalletBalance = () => {
  return API.get("/billing/wallet");
};

export const getNotifications = (skip = 0, limit = 10) => {
  return API.get("/tp/notifications/", { params: { skip, limit } });
};

export const getUnreadCount = () => {
  return API.get("/tp/notifications/unread-count");
};

export const markAllRead = () => {
  return API.post("/tp/notifications/read-all");
};

export const markNotificationRead = (id) => {
  return API.post(`/tp/notifications/${id}/read`);
};

export const markNotificationUnread = (id) => {
  return API.post(`/tp/notifications/${id}/unread`);
};

export const deleteNotification = (id) => {
  return API.delete(`/tp/notifications/${id}`);
};

export const deleteAllNotifications = () => {
  return API.delete("/tp/notifications/");
};

export const getAdminHistory = (userId = null) => {
  if (userId) {
    return API.get(`/translation/admin/history/${userId}`);
  }
  // Lấy history của người dùng hiện tại
  return API.get("/translation/history", {
    params: { skip: 0, limit: 10000 },
  });
};

export default API;