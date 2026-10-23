// Todo o acesso ao banco passa por este arquivo.

const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3-multiple-ciphers');

const CAMPOS_PACIENTE = [
  'nome_completo', 'cpf', 'data_nascimento', 'cidade_estado', 'queixa_inicial',
  'data_inicio', 'celular', 'contato_emergencia_nome',
  'contato_emergencia_telefone', 'adendos', 'anotacoes_caso', 'menor_de_idade',
];

const CAMPOS_RESPONSAVEL = ['nome_completo', 'data_nascimento', 'cpf', 'endereco', 'cidade_estado', 'contato'];

// Termo de autorização assinado: extensões aceitas (com o tipo de cada uma) e tamanho máximo.
// O arquivo fica dentro do banco, então entra no backup e continua protegido pela senha.
const TIPOS_DO_TERMO = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};
const LIMITE_DO_TERMO = 10 * 1024 * 1024;

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

  -- Histórico de valores: cada reajuste é uma linha nova.
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
  // Versão 2: título da sessão. O SQLite exige um DEFAULT para acrescentar coluna NOT NULL;
  // a obrigatoriedade do título é validada ao criar e editar (validarTitulo).
  `ALTER TABLE sessoes ADD COLUMN titulo TEXT NOT NULL DEFAULT '';`,
  // Versão 3: data da última modificação do paciente, usada para ordenar a lista.
  // Os pacientes que já existem recebem a hora da migração.
  `
  ALTER TABLE pacientes ADD COLUMN modificado_em TEXT;
  UPDATE pacientes SET modificado_em = strftime('%Y-%m-%d %H:%M', 'now', 'localtime');
  `,
  // Versão 4: dados do profissional (cabeçalho do PDF). Linha única, preenchida pela tela de configurações.
  `
  CREATE TABLE profissional (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome TEXT NOT NULL DEFAULT '',
    crp TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO profissional (id) VALUES (1);
  `,
  // Versão 5: foto do perfil, guardada como imagem em texto (data URL), já reduzida pela tela.
  `ALTER TABLE profissional ADD COLUMN foto TEXT NOT NULL DEFAULT '';`,
  // Versão 6: a coluna "cidade" passa a guardar cidade e estado, e o paciente pode ser
  // marcado como menor de idade (0 ou 1). Os dados que já existem são mantidos.
  `
  ALTER TABLE pacientes RENAME COLUMN cidade TO cidade_estado;
  ALTER TABLE pacientes ADD COLUMN menor_de_idade INTEGER NOT NULL DEFAULT 0 CHECK (menor_de_idade IN (0, 1));
  `,
  // Versão 7: responsável pelo paciente menor de idade, com o termo de autorização assinado.
  // Por enquanto o app usa um responsável por paciente, mas a tabela não impede mais de um.
  `
  CREATE TABLE responsaveis (
    id INTEGER PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nome_completo TEXT NOT NULL,
    data_nascimento TEXT,
    cpf TEXT,
    endereco TEXT,
    cidade_estado TEXT,
    termo_nome TEXT,
    termo_tipo TEXT,
    termo_dados BLOB,
    termo_anexado_em TEXT
  );

  CREATE INDEX idx_responsaveis_paciente ON responsaveis (paciente_id);
  `,

  // Versão 8: contato (celular) do responsável.
  `ALTER TABLE responsaveis ADD COLUMN contato TEXT;`,
  // Versão 9: última modificação da sessão, usada para ordenar a lista de sessões.
  // As sessões que já existem recebem a hora da migração.
  `
  ALTER TABLE sessoes ADD COLUMN modificado_em TEXT;
  UPDATE sessoes SET modificado_em = strftime('%Y-%m-%d %H:%M', 'now', 'localtime');
  `,
  // Versão 10: as sessões criadas depois da versão 9 ficaram sem data de modificação.
  // Elas passam a usar a data da própria sessão.
  `UPDATE sessoes SET modificado_em = data_hora WHERE modificado_em IS NULL;`,
];

let db;

function caminhoDoBanco() {
  return path.join(app.getPath('userData'), 'prontuarios.db');
}

