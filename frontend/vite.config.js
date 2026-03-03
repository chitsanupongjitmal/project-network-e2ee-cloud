
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {

    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../backend/certs/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../backend/certs/cert.pem')),
    },

    proxy: {

      '/api': {
        target: 'https://localhost:4001',
        changeOrigin: true,
        secure: false,
      },

      '/socket.io': {
        target: 'https://localhost:4001',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});