const API_BASE_URL = "https://product-management-oxoe.onrender.com";
// const API_BASE_URL = "http://127.0.0.1:8000";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    const detail =
      typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail ?? error);
    throw new Error(detail);
  }

  return response.json();
};

const api = {
  create: (product) =>
    request("/products", {
      method: "POST",
      body: JSON.stringify(product),
    }),
  readAll: (filters = {}) => {
    const query = new URLSearchParams(filters);
    const queryString = query.toString();
    return request(`/products${queryString ? `?${queryString}` : ""}`);
  },
  read: (id) => request(`/products/${id}`),
  update: (id, changes) =>
    request(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  updateQuantity: (id, quantity) =>
    request(`/products/${id}/quantity`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  delete: (id) =>
    request(`/products/${id}`, {
      method: "DELETE",
    }),
  restore: (id) =>
    request(`/products/${id}/restore`, {
      method: "PATCH",
    }),
  permanentlyDelete: (id) =>
    request(`/products/${id}/permanent`, {
      method: "DELETE",
    }),
};
