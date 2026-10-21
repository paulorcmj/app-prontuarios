// Backup e restauração. O backup é um arquivo só, com o banco (já criptografado)
// e o chaves.json juntos: sem os dois, o banco não abre.
// Nada aqui precisa da senha, os arquivos são copiados como estão.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const ID_DO_FORMATO = 'app-prontuarios';
const VERSAO_DO_FORMATO = 1;

function caminhoDoBanco() {
  return path.join(app.getPath('userData'), 'prontuarios.db');
}

function caminhoDasChaves() {
  return path.join(app.getPath('userData'), 'chaves.json');
}

// Guarda a pasta escolhida e o resumo do último backup feito.
function caminhoDaConfig() {
  return path.join(app.getPath('userData'), 'backup.json');
}

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(caminhoDaConfig(), 'utf8'));
  } catch {
    return {};
  }
}

function gravarConfig(config) {
  fs.writeFileSync(caminhoDaConfig(), JSON.stringify(config, null, 2));
}

function existemArquivosDoApp() {
  return fs.existsSync(caminhoDoBanco()) && fs.existsSync(caminhoDasChaves());
}

// Pasta escolhida para os backups, só se ela existir agora (um pendrive desconectado,
// por exemplo, não existe). Serve de ponto de partida para as janelas de escolher arquivo.
// Sem pasta escolhida, devolve undefined e o app não indica nenhuma pasta ao Windows.
function pastaExistente() {
  const pasta = lerConfig().pasta;
  return pasta && fs.existsSync(pasta) ? pasta : undefined;
}

function calcularResumo(banco, chaves) {
  return crypto.createHash('sha256').update(banco).update(chaves).digest('hex');
}

function lerArquivosDoApp() {
  const banco = fs.readFileSync(caminhoDoBanco());
  const chaves = fs.readFileSync(caminhoDasChaves());
  return { banco, chaves, resumo: calcularResumo(banco, chaves) };
}

// Nome do arquivo: AAAA-MM-DD_HH-MM-SS-tipo.backup
// A data vem primeiro, então o Explorer ordena do mais antigo ao mais recente, qualquer que seja o tipo
// (automático, manual, antes de carregar). Para ver o mais recente em cima, basta inverter a ordem do Nome.
function nomeDoArquivo(tipo) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const legivel = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `${legivel}-${tipo}.backup`;
}

// Grava o backup num arquivo temporário e renomeia, para nunca deixar um backup pela metade.
function gravarBackup(pastaDestino, tipo, arquivos = lerArquivosDoApp()) {
  const conteudo = {
    app: ID_DO_FORMATO,
    versao: VERSAO_DO_FORMATO,
    criado_em: new Date().toISOString(),
    sha256: arquivos.resumo,
    banco: arquivos.banco.toString('base64'),
    chaves: arquivos.chaves.toString('base64'),
  };
  fs.mkdirSync(pastaDestino, { recursive: true });
  const destino = path.join(pastaDestino, nomeDoArquivo(tipo));
  const temporario = destino + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(conteudo));
  fs.renameSync(temporario, destino);
  return destino;
}

// Faz um backup na pasta escolhida. No modo automático (soSeMudou), não faz nada
// se não houver pasta, se o app ainda não tiver os arquivos ou se nada mudou desde o último.
function fazerBackup(soSeMudou) {
  const config = lerConfig();
  if (!config.pasta) {
    if (soSeMudou) return;
    throw new Error('Escolha a pasta dos backups primeiro');
  }
  if (soSeMudou && !existemArquivosDoApp()) return;
  const arquivos = lerArquivosDoApp();
  if (soSeMudou && arquivos.resumo === config.ultimoResumo) return;
  gravarBackup(config.pasta, 'prontuarios', arquivos);
  gravarConfig({ ...config, ultimoResumo: arquivos.resumo, ultimoBackupEm: new Date().toISOString() });
}

// Trocar a pasta zera o resumo, para o próximo backup sair mesmo sem mudanças.
function escolherPasta(pasta) {
  gravarConfig({ ...lerConfig(), pasta, ultimoResumo: null });
}

function estado() {
  const config = lerConfig();
  return { pasta: config.pasta || '', ultimoBackupEm: config.ultimoBackupEm || '' };
}

// Confere o arquivo antes de qualquer troca; se algo estiver errado, nada foi alterado.
function lerBackup(caminho) {
  const invalido = new Error('Esse arquivo não é um backup deste app');
  let conteudo;
  try {
    conteudo = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  } catch {
    throw invalido;
  }
  if (
    conteudo?.app !== ID_DO_FORMATO ||
    conteudo.versao !== VERSAO_DO_FORMATO ||
    typeof conteudo.banco !== 'string' ||
    typeof conteudo.chaves !== 'string'
  ) {
    throw invalido;
  }
  const banco = Buffer.from(conteudo.banco, 'base64');
  const chaves = Buffer.from(conteudo.chaves, 'base64');
  const corrompido = new Error('O backup está corrompido');
  if (calcularResumo(banco, chaves) !== conteudo.sha256) throw corrompido;
  try {
    JSON.parse(chaves.toString('utf8'));
  } catch {
    throw corrompido;
  }
  return { banco, chaves };
}

// Troca o banco e o chaves.json pelos do backup. Os dois são gravados ao lado
// antes de qualquer renomeação, para o tempo sem os dois no lugar ser mínimo.
function substituirArquivos(arquivos) {
  const alvoBanco = caminhoDoBanco();
  const alvoChaves = caminhoDasChaves();
  fs.writeFileSync(alvoBanco + '.novo', arquivos.banco);
  fs.writeFileSync(alvoChaves + '.novo', arquivos.chaves);
  // Restos do banco antigo não podem se misturar com o novo.
  for (const parte of ['-wal', '-shm', '-journal']) fs.rmSync(alvoBanco + parte, { force: true });
  fs.renameSync(alvoBanco + '.novo', alvoBanco);
  fs.renameSync(alvoChaves + '.novo', alvoChaves);
}

module.exports = {
  lerConfig,
  existemArquivosDoApp,
  pastaExistente,
  gravarBackup,
  fazerBackup,
  escolherPasta,
  estado,
  lerBackup,
  substituirArquivos,
};