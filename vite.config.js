import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [basicSsl()],
  server: { 
    https: true, 
    host: true,
    port: 3000,
    strictPort: false,
    hmr: {
      clientPort: 3000,
      host: true
    } 
  },
});
