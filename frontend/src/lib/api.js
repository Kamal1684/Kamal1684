import axios from "axios";

const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/")) {
      localStorage.removeItem("nc_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const apiError = (err, fallback = "Something went wrong") =>
  err?.response?.data?.detail || err?.message || fallback;

export default api;
