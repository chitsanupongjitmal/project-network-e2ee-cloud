const envServerUrl = (import.meta.env.VITE_SERVER_URL || "").trim();

const normalize = (url) => url.replace(/\/$/, "");
const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";

export const SERVER_URL = (() => {
  if (envServerUrl) {
    // Avoid mixed-content failures when frontend is HTTPS but API is configured as HTTP.
    if (isHttpsPage && envServerUrl.startsWith("http://")) return "";
    return normalize(envServerUrl);
  }
  if (import.meta.env.DEV) return "http://localhost:4001";
  return "";
})();
