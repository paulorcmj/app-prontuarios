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
  janela.loadFile('index.html');
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
}

app.whenReady().then(() => {
  banco.iniciar();
  registrarIpc();
  criarJanela();
});

app.on('window-all-closed', () => app.quit());