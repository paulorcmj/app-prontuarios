// Gera o PDF do paciente com a impressão do próprio Electron.
// O PDF leva só os dados de identificação e o relato das sessões:
// anotações, adendos, valor, queixa e contato de emergência ficam de fora.

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog } = require('electron');
const banco = require('./banco');

// Nome, CRP e e-mail vêm da tela "Meus dados" (guardados no banco).
function lerProfissional() {
  const profissional = banco.obterProfissional();
  if (!profissional.nome.trim()) {
    throw new Error('Preencha seus dados em "Meus dados" antes de gerar o PDF');
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

function montarHtml(paciente, sessoes, profissional) {
  const dados = [
    ['Nome', paciente.nome_completo],
    ['CPF', paciente.cpf],
    ['Data de nascimento', dataBR(paciente.data_nascimento)],
    ['Cidade e estado', paciente.cidade],
    ['Início do atendimento', dataBR(paciente.data_inicio)],
  ]
    .map(([rotulo, valor]) => `<tr><th>${rotulo}</th><td>${esc(valor) || '—'}</td></tr>`)
    .join('');

  const blocos = sessoes
    .map(
      (s) => `
      <section class="sessao">
        <h3>${esc(dataBR(s.data_hora))} — ${esc(s.titulo)}</h3>
        ${s.relato ? `<p>${esc(s.relato)}</p>` : ''}
      </section>`
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 20mm 22mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.45; color: #111; }
  .cabecalho { margin-bottom: 22px; padding-bottom: 10px; border-bottom: 1px solid #999; }
  .cabecalho .nome { font-size: 14pt; font-weight: bold; }
  .cabecalho p { margin: 0; }
  h1 { margin: 0 0 2px; font-size: 18pt; }
  .emissao { margin: 0 0 18px; font-size: 10.5pt; color: #555; }
  table { margin-bottom: 26px; border-collapse: collapse; }
  th { padding: 2px 18px 2px 0; text-align: left; font-weight: normal; color: #555; }
  h2 { margin: 0 0 12px; padding-bottom: 4px; border-bottom: 1px solid #ccc; font-size: 13pt; }
  .sessao { margin-bottom: 14px; }
  h3 { margin: 0 0 4px; font-size: 12pt; break-after: avoid; }
  p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body>
  <div class="cabecalho">
    <p class="nome">${esc(profissional.nome)}</p>
    ${profissional.crp ? `<p>${esc(profissional.crp)}</p>` : ''}
    ${profissional.email ? `<p>${esc(profissional.email)}</p>` : ''}
  </div>
  <h1>Prontuário</h1>
  <p class="emissao">Emitido em ${new Date().toLocaleDateString('pt-BR')}</p>
  <table>${dados}</table>
  <h2>Sessões</h2>
  ${blocos || '<p>Nenhuma sessão registrada.</p>'}
</body>
</html>`;
}

// Pergunta onde salvar e gera o PDF a partir do que está no banco.
// Devolve o caminho do arquivo, ou null se o usuário cancelar.
async function gerarPdfPaciente(pacienteId, janelaPai) {
  const paciente = banco.obterPaciente(pacienteId);
  if (!paciente) throw new Error('Paciente não encontrado');
  const profissional = lerProfissional();
  const sessoes = banco.listarSessoes(pacienteId, '');

  const nomeLimpo = paciente.nome_completo.replace(/[\\/:*?"<>|]/g, '').trim();
  const escolha = await dialog.showSaveDialog(janelaPai, {
    title: 'Salvar prontuário em PDF',
    defaultPath: path.join(app.getPath('documents'), `Prontuário - ${nomeLimpo}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (escolha.canceled) return null;

  // Janela escondida só para imprimir: sem JavaScript e isolada.
  const janela = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    const html = montarHtml(paciente, sessoes, profissional);
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

module.exports = { gerarPdfPaciente };