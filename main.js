// Processo principal do Electron: abre o banco, cria a janela
// e responde aos pedidos da tela.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const banco = require('./banco');

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // A tela roda isolada, sem acesso ao Node nem ao banco.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Em desenvolvimento a tela vem do servidor do Vite; no app pronto, da pasta gerada.
  if (process.env.VITE_DEV_SERVER_URL) {
    janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    janela.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// Cada canal liga uma chamada da tela a uma função do banco.js.
function registrarIpc() {
  ipcMain.handle('pacientes:criar', (_e, dados) => banco.criarPaciente(dados));
  ipcMain.handle('pacientes:atualizar', (_e, id, dados) => banco.atualizarPaciente(id, dados));
  ipcMain.handle('pacientes:listar', (_e, situacao, busca) => banco.listarPacientes(situacao, busca));
  ipcMain.handle('pacientes:obter', (_e, id) => banco.obterPaciente(id));
  ipcMain.handle('pacientes:arquivar', (_e, id) => banco.arquivarPaciente(id));
  ipcMain.handle('pacientes:desarquivar', (_e, id) => banco.desarquivarPaciente(id));
  ipcMain.handle('pacientes:excluir', (_e, id) => banco.excluirPaciente(id));
  ipcMain.handle('sessoes:criar', (_e, pacienteId, dados) => banco.criarSessao(pacienteId, dados));
  ipcMain.handle('sessoes:listar', (_e, pacienteId) => banco.listarSessoes(pacienteId));
  ipcMain.handle('sessoes:atualizar', (_e, id, dados) => banco.atualizarSessao(id, dados));
  ipcMain.handle('sessoes:excluir', (_e, id) => banco.excluirSessao(id));

  ipcMain.handle('valores:adicionar', (_e, pacienteId, valor, aPartirDe) => banco.adicionarValor(pacienteId, valor, aPartirDe));
  ipcMain.handle('valores:listar', (_e, pacienteId) => banco.listarValores(pacienteId));
  ipcMain.handle('valores:atual', (_e, pacienteId) => banco.valorAtual(pacienteId));
  ipcMain.handle('valores:naData', (_e, pacienteId, data) => banco.valorNaData(pacienteId, data));
}

app.whenReady().then(() => {
  banco.iniciar();
  registrarIpc();
  criarJanela();
});

app.on('window-all-closed', () => app.quit());