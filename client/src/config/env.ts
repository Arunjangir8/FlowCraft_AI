const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

export const env = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ??
    (backendUrl ? `${backendUrl}/api/v1` : "http://localhost:5000/api/v1"),
};
