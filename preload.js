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
  sessoes: {
    criar: (pacienteId, dados) => ipcRenderer.invoke('sessoes:criar', pacienteId, dados),
    listar: (pacienteId, busca) => ipcRenderer.invoke('sessoes:listar', pacienteId, busca),
    atualizar: (id, dados) => ipcRenderer.invoke('sessoes:atualizar', id, dados),
    excluir: (id) => ipcRenderer.invoke('sessoes:excluir', id),
  },
  valores: {
    adicionar: (pacienteId, valor, aPartirDe) => ipcRenderer.invoke('valores:adicionar', pacienteId, valor, aPartirDe),
    listar: (pacienteId) => ipcRenderer.invoke('valores:listar', pacienteId),
    excluir: (id) => ipcRenderer.invoke('valores:excluir', id),
    atual: (pacienteId) => ipcRenderer.invoke('valores:atual', pacienteId),
    naData: (pacienteId, data) => ipcRenderer.invoke('valores:naData', pacienteId, data),
  },
  profissional: {
    obter: () => ipcRenderer.invoke('profissional:obter'),
    salvar: (dados) => ipcRenderer.invoke('profissional:salvar', dados),
  },
  pdf: {
    paciente: (pacienteId) => ipcRenderer.invoke('pdf:paciente', pacienteId),
    analista: (pacienteId) => ipcRenderer.invoke('pdf:analista', pacienteId),
  },
  acesso: {
  estado: () => ipcRenderer.invoke('acesso:estado'),
  preparar: (senha) => ipcRenderer.invoke('acesso:preparar', senha),
  confirmar: () => ipcRenderer.invoke('acesso:confirmar'),
  cancelar: () => ipcRenderer.invoke('acesso:cancelar'),
  entrar: (senha) => ipcRenderer.invoke('acesso:entrar', senha),
  recuperar: (chave, novaSenha) => ipcRenderer.invoke('acesso:recuperar', chave, novaSenha),
  alterarSenha: (senhaAtual, novaSenha) => ipcRenderer.invoke('acesso:alterarSenha', senhaAtual, novaSenha),
  sair: () => ipcRenderer.invoke('acesso:sair'),
  },
  janela: {
    avisarAlteracoes: (pendente) => ipcRenderer.send('janela:alteracoes', pendente),
    aoPedirFechar: (retorno) => ipcRenderer.on('janela:pedido-de-fechar', () => retorno()),
    fecharMesmoAssim: () => ipcRenderer.invoke('janela:fechar'),
  },
});