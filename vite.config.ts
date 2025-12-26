import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // ngrok経由のアクセスを許可
    allowedHosts: true,
    // 外部（ngrok）から接続できるようにホストを公開
    host: true,
  }
})