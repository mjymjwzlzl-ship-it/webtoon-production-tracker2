import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Firebase를 별도 청크로 분리
              firebase: ['firebase/app', 'firebase/firestore', 'firebase/storage'],
              // XLSX 라이브러리를 별도 청크로 분리
              xlsx: ['xlsx'],
              // React 관련 라이브러리
              react: ['react', 'react-dom']
            }
          }
        },
        chunkSizeWarningLimit: 1000,
        minify: 'esbuild',
      },
      optimizeDeps: {
        include: ['firebase/app', 'firebase/firestore', 'firebase/storage']
      }
    };
});
