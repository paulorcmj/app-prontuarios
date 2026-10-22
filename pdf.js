// Gera os PDFs do prontuário com a impressão do próprio Electron.
// O PDF do paciente leva só a identificação e o relato das sessões; o do analista
// leva tudo o que está no prontuário, inclusive adendos e anotações.
// Se o paciente for menor de idade, os dois levam também os dados do responsável.

const fs = require('fs');
const { BrowserWindow, dialog } = require('electron');
const banco = require('./banco');

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

function paginaHtml(corpo) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>${ESTILO}</style>
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
    linha('Celular', paciente.celular),
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
async function salvarPdf(janelaPai, nomeArquivo, html) {
  const escolha = await dialog.showSaveDialog(janelaPai, {
    title: 'Salvar prontuário em PDF',
    defaultPath: nomeArquivo,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (escolha.canceled) return null;

  // Janela escondida só para imprimir: sem JavaScript e isolada.
  const janela = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await janela.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await janela.webContents.printToPDF({
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%; font-size:9px; text-align:center; color:#666;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    fs.writeFileSync(escolha.filePath, pdf);
  } finally {
    janela.destroy();
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

module.exports = { gerarPdfPaciente, gerarPdfAnalista };