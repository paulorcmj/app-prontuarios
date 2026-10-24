// Gera os PDFs do prontuário com a impressão do próprio Electron.
// O PDF do paciente leva só a identificação e o relato das sessões; o do analista
// leva tudo o que está no prontuário, inclusive adendos e anotações.
// Se o paciente for menor de idade, os dois levam também os dados do responsável.

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { app, BrowserWindow, dialog } = require('electron');
const banco = require('./banco');
// O HTML do PDF vai para um arquivo temporário e a janela de impressão o abre por ele. Passar o HTML
// num endereço "data:" tem limite de uns 2 MB, que um prontuário muito longo pode ultrapassar.
const PASTA_TEMPORARIA = 'prontuarios-pdf';
const IDADE_DE_SOBRA_MS = 5 * 60 * 1000;

function apagarArquivo(arquivo) {
  try {
    fs.rmSync(arquivo, { force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // fica para a limpeza da próxima geração
  }
}

// Devolve a subpasta temporária do app, criando-a se preciso. Antes, apaga o que sobrou de gerações
// interrompidas (travamento no meio da impressão); arquivos recentes ficam, pois podem estar em uso.
function pastaTemporaria() {
  const pasta = path.join(app.getPath('temp'), PASTA_TEMPORARIA);
  fs.mkdirSync(pasta, { recursive: true });
  for (const nome of fs.readdirSync(pasta)) {
    const arquivo = path.join(pasta, nome);
    try {
      if (Date.now() - fs.statSync(arquivo).mtimeMs > IDADE_DE_SOBRA_MS) apagarArquivo(arquivo);
    } catch {
      // o arquivo sumiu no meio do caminho
    }
  }
  return pasta;
}

// Nome, CRP e e-mail vêm da tela de configurações (guardados no banco).
function lerProfissional() {
  const profissional = banco.obterProfissional();
  if (!profissional.nome.trim()) {
    throw new Error('Preencha seus dados no perfil para gerar o PDF');
  }
  return profissional;
}

// Texto digitado na ficha nunca entra no HTML sem passar por aqui.
function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// AAAA-MM-DD (ou AAAA-MM-DD HH:MM) vira DD/MM/AAAA.
function dataBR(data) {
  return data ? data.slice(0, 10).split('-').reverse().join('/') : '';
}

// AAAA-MM-DD HH:MM vira DD/MM/AAAA às HH:MM.
function dataHoraBR(data) {
  return data ? `${dataBR(data)} às ${data.slice(11, 16)}` : '';
}

// Escreve "CRP" antes do número, sem repetir se já foi digitado no cadastro.
function formatarCrp(crp) {
  const texto = String(crp).trim();
  return /^crp\b/i.test(texto) ? texto : `CRP ${texto}`;
}

// O banco guarda o valor em centavos.
function formatarValor(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Linha da tabela de dados; campo vazio aparece como traço.
function linha(rotulo, valor) {
  return `<tr><th>${rotulo}</th><td>${esc(valor) || '—'}</td></tr>`;
}

const ESTILO = `
  @page { size: A4; margin: 20mm 20mm 22mm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.45; color: #111; }
  .cabecalho { margin-bottom: 22px; padding-bottom: 10px; border-bottom: 1px solid #999; }
  .cabecalho .nome { font-size: 13pt; font-weight: bold; }
  .cabecalho .contato { font-size: 11pt; }
  .cabecalho p { margin: 0; }
  h1 { margin: 0 0 2px; font-size: 18pt; }
  .emissao { margin: 0 0 18px; padding-bottom: 10px; border-bottom: 1px solid #ccc; font-size: 10.5pt; color: #555; }
  table { margin-bottom: 26px; border-collapse: collapse; }
  th { padding: 2px 18px 2px 0; text-align: left; font-weight: normal; vertical-align: top; color: #555; }
  h2 { margin: 0 0 12px; padding: 10px 0 4px; border-top: 1px solid #999; border-bottom: 1px solid #ccc; font-size: 13pt; }
  .campo { margin-bottom: 14px; }
  .rotulo { margin: 0 0 2px; font-size: 10.5pt; color: #555; }
  .sessao { margin-bottom: 14px; }
  .sessao + .sessao { padding-top: 14px; border-top: 1px solid #ccc; }
  h3 { margin: 0 0 4px; font-size: 12pt; break-after: avoid; }
  p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .campo p, .sessao p { text-align: justify; hyphens: auto; }
  .sessao .rotulo { margin-top: 8px; text-align: left; }
`;

// Cabeçalho, título e data de emissão, iguais nos dois PDFs.
function topoHtml(profissional, titulo) {
  return `
  <div class="cabecalho">
    <p class="nome">${esc(profissional.nome)}</p>
    ${profissional.crp ? `<p class="contato">${esc(formatarCrp(profissional.crp))}</p>` : ''}
    ${profissional.email ? `<p class="contato">${esc(profissional.email)}</p>` : ''}
  </div>
  <h1>${titulo}</h1>
  <p class="emissao">Emitido em ${new Date().toLocaleDateString('pt-BR')}</p>`;
}

function paginaHtml(corpo, estiloExtra = '') {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>${ESTILO}${estiloExtra}</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

// Bloco do responsável: só aparece se o paciente estiver marcado como menor de idade
// e tiver responsável cadastrado. No PDF do analista entra também a situação do termo assinado.
function responsavelHtml(paciente, responsavel, comTermo) {
  if (!paciente.menor_de_idade || !responsavel) return '';
  const linhas = [
    linha('Nome', responsavel.nome_completo),
    linha('Data de nascimento', dataBR(responsavel.data_nascimento)),
    linha('CPF', responsavel.cpf),
    linha('Endereço', responsavel.endereco),
    linha('Cidade/Estado', responsavel.cidade_estado),
    linha('Contato', responsavel.contato),
  ];
  if (comTermo) {
    const termo = responsavel.termo_nome ? `Anexado em ${dataBR(responsavel.termo_anexado_em)}` : 'Não anexado';
    linhas.push(linha('Termo de autorização', termo));
  }
  return `<h2>Responsável</h2><table>${linhas.join('')}</table>`;
}

function htmlPaciente(paciente, sessoes, responsavel, profissional) {
  const dados = [
    linha('Nome', paciente.nome_completo),
    linha('CPF', paciente.cpf),
    linha('Data de nascimento', dataBR(paciente.data_nascimento)),
    linha('Cidade/Estado', paciente.cidade_estado),
    linha('Início do atendimento', dataBR(paciente.data_inicio)),
  ].join('');

  const blocos = sessoes
    .map(
      (s) => `
      <section class="sessao">
        <h3>${esc(dataBR(s.data_hora))} — ${esc(s.titulo)}</h3>
        ${s.relato ? `<p>${esc(s.relato)}</p>` : ''}
      </section>`
    )
    .join('');

  return paginaHtml(`
  ${topoHtml(profissional, 'Prontuário de paciente')}
  <table>${dados}</table>
  ${responsavelHtml(paciente, responsavel, false)}
  <h2>Sessões</h2>
  ${blocos || '<p>Nenhuma sessão registrada.</p>'}`);
}

// Texto longo da ficha (queixa, adendos, anotações do caso) com o rótulo acima.
function campoTexto(rotulo, texto) {
  return `
  <div class="campo">
    <p class="rotulo">${rotulo}</p>
    <p>${esc(texto) || '—'}</p>
  </div>`;
}

function htmlAnalista(paciente, sessoes, valores, responsavel, profissional) {
  const atual = valores[0];
  const situacao =
    paciente.situacao === 'arquivado'
      ? `Arquivado em ${dataBR(paciente.arquivado_em)}`
      : 'Em andamento';

  const dados = [
    linha('Nome', paciente.nome_completo),
    linha('CPF', paciente.cpf),
    linha('Data de nascimento', dataBR(paciente.data_nascimento)),
    linha('Cidade/Estado', paciente.cidade_estado),
    linha('Início do atendimento', dataBR(paciente.data_inicio)),
    linha('Contato', paciente.celular),
    linha('Contato de emergência (nome)', paciente.contato_emergencia_nome),
    linha('Contato de emergência (número)', paciente.contato_emergencia_telefone),
    linha('Valor da sessão', atual ? `${formatarValor(atual.valor)} (a partir de ${dataBR(atual.a_partir_de)})` : ''),
    linha('Situação', situacao),
  ].join('');

  const historico = valores
    .map((v) => linha(`A partir de ${dataBR(v.a_partir_de)}`, formatarValor(v.valor)))
    .join('');

  const blocos = sessoes
    .map(
      (s) => `
      <section class="sessao">
        <h3>${esc(dataHoraBR(s.data_hora))} — ${esc(s.titulo)}</h3>
        ${s.relato ? `<p class="rotulo">Relato</p><p>${esc(s.relato)}</p>` : ''}
        ${s.anotacoes ? `<p class="rotulo">Anotações</p><p>${esc(s.anotacoes)}</p>` : ''}
      </section>`
    )
    .join('');

  return paginaHtml(`
  ${topoHtml(profissional, 'Prontuário completo')}
  <table>${dados}</table>
  ${responsavelHtml(paciente, responsavel, true)}
  ${campoTexto('Queixa inicial', paciente.queixa_inicial)}
  ${campoTexto('Adendos', paciente.adendos)}
  ${campoTexto('Anotações do caso', paciente.anotacoes_caso)}
  <h2>Histórico de valores</h2>
  ${historico ? `<table>${historico}</table>` : '<p>Nenhum valor registrado.</p>'}
  <h2>Sessões</h2>
  ${blocos || '<p>Nenhuma sessão registrada.</p>'}`);
}

// Pergunta onde salvar e imprime o HTML em PDF.
// Só o nome do arquivo é sugerido; a pasta inicial fica por conta do Windows.
// Devolve o caminho do arquivo, ou null se o usuário cancelar.
async function salvarPdf(janelaPai, nomeArquivo, html, titulo = 'Salvar prontuário em PDF') {
  const escolha = await dialog.showSaveDialog(janelaPai, {
    title: titulo,
    defaultPath: nomeArquivo,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (escolha.canceled) return null;

  // O HTML fica num arquivo temporário, apagado assim que a impressão termina (com ou sem erro).
  const arquivoTemporario = path.join(pastaTemporaria(), `${randomUUID()}.html`);

  // Janela escondida só para imprimir: sem JavaScript e isolada.
  const janela = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    fs.writeFileSync(arquivoTemporario, html, 'utf8');
    await janela.loadFile(arquivoTemporario);
    const pdf = await janela.webContents.printToPDF({
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%; font-size:9px; text-align:center; color:#666;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    try {
      fs.writeFileSync(escolha.filePath, pdf);
    } catch (e) {
      // Arquivo de mesmo nome aberto no leitor, ou pasta sem permissão de escrita.
      if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) {
        throw new Error('Não foi possível salvar o PDF. Se um arquivo com esse nome estiver aberto, feche-o e tente de novo');
      }
      throw e;
    }
  } finally {
    janela.destroy();
    apagarArquivo(arquivoTemporario);
  }
  return escolha.filePath;
}

// Os dois PDFs são montados com o que está salvo no banco.
function carregarPaciente(pacienteId) {
  const paciente = banco.obterPaciente(pacienteId);
  if (!paciente) throw new Error('Paciente não encontrado');
  const nomeLimpo = paciente.nome_completo.replace(/[\\/:*?"<>|]/g, '').trim();
  return { paciente, nomeLimpo };
}

async function gerarPdfPaciente(pacienteId, janelaPai) {
  const { paciente, nomeLimpo } = carregarPaciente(pacienteId);
  const profissional = lerProfissional();
  const sessoes = banco.listarSessoes(pacienteId, '');
  const responsavel = banco.obterResponsavel(pacienteId);
  const html = htmlPaciente(paciente, sessoes, responsavel, profissional);
  return salvarPdf(janelaPai, `Prontuário - ${nomeLimpo}.pdf`, html);
}

async function gerarPdfAnalista(pacienteId, janelaPai) {
  const { paciente, nomeLimpo } = carregarPaciente(pacienteId);
  const profissional = lerProfissional();
  const sessoes = banco.listarSessoes(pacienteId, '');
  const valores = banco.listarValores(pacienteId);
  const responsavel = banco.obterResponsavel(pacienteId);
  const html = htmlAnalista(paciente, sessoes, valores, responsavel, profissional);
  return salvarPdf(janelaPai, `Prontuário completo - ${nomeLimpo}.pdf`, html);
}

// Termo de autorização para acompanhamento de menores. Sai com o que já está cadastrado;
// o que faltar fica como linha em branco para preencher à mão. Cidade e data de assinatura
// ficam sempre em branco, porque são preenchidas no dia em que o responsável assina.

const ESTILO_TERMO = `
  .termo h1 { margin-bottom: 26px; font-size: 14pt; text-align: center; }
  .termo p { margin-bottom: 16px; text-align: justify; white-space: normal; line-height: 1.8; }
  .preenchido { font-weight: bold; }
  .lacuna { display: inline-block; height: 1em; border-bottom: 1px solid #111; }
  .local { display: flex; justify-content: center; gap: 12mm; margin-top: 34px; }
  .campo-local { text-align: center; font-family: 'Times New Roman', Times, serif; }
  .campo-local .traco { height: 24px; border-bottom: 1px solid #111; }
  .campo-local .traco.data { display: grid; grid-template-columns: 1fr 1fr 1fr; }
  .campo-local .traco.data span { align-self: end; text-align: right; }
  .campo-local .legenda { margin-top: 3px; font-size: 12pt; color: #111; line-height: 1.4; }
  .assinatura { margin-top: 16px; text-align: center; }
  .assinatura .linha { width: 110mm; margin: 44px auto 4px; border-top: 1px solid #111; }
  .assinatura p { margin: 0; text-align: center; line-height: 1.4; }
`;

// Mostra o valor em negrito; sem valor, deixa uma linha em branco com a largura (em mm) pedida.
function lacuna(valor, largura) {
  const texto = String(valor ?? '').trim();
  return texto
    ? `<span class="preenchido">${esc(texto)}</span>`
    : `<span class="lacuna" style="min-width:${largura}mm"></span>`;
}

function htmlTermo(paciente, responsavel, profissional) {
  const r = responsavel || {};
  const crp = profissional.crp ? formatarCrp(profissional.crp) : '';

  // Endereço e cidade/estado são campos separados no cadastro. Se só um deles estiver
  // preenchido, o outro vira uma linha em branco para preencher à mão; se nenhum
  // estiver, sai uma linha só para o domicílio inteiro.
  const enderecoTexto = (r.endereco || '').trim();
  const cidadeEstado = (r.cidade_estado || '').trim();
  let domicilio;
  if (enderecoTexto && cidadeEstado) {
    domicilio = `<span class="preenchido">${esc(`${enderecoTexto}, ${cidadeEstado}`)}</span>`;
  } else if (enderecoTexto) {
    domicilio = `<span class="preenchido">${esc(enderecoTexto)}</span>, ${lacuna('', 40)}`;
  } else if (cidadeEstado) {
    domicilio = `${lacuna('', 70)}, <span class="preenchido">${esc(cidadeEstado)}</span>`;
  } else {
    domicilio = lacuna('', 110);
  }

  return paginaHtml(
    `
  <div class="termo">
    <h1>AUTORIZAÇÃO PARA ACOMPANHAMENTO PSICOTERAPÊUTICO DE CRIANÇAS E ADOLESCENTES (MENORES DE 18 ANOS)</h1>

    <p>Eu, ${lacuna(r.nome_completo, 90)}, data de nascimento ${lacuna(dataBR(r.data_nascimento), 28)}, portador(a) do documento de identificação (RG ou CPF) nº ${lacuna(r.cpf, 40)}, domiciliado(a) à ${domicilio}, responsável legal pela(o) criança/adolescente ${lacuna(paciente.nome_completo, 90)}, data de nascimento ${lacuna(dataBR(paciente.data_nascimento), 28)}, portador(a) do documento de identificação (RG ou CPF) nº ${lacuna(paciente.cpf, 40)}, autorizo o(a) profissional ${lacuna(profissional.nome, 70)}, ${lacuna(crp, 30)}, a realizar o acompanhamento psicoterapêutico da criança/adolescente acima identificado(a), bem como os encaminhamentos cabíveis.</p>

    <p>Todas as intervenções e documentos produzidos serão regidos pelos dispositivos legais vigentes, em especial pelo disposto na Resolução CFP nº 10, de 2005 (Código de Ética Profissional do Psicólogo), bem como pelas demais Resoluções da Psicologia relacionadas ao exercício da profissão.</p>

    <p>Em especial, serão garantidos à criança ou adolescente o sigilo das informações e a preservação da dignidade e da intimidade durante a prestação dos serviços de que trata esta autorização.</p>

    <div class="local">
      <div class="campo-local" style="width:75mm">
        <div class="traco"></div>
        <div class="legenda">Cidade</div>
      </div>
      <div class="campo-local" style="width:48mm">
        <div class="traco data"><span>/</span><span>/</span><span></span></div>
        <div class="legenda">Data</div>
      </div>
    </div>
    <div class="assinatura">
      <div class="linha"></div>
      <p>Responsável Legal pela Criança ou Adolescente</p>
      ${r.nome_completo ? `<p>${esc(r.nome_completo)}</p>` : ''}
    </div>

    <div class="assinatura">
      <div class="linha"></div>
      <p>${esc(profissional.nome)}${crp ? ` — ${esc(crp)}` : ''}</p>
    </div>
  </div>`,
    ESTILO_TERMO
  );
}

async function gerarPdfTermo(pacienteId, janelaPai) {
  const { paciente, nomeLimpo } = carregarPaciente(pacienteId);
  const profissional = lerProfissional();
  const responsavel = banco.obterResponsavel(pacienteId);
  const html = htmlTermo(paciente, responsavel, profissional);
  return salvarPdf(janelaPai, `Termo de autorização - ${nomeLimpo}.pdf`, html, 'Salvar termo em PDF');
}

module.exports = { gerarPdfPaciente, gerarPdfAnalista, gerarPdfTermo };