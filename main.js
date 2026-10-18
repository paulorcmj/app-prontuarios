const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const banco = require('./banco');

let resultadoTeste;

function criarJanela() {
  const janela = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janela.loadFile('index.html');
}

app.whenReady().then(() => {
  resultadoTeste = banco.testar();
  console.log(resultadoTeste);
  ipcMain.handle('teste:resultado', () => resultadoTeste);
  criarJanela();
});

app.on('window-all-closed', () => app.quit());