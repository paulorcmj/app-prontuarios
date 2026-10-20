// Guarda a chave do banco em disco, protegida de duas formas:
// pela senha do usuário e pela chave de recuperação.
// O banco não é cifrado direto com a senha: ele usa uma chave aleatória
// (a chave do banco), e é ela que fica trancada nas duas cópias.
// Assim a senha pode mudar sem recifrar o banco inteiro.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Sem I, O, 0 e 1, que se confundem quando a chave é anotada à mão.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_CHAVE_RECUPERACAO = 24;

function caminhoDasChaves() {
  return path.join(app.getPath('userData'), 'chaves.json');
}

function existeConfiguracao() {
  return fs.existsSync(caminhoDasChaves());
}

// Não há tamanho mínimo; só não aceita senha vazia.
function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length === 0) {
    throw new Error('Digite uma senha');
  }
}

// O scrypt é lento de propósito: cada tentativa de adivinhar a senha custa tempo.
// O NFC garante que a mesma senha com acento gere sempre a mesma chave.
function derivar(segredo, salt) {
  return crypto.scryptSync(String(segredo).normalize('NFC'), salt, 32, {
    N: 2 ** 15,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

// Tranca a chave do banco com um segredo (a senha ou a chave de recuperação).
function trancar(chaveBanco, segredo) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', derivar(segredo, salt), iv);
  const dados = Buffer.concat([cifra.update(chaveBanco), cifra.final()]);
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cifra.getAuthTag().toString('base64'),
    dados: dados.toString('base64'),
  };
}

// Devolve a chave do banco, ou null se o segredo estiver errado.
function destrancar(pacote, segredo) {
  try {
    const decifra = crypto.createDecipheriv(
      'aes-256-gcm',
      derivar(segredo, Buffer.from(pacote.salt, 'base64')),
      Buffer.from(pacote.iv, 'base64')
    );
    decifra.setAuthTag(Buffer.from(pacote.tag, 'base64'));
    return Buffer.concat([decifra.update(Buffer.from(pacote.dados, 'base64')), decifra.final()]);
  } catch {
    // O GCM confere uma etiqueta de autenticação: com segredo errado, cai aqui.
    return null;
  }
}

function lerChaves() {
  return JSON.parse(fs.readFileSync(caminhoDasChaves(), 'utf8'));
}

// Grava num arquivo temporário e renomeia, para nunca deixar o arquivo pela metade.
function gravarChaves(conteudo) {
  const destino = caminhoDasChaves();
  const temporario = destino + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(conteudo, null, 2));
  fs.renameSync(temporario, destino);
}

function gerarChaveRecuperacao() {
  let texto = '';
  for (let i = 0; i < TAMANHO_CHAVE_RECUPERACAO; i++) {
    texto += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return texto;
}

// Mostrada em grupos de 4 (ABCD-EFGH-...), mais fácil de copiar à mão.
function formatar(chave) {
  return chave.match(/.{4}/g).join('-');
}

// Aceita a chave digitada com ou sem hífens, em maiúsculas ou minúsculas.
function normalizar(chave) {
  return String(chave).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Monta a configuração inicial sem gravar nada em disco.
// A gravação só acontece em gravar(), depois que o usuário confirma que guardou a chave de recuperação.
function preparar(senha) {
  validarSenha(senha);
  const chaveBanco = crypto.randomBytes(32);
  const recuperacao = gerarChaveRecuperacao();
  return {
    chaveBanco: chaveBanco.toString('hex'),
    chaveRecuperacao: formatar(recuperacao),
    conteudo: {
      versao: 1,
      senha: trancar(chaveBanco, senha),
      recuperacao: trancar(chaveBanco, recuperacao),
    },
  };
}

function gravar(conteudo) {
  gravarChaves(conteudo);
}

function abrirComSenha(senha) {
  const chave = destrancar(lerChaves().senha, senha);
  return chave ? chave.toString('hex') : null;
}

function abrirComRecuperacao(chaveRecuperacao) {
  const chave = destrancar(lerChaves().recuperacao, normalizar(chaveRecuperacao));
  return chave ? chave.toString('hex') : null;
}

// Retranca a mesma chave do banco com a senha nova; a cópia da recuperação não muda.
function trocarSenha(chaveBancoHex, novaSenha) {
  validarSenha(novaSenha);
  const chaves = lerChaves();
  chaves.senha = trancar(Buffer.from(chaveBancoHex, 'hex'), novaSenha);
  gravarChaves(chaves);
}

module.exports = {
  existeConfiguracao,
  preparar,
  gravar,
  abrirComSenha,
  abrirComRecuperacao,
  trocarSenha,
};