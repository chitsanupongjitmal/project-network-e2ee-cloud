const envServerUrl = (import.meta.env.VITE_SERVER_URL || "").trim();

const normalize = (url) => url.replace(/\/$/, "");

export const SERVER_URL = (() => {
  if (envServerUrl) return normalize(envServerUrl);
  if (import.meta.env.DEV) return "http://localhost:4001";
  return window.location.origin;
})();
