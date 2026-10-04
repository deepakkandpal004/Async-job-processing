import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev proxy: API calls go same-origin, Vite forwards them to the
    // backend. This avoids browser CORS blocking (backend has no CORS
    // middleware, intentionally left untouched).
    proxy: {
      "/jobs": { target: "http://localhost:3000", changeOrigin: true },
      "/admin": { target: "http://localhost:3000", changeOrigin: true },
      "/metrics": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
