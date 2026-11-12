import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        admin: resolve(here, 'admin.html')
      }
    }
  }
});
