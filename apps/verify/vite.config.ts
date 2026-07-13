import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_API_URL is read from .env at dev time via import.meta.env.VITE_API_URL
  // Set it in apps/verify/.env.local or pass it at build time:
  //   VITE_API_URL=https://api.identity.sovegent.com pnpm build
});
