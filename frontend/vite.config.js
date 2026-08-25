import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateProductionEnvironment } from './config/productionEnvironment.js';

export default defineConfig(({ mode }) => {
  const environment = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ''),
  };

  validateProductionEnvironment({ mode, environment });

  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
    test: {
      environment: 'jsdom',
      fileParallelism: false,
      maxWorkers: 1,
      pool: 'forks',
      setupFiles: './tests/setup.js',
    },
  };
});