function abrir(chave) {
  const conexao = new Database(caminhoDoBanco());
  try {
    // A chave é um texto hexadecimal gerado pelo app (seguranca.js), nunca digitado na tela.
    conexao.pragma(`key='${chave}'`);
    // Com chave errada, a primeira leitura é que falha.
    conexao.prepare('SELECT count(*) FROM sqlite_master').get();
  } catch (e) {
    // Sem fechar, o arquivo continuaria preso e uma nova tentativa falharia no Windows.
    conexao.close();
    throw e;
  }
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

function iniciar(chave) {
  db = abrir(chave);
  try {
    // sem isso o ON DELETE CASCADE não funciona
    db.pragma('foreign_keys = ON');
    migrar(db);
  } catch (e) {
    // Sem fechar, o arquivo ficaria preso e uma nova tentativa falharia no Windows.
    fechar();
    throw e;
  }
}

// hora local; toISOString() sairia em UTC
function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Padrão para o LIKE: % e _ digitados pelo usuário valem como texto comum, não como curinga.
// Quem usa o padrão precisa declarar ESCAPE '\'.
function padraoLike(termo) {
  return '%' + termo.replace(/[\\%_]/g, '\\$&') + '%';
}

// Marca o paciente como modificado agora. Sessões, valores e responsável também contam,
// porque fazem parte do prontuário.
function tocar(pacienteId) {
  db.prepare('UPDATE pacientes SET modificado_em = ? WHERE id = ?').run(agora(), pacienteId);
}

function pacienteDaSessao(id) {
  return db.prepare('SELECT paciente_id FROM sessoes WHERE id = ?').get(id)?.paciente_id;
}

function pacienteDoValor(id) {
  return db.prepare('SELECT paciente_id FROM valores WHERE id = ?').get(id)?.paciente_id;
}

// Valida o nome e monta um objeto só com os campos da ficha.
function soCamposDaFicha(dados) {
  if (!dados.nome_completo || !dados.nome_completo.trim()) {
    throw new Error('O nome do paciente é obrigatório');
  }
  const limpo = {};
  for (const campo of CAMPOS_PACIENTE) limpo[campo] = dados[campo] ?? null;
  // O SQLite não guarda true/false: a marca vira 0 ou 1.
  limpo.menor_de_idade = dados.menor_de_idade ? 1 : 0;
  return limpo;
}

function criarPaciente(dados) {
  const ficha = soCamposDaFicha(dados);
  // Os nomes das colunas vêm da lista fixa acima, nunca da tela.
  const colunas = CAMPOS_PACIENTE.join(', ');
  const valores = CAMPOS_PACIENTE.map((c) => '@' + c).join(', ');
  const r = db
    .prepare(`INSERT INTO pacientes (${colunas}, modificado_em) VALUES (${valores}, @modificado_em)`)
    .run({ ...ficha, modificado_em: agora() });
  return Number(r.lastInsertRowid);
}

// Recebe a ficha inteira: o campo que não vier fica vazio.
function atualizarPaciente(id, dados) {
  const ficha = soCamposDaFicha(dados);
  const sets = CAMPOS_PACIENTE.map((c) => `${c} = @${c}`).join(', ');
  db.prepare(`UPDATE pacientes SET ${sets}, modificado_em = @modificado_em WHERE id = @id`)
    .run({ ...ficha, id, modificado_em: agora() });
}

// Devolve também a última modificação e a data da última sessão;
// a ordem da lista é escolhida na tela.
function listarPacientes(situacao, busca) {
  return db
    .prepare(
      `SELECT p.id, p.nome_completo, p.situacao, p.modificado_em,
              (SELECT MAX(data_hora) FROM sessoes WHERE paciente_id = p.id) AS ultima_sessao
       FROM pacientes p
       WHERE p.situacao = ? AND p.nome_completo LIKE ? ESCAPE '\\'
       ORDER BY p.nome_completo COLLATE NOCASE`
    )
    .all(situacao, padraoLike(busca || ''));
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

// As sessões, os valores e o responsável do paciente saem junto (ON DELETE CASCADE).
function excluirPaciente(id) {
  db.prepare('DELETE FROM pacientes WHERE id = ?').run(id);
}

// A ordenação cronológica depende deste formato de texto.
function validarDataHora(dataHora) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dataHora || '')) {
    throw new Error('A data e hora da sessão devem estar no formato AAAA-MM-DD HH:MM');
  }
}

// O título é obrigatório; devolve o texto sem espaços nas pontas.
function validarTitulo(titulo) {
  const limpo = String(titulo ?? '').trim();
  if (!limpo) throw new Error('O título da sessão é obrigatório');
  return limpo;
}

