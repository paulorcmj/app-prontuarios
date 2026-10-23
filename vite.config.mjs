import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// No modo de desenvolvimento, o Vite injeta scripts inline e abre um WebSocket para
// recarregar a tela. Só nesse modo a política do index.html é trocada por uma mais aberta;
// o app instalado fica com a política estrita.
const csp_dev = {
  name: 'csp-desenvolvimento',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(
      /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
      `$1default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:5173 http://localhost:5173; object-src 'none'; base-uri 'none'$2`
    );
  },
};

export default defineConfig({
  plugins: [vue(), csp_dev],
  // Caminhos relativos: o Electron abre a tela pelo arquivo, sem servidor.
  base: './',
  // Porta fixa para o main.js saber o endereço em desenvolvimento.
  server: { port: 5173, strictPort: true },
});