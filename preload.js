const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  resultadoTeste: () => ipcRenderer.invoke('teste:resultado'),
});