function criarSessao(pacienteId, dados) {
  validarDataHora(dados.data_hora);
  const titulo = validarTitulo(dados.titulo);
  const r = db
    .prepare(
      'INSERT INTO sessoes (paciente_id, data_hora, titulo, relato, anotacoes, modificado_em) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(pacienteId, dados.data_hora, titulo, dados.relato ?? null, dados.anotacoes ?? null, agora());
  tocar(pacienteId);
  return Number(r.lastInsertRowid);
}

// Ordem cronológica; o id desempata sessões no mesmo horário.
// Com busca, filtra por título, relato ou anotações do paciente.
function listarSessoes(pacienteId, busca) {
  const termo = (busca || '').trim();
  if (!termo) {
    return db
      .prepare('SELECT * FROM sessoes WHERE paciente_id = ? ORDER BY data_hora, id')
      .all(pacienteId);
  }
  const padrao = padraoLike(termo);
  return db
    .prepare(
      `SELECT * FROM sessoes
       WHERE paciente_id = ?
         AND (titulo LIKE ? ESCAPE '\\' OR relato LIKE ? ESCAPE '\\' OR anotacoes LIKE ? ESCAPE '\\')
       ORDER BY data_hora, id`
    )
    .all(pacienteId, padrao, padrao, padrao);
}

// Recebe a sessão inteira: o campo que não vier fica vazio (o título não pode).
function atualizarSessao(id, dados) {
  validarDataHora(dados.data_hora);
  const titulo = validarTitulo(dados.titulo);
  db.prepare('UPDATE sessoes SET data_hora = ?, titulo = ?, relato = ?, anotacoes = ?, modificado_em = ? WHERE id = ?')
    .run(dados.data_hora, titulo, dados.relato ?? null, dados.anotacoes ?? null, agora(), id);
  const pacienteId = pacienteDaSessao(id);
  if (pacienteId) tocar(pacienteId);
}

function excluirSessao(id) {
  const pacienteId = pacienteDaSessao(id);
  db.prepare('DELETE FROM sessoes WHERE id = ?').run(id);
  if (pacienteId) tocar(pacienteId);
}

// Valor em centavos (R$ 150,00 = 15000). Cada reajuste é uma linha nova.
function adicionarValor(pacienteId, valor, aPartirDe) {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error('O valor deve ser um número inteiro de centavos');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aPartirDe || '')) {
    throw new Error('A data do reajuste deve estar no formato AAAA-MM-DD');
  }
  const r = db
    .prepare('INSERT INTO valores (paciente_id, valor, a_partir_de) VALUES (?, ?, ?)')
    .run(pacienteId, valor, aPartirDe);
  tocar(pacienteId);
  return Number(r.lastInsertRowid);
}

// O valor atual é a primeira linha (a mais recente).
function listarValores(pacienteId) {
  return db
    .prepare('SELECT * FROM valores WHERE paciente_id = ? ORDER BY a_partir_de DESC, id DESC')
    .all(pacienteId);
}

// Remove uma linha do histórico. Não há edição: para corrigir, remove-se e adiciona-se outra.
function excluirValor(id) {
  const pacienteId = pacienteDoValor(id);
  db.prepare('DELETE FROM valores WHERE id = ?').run(id);
  if (pacienteId) tocar(pacienteId);
}

// Devolve o responsável sem o arquivo do termo (que pode ser grande): só o nome
// e a data do anexo. O arquivo em si sai por obterTermo.
function obterResponsavel(pacienteId) {
  return db
    .prepare(
      `SELECT id, nome_completo, data_nascimento, cpf, endereco, cidade_estado, contato,
              termo_nome, termo_tipo, termo_anexado_em
       FROM responsaveis WHERE paciente_id = ? ORDER BY id LIMIT 1`
    )
    .get(pacienteId) ?? null;
}

