import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 가능하도록 설정
    port: 3001,
    strictPort: false,
    // 호스트 허용 목록
    allowedHosts: [
      'choonhost.zapto.org',
      '.zapto.org', // zapto.org의 모든 하위 도메인 허용
      'localhost',
      '127.0.0.1',
      '.localhost',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
