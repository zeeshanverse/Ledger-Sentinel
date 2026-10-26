import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the browser talks to http://localhost:5173/api/... and Vite
// forwards it to the Spring Boot API. No CORS involved in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
