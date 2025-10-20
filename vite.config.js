import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config to ensure React JSX compiles correctly in dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
  },
});