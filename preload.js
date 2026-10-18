// Lista o que a tela pode pedir ao processo principal.
// Fora dessas funções, a tela não tem como falar com o banco.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pacientes: {
    criar: (dados) => ipcRenderer.invoke('pacientes:criar', dados),
    atualizar: (id, dados) => ipcRenderer.invoke('pacientes:atualizar', id, dados),
    listar: (situacao, busca) => ipcRenderer.invoke('pacientes:listar', situacao, busca),
    obter: (id) => ipcRenderer.invoke('pacientes:obter', id),
    arquivar: (id) => ipcRenderer.invoke('pacientes:arquivar', id),
    desarquivar: (id) => ipcRenderer.invoke('pacientes:desarquivar', id),
    excluir: (id) => ipcRenderer.invoke('pacientes:excluir', id),
  },
});