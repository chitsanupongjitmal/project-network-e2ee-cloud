
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const certDir = path.resolve(__dirname, '../backend/certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  const hasLocalCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
  const devBackendTarget = process.env.VITE_DEV_BACKEND_URL || 'http://localhost:4001';

  const server = isDev
    ? {
        https: hasLocalCerts
          ? {
              key: fs.readFileSync(keyPath),
              cert: fs.readFileSync(certPath)
            }
          : false,
        proxy: {
          '/api': {
            target: devBackendTarget,
            changeOrigin: true,
            secure: false
          },
          '/socket.io': {
            target: devBackendTarget,
            ws: true,
            changeOrigin: true,
            secure: false
          }
        }
      }
    : undefined;

  return {
    plugins: [react()],
    server
  };
});
