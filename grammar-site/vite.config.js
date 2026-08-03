import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: '.',
  server: {
    port: 5177,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  resolve: {
    alias: {
      '@grammar': path.resolve(__dirname, '../fordata/grammar'),
    },
  },
});
