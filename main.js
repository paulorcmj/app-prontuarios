// Processo principal do Electron: abre o banco, cria a janela
// e responde aos pedidos da tela.

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const banco = require('./banco');
const { gerarPdfPaciente, gerarPdfAnalista } = require('./pdf');
const seguranca = require('./seguranca');
const backup = require('./backup');

// A pasta de dados é a mesma em desenvolvimento e no app instalado, qualquer que seja
// o nome de exibição do programa. Tem que vir antes de qualquer uso do userData.
app.setPath('userData', path.join(app.getPath('appData'), 'app-prontuarios'));

// Os canais que usam o banco só são registrados depois que ele abre.
// Enquanto o app está trancado, a tela só consegue falar com os canais "acesso:" e de carregar backup.
let liberado = false;

// "Sair" recarrega a tela (que pergunta antes se houver alterações sem salvar).
// O app só tranca quando a tela nova pede o estado, com a saída já confirmada.
let sairPendente = false;

// A tela avisa aqui quando há alterações sem salvar; o fechamento da janela consulta este valor.
let alteracoesPendentes = false;

// Mensagem de falha do backup automático, mostrada na janela de backup.
let avisoBackup = '';

// Configuração criada na tela de senha, ainda não gravada em disco.
let pendente = null;

// Backup escolhido e já conferido, esperando a confirmação da tela.
let backupEscolhido = null;

// Para abrir um termo de autorização, o app grava uma cópia numa pasta temporária do sistema
// e entrega ao leitor padrão do Windows. A pasta é apagada ao abrir e ao fechar o app.
function pastaTemporaria() {
  return path.join(app.getPath('temp'), 'app-prontuarios-termos');
}

