const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3-multiple-ciphers');

const SENHA_DEV = 'senha-de-teste-dev';

function caminhoDoBanco() {
  return path.join(app.getPath('userData'), 'prontuarios.db');
}

function abrir(senha) {
  const db = new Database(caminhoDoBanco());
  db.pragma(`key='${senha}'`);
  // com senha errada, é essa leitura que falha
  db.prepare('SELECT count(*) FROM sqlite_master').get();
  return db;
}

function tentar(fn) {
  try {
    fn();
    return 'ABRIU (não deveria)';
  } catch (erro) {
    return 'recusado: ' + erro.message;
  }
}

// provisório: só para confirmar a criptografia
function testar() {
  const db = abrir(SENHA_DEV);
  db.exec('CREATE TABLE IF NOT EXISTS teste (id INTEGER PRIMARY KEY, texto TEXT)');
  db.prepare('INSERT INTO teste (texto) VALUES (?)').run('dado ficticio');
  const linhas = db.prepare('SELECT count(*) AS n FROM teste').get().n;
  db.close();

  const inicio = fs.readFileSync(caminhoDoBanco()).subarray(0, 15).toString('latin1');

  return {
    linhasLidasComSenhaCerta: linhas,
    arquivoPareceSQLiteSemCifra: inicio === 'SQLite format 3',
    senhaErrada: tentar(() => abrir('senha-errada').close()),
    semSenha: tentar(() => {
      const d = new Database(caminhoDoBanco());
      d.prepare('SELECT count(*) FROM sqlite_master').get();
    }),
  };
}

module.exports = { abrir, testar, SENHA_DEV };