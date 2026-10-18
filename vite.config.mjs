import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // Caminhos relativos: o Electron abre a tela pelo arquivo, sem servidor.
  base: './',
  // Porta fixa para o main.js saber o endereço em desenvolvimento.
  server: { port: 5173, strictPort: true },
});