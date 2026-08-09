export const resolveApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      let url = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      if (url.includes("make-my-trip-production.up.railway.app")) {
        url = "http://localhost:8000/api";
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (url.endsWith("/v1")) {
        url = url.slice(0, -3);
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (!url.endsWith("/api")) {
        url = `${url}/api`;
      }
      return url;
    } else {
      return `${window.location.origin}/api`;
    }
  }
  return "http://localhost:8000/api";
};

export const API_BASE = resolveApiBase();
export const API_URL = `${API_BASE}/v1`;

export const resolveAdminBase = () => {
  let url = import.meta.env.VITE_ADMIN_URL;
  if (!url || url.includes("placeholder") || url.includes("<")) {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        url = `http://${hostname}:5174`;
      } else {
        url = "https://admin.travelos.com";
      }
    } else {
      url = "http://localhost:5174";
    }
  }
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
};

export const ADMIN_BASE = resolveAdminBase();