function limparTemporarios() {
  try {
    fs.rmSync(pastaTemporaria(), { recursive: true, force: true });
  } catch {
    // arquivo ainda aberto no leitor: a limpeza é refeita na próxima vez
  }
}

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
  // Alt+F4 e o X da janela passam por aqui. Com alterações sem salvar, a janela não fecha:
  // a tela mostra o aviso do app e só depois pede o fechamento de verdade.
  let fechamentoConfirmado = false;
  janela.on('close', (evento) => {
    if (!fechamentoConfirmado && alteracoesPendentes) {
      evento.preventDefault();
      janela.webContents.send('janela:pedido-de-fechar');
      return;
    }
    // A janela vai fechar de verdade: guarda o estado final da sessão.
    backupAoSair();
  });
  ipcMain.on('janela:alteracoes', (_e, pendente) => {
    alteracoesPendentes = pendente === true;
  });
  ipcMain.handle('janela:fechar', () => {
    fechamentoConfirmado = true;
    janela.close();
  });
  // Tela recarregada, alterações descartadas: o valor guardado aqui não pode ficar velho.
  janela.webContents.on('did-finish-load', () => {
    alteracoesPendentes = false;
  });
  // Em desenvolvimento a tela vem do servidor do Vite; no app pronto, da pasta gerada.
  if (process.env.VITE_DEV_SERVER_URL) {
    janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    janela.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// Backup ao fechar a janela e ao sair, só se algo mudou. Se falhar (pasta num pendrive
// desconectado, por exemplo), o backup de abertura tenta de novo e mostra o aviso.
function backupAoSair() {
  if (!liberado) return;
  try {
    backup.fazerBackup(true);
  } catch {
    // o backup de abertura repete a tentativa
  }
}

// Fecha o banco e volta ao estado de antes da senha. Os canais do banco continuam
// registrados, mas sem banco aberto qualquer chamada falha.
function trancar() {
  banco.fechar();
  liberado = false;
  pendente = null;
  backupEscolhido = null;
  sairPendente = false;
  avisoBackup = '';
}

// Cada canal liga uma chamada da tela a uma função do banco.js.
let ipcBancoRegistrado = false;

function registrarIpcBanco() {
  if (ipcBancoRegistrado) return;
  ipcBancoRegistrado = true;
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
  ipcMain.handle('responsavel:obter', (_e, pacienteId) => banco.obterResponsavel(pacienteId));
  ipcMain.handle('responsavel:salvar', (_e, pacienteId, dados, termo) => banco.salvarResponsavel(pacienteId, dados, termo));

  // Escolher o termo só lê o arquivo e devolve para a tela; quem grava no banco é o
  // responsavel:salvar, junto com o resto da seção.
  ipcMain.handle('termo:escolher', async (evento) => {
    const janela = BrowserWindow.fromWebContents(evento.sender);
    const escolha = await dialog.showOpenDialog(janela, {
      title: 'Anexar termo de autorização assinado',
      properties: ['openFile'],
      filters: [{ name: 'PDF ou imagem', extensions: ['pdf', 'jpg', 'jpeg', 'png'] }],
    });
    if (escolha.canceled) return null;
    const arquivo = escolha.filePaths[0];
    const tipo = banco.TIPOS_DO_TERMO[path.extname(arquivo).toLowerCase()];
    if (!tipo) throw new Error('Escolha um arquivo PDF, JPG ou PNG');
    if (fs.statSync(arquivo).size > banco.LIMITE_DO_TERMO) throw new Error('O arquivo passa de 10 MB');
    return { nome: path.basename(arquivo), tipo, dados: fs.readFileSync(arquivo) };
  });

  ipcMain.handle('termo:abrir', async (_e, pacienteId) => {
    const termo = banco.obterTermo(pacienteId);
    if (!termo) throw new Error('Este paciente não tem termo anexado');
    // O nome do arquivo temporário não leva o nome do paciente nem o do arquivo original.
    const extensao = Object.keys(banco.TIPOS_DO_TERMO).find((e) => banco.TIPOS_DO_TERMO[e] === termo.tipo);
    fs.mkdirSync(pastaTemporaria(), { recursive: true });
    const arquivo = path.join(pastaTemporaria(), `termo-${Date.now()}${extensao}`);
    fs.writeFileSync(arquivo, termo.dados);
    const falha = await shell.openPath(arquivo);
    if (falha) throw new Error('Não foi possível abrir o termo');
  });

  ipcMain.handle('profissional:obter', () => banco.obterProfissional());
  ipcMain.handle('profissional:salvar', (_e, dados) => banco.salvarProfissional(dados));
  ipcMain.handle('pdf:paciente', (evento, pacienteId) =>
    gerarPdfPaciente(pacienteId, BrowserWindow.fromWebContents(evento.sender))
  );

  ipcMain.handle('backup:estado', () => ({ ...backup.estado(), aviso: avisoBackup }));
  ipcMain.handle('backup:escolherPasta', async (evento) => {
    const janela = BrowserWindow.fromWebContents(evento.sender);
    const escolha = await dialog.showOpenDialog(janela, {
      title: 'Escolher a pasta dos backups',
      // Abre na pasta atual, se ela existir; senão, no padrão do Windows.
      defaultPath: backup.pastaExistente(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (escolha.canceled) return false;
    backup.escolherPasta(escolha.filePaths[0]);
    // Já sai um backup na pasta nova, para o usuário ver que funcionou.
    backup.fazerBackup(false);
    avisoBackup = '';
    return true;
  });
  ipcMain.handle('backup:agora', () => {
    backup.fazerBackup(false);
    avisoBackup = '';
  });
}

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
  // Backup automático ao abrir: rede de segurança para quando o de fechamento não rodou.
  // Uma falha não impede o uso do app: vira um aviso na janela de backup.
  try {
    backup.fazerBackup(true);
  } catch (e) {
    avisoBackup = `O backup automático falhou: ${e.message}`;
  }
}

// Carregar backup funciona com o app trancado ou aberto: num computador novo,
// é o jeito de trazer os dados antes de criar qualquer senha.
// São três chamadas: escolher o arquivo (o app confere), confirmar (a tela pergunta) ou cancelar.
function registrarIpcRestauracao() {
  ipcMain.handle('backup:escolherArquivo', async (evento) => {
    const janela = BrowserWindow.fromWebContents(evento.sender);
    const escolha = await dialog.showOpenDialog(janela, {
      title: 'Carregar backup',
      // Abre na pasta de backups, se ela existir; senão, no padrão do Windows.
      defaultPath: backup.pastaExistente(),
      properties: ['openFile'],
      filters: [{ name: 'Backup do app de prontuários', extensions: ['backup'] }],
    });
    if (escolha.canceled) return false;
    const arquivo = escolha.filePaths[0];
    // Confere o arquivo antes de perguntar qualquer coisa; se estiver ruim, nada é tocado.
    const arquivos = backup.lerBackup(arquivo);

    const jaTemDados = backup.existemArquivosDoApp();
    // A cópia dos dados atuais vai para a pasta de backups; se ela não estiver
    // disponível, fica ao lado do arquivo que está sendo carregado.
    const pastaDaCopia = backup.pastaExistente() || path.dirname(arquivo);
    backupEscolhido = { arquivos, jaTemDados, pastaDaCopia };
    return { jaTemDados, pastaDaCopia };
  });

  ipcMain.handle('backup:confirmarCarregar', () => {
    if (!backupEscolhido) throw new Error('Nenhum backup foi escolhido');
    const { arquivos, jaTemDados, pastaDaCopia } = backupEscolhido;
    backupEscolhido = null;
    // Se a cópia de segurança falhar, o erro sobe e nada é trocado.
    if (jaTemDados) backup.gravarBackup(pastaDaCopia, 'antes-de-carregar');
    pendente = null;
    banco.fechar();
    backup.substituirArquivos(arquivos);
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('backup:cancelarCarregar', () => {
    backupEscolhido = null;
  });
}

function registrarIpcAcesso() {
  ipcMain.handle('acesso:estado', () => {
    if (sairPendente) trancar();
    if (liberado) return 'liberado';
    return seguranca.existeConfiguracao() ? 'entrar' : 'criar';
  });

  ipcMain.handle('acesso:sair', () => {
    if (!liberado) return;
    // Só chega aqui com a saída já confirmada na tela.
    backupAoSair();
    sairPendente = true;
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

  // Só funciona com o app já aberto; a senha atual é conferida de novo.
  ipcMain.handle('acesso:alterarSenha', (_e, senhaAtual, novaSenha) => {
    if (!liberado) throw new Error('O app está trancado');
    return seguranca.alterarSenha(senhaAtual, novaSenha);
  });
}

app.whenReady().then(() => {
  limparTemporarios();
  registrarIpcAcesso();
  registrarIpcRestauracao();
  // Sem a barra de menu padrão (File, Edit, View, Window).
  Menu.setApplicationMenu(null);
  criarJanela();
});

app.on('will-quit', limparTemporarios);

app.on('window-all-closed', () => app.quit());