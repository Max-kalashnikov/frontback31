import axios from "axios";

const ACCESS_KEY = "frontback2AccessToken";
const REFRESH_KEY = "frontback2RefreshToken";

const apiClient = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
    accept: "application/json",
  },
});

export function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getTokens();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    const { refreshToken } = getTokens();

    if (!refreshToken) {
      clearTokens();
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      const response = await axios.post("http://localhost:3000/api/auth/refresh", {
        refreshToken,
      });

      setTokens(response.data);
      originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearTokens();
      return Promise.reject(refreshError);
    }
  }
);

export const api = {
  async register(payload) {
    const res = await apiClient.post("/auth/register", payload);
    return res.data;
  },

  async login(payload) {
    const res = await apiClient.post("/auth/login", payload);
    setTokens(res.data);
    return res.data;
  },

  async me() {
    const res = await apiClient.get("/auth/me");
    return res.data;
  },

  async refresh(refreshToken) {
    const res = await apiClient.post("/auth/refresh", { refreshToken });
    return res.data;
  },

  async getUsers() {
    const res = await apiClient.get("/users");
    return res.data;
  },

  async updateUser(id, user) {
    const res = await apiClient.put(`/users/${id}`, user);
    return res.data;
  },

  async deleteUser(id) {
    await apiClient.delete(`/users/${id}`);
  },

  async getProducts() {
    const res = await apiClient.get("/products");
    return res.data;
  },

  async getProduct(id) {
    const res = await apiClient.get(`/products/${id}`);
    return res.data;
  },

  async createProduct(product) {
    const res = await apiClient.post("/products", product);
    return res.data;
  },

  async updateProduct(id, product) {
    const res = await apiClient.put(`/products/${id}`, product);
    return res.data;
  },

  async deleteProduct(id) {
    await apiClient.delete(`/products/${id}`);
  },
};