// Grava o responsável do paciente (cria ou atualiza) e, se vier, mexe no termo.
// O parâmetro termo tem três formas: null mantém o que está salvo, 'remover' apaga o arquivo
// e um objeto { nome, tipo, dados } grava o arquivo novo. Nenhum campo é obrigatório.
function salvarResponsavel(pacienteId, dados, termo) {
  const campos = {};
  for (const campo of CAMPOS_RESPONSAVEL) campos[campo] = String(dados[campo] ?? '').trim() || null;
  // A coluna do nome não aceita nulo: sem nome, grava texto vazio.
  campos.nome_completo ??= '';

  let arquivo = null;
  if (termo && termo !== 'remover') {
    if (!Object.values(TIPOS_DO_TERMO).includes(termo.tipo)) {
      throw new Error('O termo deve ser um arquivo PDF, JPG ou PNG');
    }
    if (!termo.dados || termo.dados.byteLength > LIMITE_DO_TERMO) {
      throw new Error('O arquivo do termo é inválido ou passa de 10 MB');
    }
    // O arquivo chega da tela como Uint8Array; o SQLite quer um Buffer.
    arquivo = { nome: String(termo.nome ?? 'termo'), tipo: termo.tipo, dados: Buffer.from(termo.dados) };
  }

  db.transaction(() => {
    let id = db
      .prepare('SELECT id FROM responsaveis WHERE paciente_id = ? ORDER BY id LIMIT 1')
      .get(pacienteId)?.id;

    if (id) {
      const sets = CAMPOS_RESPONSAVEL.map((c) => `${c} = @${c}`).join(', ');
      db.prepare(`UPDATE responsaveis SET ${sets} WHERE id = @id`).run({ ...campos, id });
    } else {
      // Os nomes das colunas vêm da lista fixa acima, nunca da tela.
      const colunas = CAMPOS_RESPONSAVEL.join(', ');
      const valores = CAMPOS_RESPONSAVEL.map((c) => '@' + c).join(', ');
      const r = db
        .prepare(`INSERT INTO responsaveis (paciente_id, ${colunas}) VALUES (@paciente_id, ${valores})`)
        .run({ ...campos, paciente_id: pacienteId });
      id = Number(r.lastInsertRowid);
    }

    if (arquivo) {
      db.prepare(
        'UPDATE responsaveis SET termo_nome = ?, termo_tipo = ?, termo_dados = ?, termo_anexado_em = ? WHERE id = ?'
      ).run(arquivo.nome, arquivo.tipo, arquivo.dados, agora(), id);
    } else if (termo === 'remover') {
      db.prepare(
        'UPDATE responsaveis SET termo_nome = NULL, termo_tipo = NULL, termo_dados = NULL, termo_anexado_em = NULL WHERE id = ?'
      ).run(id);
    }
    tocar(pacienteId);
  })();
}

// O arquivo do termo, para abrir no leitor do Windows.
function obterTermo(pacienteId) {
  return db
    .prepare(
      `SELECT termo_nome AS nome, termo_tipo AS tipo, termo_dados AS dados
       FROM responsaveis WHERE paciente_id = ? AND termo_dados IS NOT NULL ORDER BY id LIMIT 1`
    )
    .get(pacienteId) ?? null;
}

function obterProfissional() {
  return db.prepare('SELECT nome, crp, email, foto FROM profissional WHERE id = 1').get();
}

function salvarProfissional(dados) {
  const nome = String(dados.nome ?? '').trim();
  if (!nome) throw new Error('O nome é obrigatório');
  // A tela já reduz a foto; este limite só impede lixo ou imagem gigante no banco.
  const foto = String(dados.foto ?? '');
  if (foto && (!foto.startsWith('data:image/') || foto.length > 500000)) {
    throw new Error('A foto é inválida ou grande demais');
  }
  db.prepare('UPDATE profissional SET nome = ?, crp = ?, email = ?, foto = ? WHERE id = 1')
    .run(nome, String(dados.crp ?? '').trim(), String(dados.email ?? '').trim(), foto);
}

// Usada ao sair e antes de trocar o arquivo do banco (carregar backup).
function fechar() {
  if (db) {
    db.close();
    db = undefined;
  }
}

module.exports = {
  TIPOS_DO_TERMO,
  LIMITE_DO_TERMO,
  iniciar,
  criarPaciente,
  atualizarPaciente,
  listarPacientes,
  obterPaciente,
  arquivarPaciente,
  desarquivarPaciente,
  excluirPaciente,
  criarSessao,
  listarSessoes,
  atualizarSessao,
  excluirSessao,
  adicionarValor,
  listarValores,
  excluirValor,
  obterResponsavel,
  salvarResponsavel,
  obterTermo,
  obterProfissional,
  salvarProfissional,
  fechar,
};