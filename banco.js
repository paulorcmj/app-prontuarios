// Todo o acesso ao banco passa por este arquivo.

const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3-multiple-ciphers');

// Senha fixa de desenvolvimento. Será substituída pela tela de senha.
const SENHA_DEV = 'senha-de-teste-dev';

const CAMPOS_PACIENTE = [
  'nome_completo', 'cpf', 'data_nascimento', 'cidade', 'queixa_inicial',
  'data_inicio', 'celular', 'contato_emergencia_nome',
  'contato_emergencia_telefone', 'adendos', 'anotacoes_caso',
];

// Cada item é uma versão do banco. Mudanças futuras entram no fim da lista.
// Datas são guardadas como texto, no formato AAAA-MM-DD HH:MM.
const MIGRACOES = [
  `
  CREATE TABLE pacientes (
    id INTEGER PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT,
    data_nascimento TEXT,
    cidade TEXT,
    queixa_inicial TEXT,
    data_inicio TEXT,
    celular TEXT,
    contato_emergencia_nome TEXT,
    contato_emergencia_telefone TEXT,
    adendos TEXT,
    anotacoes_caso TEXT,
    situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'arquivado')),
    arquivado_em TEXT
  );

  -- Histórico de valores: cada reajuste é uma linha nova, nada é sobrescrito.
  -- O valor é guardado em centavos para evitar erro de arredondamento.
  CREATE TABLE valores (
    id INTEGER PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    valor INTEGER NOT NULL,
    a_partir_de TEXT NOT NULL
  );

  CREATE TABLE sessoes (
    id INTEGER PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    data_hora TEXT NOT NULL,
    relato TEXT,
    anotacoes TEXT
  );

  CREATE INDEX idx_valores_paciente ON valores (paciente_id, a_partir_de);
  CREATE INDEX idx_sessoes_paciente ON sessoes (paciente_id, data_hora);
  `,
];

let db;

function caminhoDoBanco() {
  return path.join(app.getPath('userData'), 'prontuarios.db');
}

function abrir(senha) {
  const conexao = new Database(caminhoDoBanco());
  conexao.pragma(`key='${senha}'`);
  // Com senha errada, a primeira leitura é que falha.
  conexao.prepare('SELECT count(*) FROM sqlite_master').get();
  return conexao;
}

// Roda só as migrações que faltam, cada uma numa transação,
// e guarda a versão do banco em user_version.
function migrar(conexao) {
  const atual = conexao.pragma('user_version', { simple: true });
  for (let v = atual; v < MIGRACOES.length; v++) {
    conexao.transaction(() => {
      conexao.exec(MIGRACOES[v]);
      conexao.pragma(`user_version = ${v + 1}`);
    })();
  }
}

function iniciar() {
  db = abrir(SENHA_DEV);
  // sem isso o ON DELETE CASCADE não funciona
  db.pragma('foreign_keys = ON');
  migrar(db);
}

// hora local; toISOString() sairia em UTC
function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Valida o nome e monta um objeto só com os campos da ficha.
function soCamposDaFicha(dados) {
  if (!dados.nome_completo || !dados.nome_completo.trim()) {
    throw new Error('O nome do paciente é obrigatório');
  }
  const limpo = {};
  for (const campo of CAMPOS_PACIENTE) limpo[campo] = dados[campo] ?? null;
  return limpo;
}

function criarPaciente(dados) {
  const ficha = soCamposDaFicha(dados);
  // Os nomes das colunas vêm da lista fixa acima, nunca da tela.
  const colunas = CAMPOS_PACIENTE.join(', ');
  const valores = CAMPOS_PACIENTE.map((c) => '@' + c).join(', ');
  const r = db.prepare(`INSERT INTO pacientes (${colunas}) VALUES (${valores})`).run(ficha);
  return Number(r.lastInsertRowid);
}

// Recebe a ficha inteira: o campo que não vier fica vazio.
function atualizarPaciente(id, dados) {
  const ficha = soCamposDaFicha(dados);
  const sets = CAMPOS_PACIENTE.map((c) => `${c} = @${c}`).join(', ');
  db.prepare(`UPDATE pacientes SET ${sets} WHERE id = @id`).run({ ...ficha, id });
}

function listarPacientes(situacao, busca) {
  return db
    .prepare(
      `SELECT id, nome_completo, situacao FROM pacientes
       WHERE situacao = ? AND nome_completo LIKE ?
       ORDER BY nome_completo COLLATE NOCASE`
    )
    .all(situacao, `%${busca || ''}%`);
}

function obterPaciente(id) {
  return db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id);
}

// Arquivar e desarquivar são sempre ações manuais.
function arquivarPaciente(id) {
  db.prepare("UPDATE pacientes SET situacao = 'arquivado', arquivado_em = ? WHERE id = ?").run(agora(), id);
}

function desarquivarPaciente(id) {
  db.prepare("UPDATE pacientes SET situacao = 'ativo', arquivado_em = NULL WHERE id = ?").run(id);
}

// As sessões e os valores do paciente saem junto (ON DELETE CASCADE).
function excluirPaciente(id) {
  db.prepare('DELETE FROM pacientes WHERE id = ?').run(id);
}

module.exports = {
  iniciar,
  criarPaciente,
  atualizarPaciente,
  listarPacientes,
  obterPaciente,
  arquivarPaciente,
  desarquivarPaciente,
  excluirPaciente,
};