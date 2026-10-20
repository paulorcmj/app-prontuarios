// Processo principal do Electron: abre o banco, cria a janela
// e responde aos pedidos da tela.

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const banco = require('./banco');
const { gerarPdfPaciente, gerarPdfAnalista } = require('./pdf');
const seguranca = require('./seguranca');
const fs = require('fs');

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 720,
    minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // A tela roda isolada, sem acesso ao Node nem ao banco.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // A tela cancela o fechamento quando há alterações sem salvar (beforeunload);
  // aqui o usuário escolhe entre sair mesmo assim ou voltar a editar.
  janela.webContents.on('will-prevent-unload', (evento) => {
    const escolha = dialog.showMessageBoxSync(janela, {
      type: 'warning',
      buttons: ['Sair sem salvar', 'Continuar editando'],
      defaultId: 1,
      cancelId: 1,
      title: 'Alterações não salvas',
      message: 'Há alterações que não foram salvas.',
      detail: 'Se sair agora, o que foi digitado será perdido.',
    });
    // preventDefault() ignora o cancelamento da tela e deixa a janela fechar.
    if (escolha === 0) evento.preventDefault();
  });
  // Em desenvolvimento a tela vem do servidor do Vite; no app pronto, da pasta gerada.
  if (process.env.VITE_DEV_SERVER_URL) {
    janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    janela.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// Cada canal liga uma chamada da tela a uma função do banco.js.
function registrarIpcBanco() {
  ipcMain.handle('pdf:analista', (evento, pacienteId) =>
    gerarPdfAnalista(pacienteId, BrowserWindow.fromWebContents(evento.sender))
  );
  ipcMain.handle('pacientes:criar', (_e, dados) => banco.criarPaciente(dados));
  ipcMain.handle('pacientes:atualizar', (_e, id, dados) => banco.atualizarPaciente(id, dados));
  ipcMain.handle('pacientes:listar', (_e, situacao, busca) => banco.listarPacientes(situacao, busca));
  ipcMain.handle('pacientes:obter', (_e, id) => banco.obterPaciente(id));
  ipcMain.handle('pacientes:arquivar', (_e, id) => banco.arquivarPaciente(id));
  ipcMain.handle('pacientes:desarquivar', (_e, id) => banco.desarquivarPaciente(id));
  ipcMain.handle('pacientes:excluir', (_e, id) => banco.excluirPaciente(id));
  ipcMain.handle('sessoes:criar', (_e, pacienteId, dados) => banco.criarSessao(pacienteId, dados));
  ipcMain.handle('sessoes:listar', (_e, pacienteId, busca) => banco.listarSessoes(pacienteId, busca));
  ipcMain.handle('sessoes:atualizar', (_e, id, dados) => banco.atualizarSessao(id, dados));
  ipcMain.handle('sessoes:excluir', (_e, id) => banco.excluirSessao(id));

  ipcMain.handle('valores:adicionar', (_e, pacienteId, valor, aPartirDe) => banco.adicionarValor(pacienteId, valor, aPartirDe));
  ipcMain.handle('valores:listar', (_e, pacienteId) => banco.listarValores(pacienteId));
  ipcMain.handle('valores:excluir', (_e, id) => banco.excluirValor(id));
  ipcMain.handle('valores:atual', (_e, pacienteId) => banco.valorAtual(pacienteId));
  ipcMain.handle('valores:naData', (_e, pacienteId, data) => banco.valorNaData(pacienteId, data));
  ipcMain.handle('profissional:obter', () => banco.obterProfissional());
  ipcMain.handle('profissional:salvar', (_e, dados) => banco.salvarProfissional(dados));
  ipcMain.handle('pdf:paciente', (evento, pacienteId) =>
    gerarPdfPaciente(pacienteId, BrowserWindow.fromWebContents(evento.sender))
  );
}

// Os canais que usam o banco só são registrados depois que ele abre.
// Enquanto o app está trancado, a tela só consegue falar com os canais "acesso:".
let liberado = false;

// Configuração criada na tela de senha, ainda não gravada em disco.
let pendente = null;

// Se sobrou um banco de antes sem o chaves.json, nenhuma chave nova abre ele.
// Em vez de apagar, ele é renomeado e o app começa um banco novo.
function guardarBancoSemChave() {
  const base = path.join(app.getPath('userData'), 'prontuarios.db');
  const sufixo = Date.now();
  for (const parte of ['', '-wal', '-shm']) {
    if (fs.existsSync(base + parte)) fs.renameSync(base + parte, `${base}${parte}.sem-chave-${sufixo}`);
  }
}

function liberarBanco(chaveBanco) {
  banco.iniciar(chaveBanco);
  registrarIpcBanco();
  liberado = true;
}

function registrarIpcAcesso() {
  ipcMain.handle('acesso:estado', () => {
    if (liberado) return 'liberado';
    return seguranca.existeConfiguracao() ? 'entrar' : 'criar';
  });

// Primeiro uso, em duas etapas: preparar devolve a chave de recuperação para a tela mostrar
// e só confirmar grava em disco e abre o banco.
ipcMain.handle('acesso:preparar', (_e, senha) => {
  if (liberado || seguranca.existeConfiguracao()) throw new Error('O app já foi configurado');
  pendente = seguranca.preparar(senha);
  return pendente.chaveRecuperacao;
});

ipcMain.handle('acesso:confirmar', () => {
  if (!pendente) throw new Error('Nenhuma senha em criação');
  if (seguranca.existeConfiguracao()) throw new Error('O app já foi configurado');
  guardarBancoSemChave();
  // O banco abre antes de gravar as chaves: se a abertura falhar, nada fica gravado
  // e o usuário pode tentar de novo.
  liberarBanco(pendente.chaveBanco);
  seguranca.gravar(pendente.conteudo);
  pendente = null;
});

ipcMain.handle('acesso:cancelar', () => {
  pendente = null;
});

  ipcMain.handle('acesso:entrar', (_e, senha) => {
    if (liberado) return true;
    const chaveBanco = seguranca.abrirComSenha(senha);
    if (!chaveBanco) return false;
    liberarBanco(chaveBanco);
    return true;
  });

  // Esqueceu a senha: a chave de recuperação abre o banco e define uma senha nova.
  ipcMain.handle('acesso:recuperar', (_e, chaveRecuperacao, novaSenha) => {
    if (liberado) return true;
    const chaveBanco = seguranca.abrirComRecuperacao(chaveRecuperacao);
    if (!chaveBanco) return false;
    seguranca.trocarSenha(chaveBanco, novaSenha);
    liberarBanco(chaveBanco);
    return true;
  });
}

app.whenReady().then(() => {
  registrarIpcAcesso();
  // Sem a barra de menu padrão (File, Edit, View, Window).
  Menu.setApplicationMenu(null);
  criarJanela();
});

app.on('window-all-closed', () => app.quit());