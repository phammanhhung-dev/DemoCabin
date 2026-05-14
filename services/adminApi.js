import API from "./api"

export const getUsers = (params = {}) =>
  API.get("/admin/users_v2", {
    params: {
      skip: params.skip ?? 0,
      limit: params.limit ?? 10,
      search: params.search || undefined,
      sort_by: params.sort_by || undefined,
    },
  });

export const deleteUser = (id, opts = {}) =>
  API.delete(`/admin/users/${id}`, {
    params: { force: opts.force ? 1 : 0 },
  });

export const createUser = (data) => API.post("/admin/users", data);

export const updateUser = (id, data) => API.put(`/admin/users/${id}`, data);

// Backward compatible name
export const updateRole = (id, data) => updateUser(id, data);