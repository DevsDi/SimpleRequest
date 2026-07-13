import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 使用相对路径,Chrome扩展必需
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // Monaco 核心编辑器代码单独打包
          if (id.includes('monaco-editor/esm/vs/editor/edcore.main') ||
              id.includes('monaco-editor/esm/vs/editor/editor.api')) {
            return 'monaco-core';
          }
          // JSON 语言支持
          if (id.includes('monaco-editor/esm/vs/language/json')) {
            return 'monaco-json';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
