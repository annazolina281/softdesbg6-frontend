export const API = (path) => {
  const base = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
  return `${base}${path}`;
};