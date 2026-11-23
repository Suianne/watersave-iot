import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // caminho relativo para o build funcionar em qualquer subpasta (ex.: GitHub Pages)
  base: './',
  // host: true expõe o servidor na rede local para testar no celular
  server: { host: true },
  preview: { host: true },
  test: {
    include: ['testes/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
})
