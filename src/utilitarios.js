// Funções de formatação e conversão usadas pelos componentes.

const pad = (n) => String(n).padStart(2, '0');

// Data e hora locais no formato do input datetime-local: AAAA-MM-DDTHH:MM
export function agoraLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Data local no formato AAAA-MM-DD
export function hoje() {
  return agoraLocal().slice(0, 10);
}

// AAAA-MM-DD (com ou sem hora) para DD/MM/AAAA. Quebra o texto em vez de usar Date,
// porque new Date('2026-03-01') é lido como UTC e mostraria o dia anterior no Brasil.
export function dataBR(texto) {
  const [ano, mes, dia] = texto.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function dataHoraBR(texto) {
  return `${dataBR(texto)} ${texto.slice(11, 16)}`;
}

export function reais(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Centavos no formato do campo de valor ("1.500,00"), que reaisParaCentavos aceita de volta.
export function centavosParaCampo(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Converte "1.500,00", "150,5" ou "150" em centavos. Devolve null se o formato não for reconhecido.
// "150.50" é recusado de propósito: o ponto pode ser milhar ou decimal, e adivinhar erra o valor.
export function reaisParaCentavos(texto) {
  const t = texto.trim();
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t.replace(/\./g, '').replace(',', '.')) * 100);
}

// Tira o prefixo que o Electron põe nos erros que chegam pelo IPC.
export function mensagemDeErro(e) {
  return e.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, '');
}

// Confere uma data ("AAAA-MM-DD") ou data e hora ("AAAA-MM-DDTHH:MM") com as regras do próprio Chromium
// (o motor do Electron): o valor é colocado num campo de data nativo que nunca entra na tela, e o campo
// devolve vazio se a data ou a hora não existirem. Os campos são criados na primeira chamada, para este
// arquivo continuar carregando em contextos sem document.
let verificadores = null;

export function isoValido(iso, comHora = false) {
  if (!verificadores) {
    verificadores = { data: document.createElement('input'), dataHora: document.createElement('input') };
    verificadores.data.type = 'date';
    verificadores.dataHora.type = 'datetime-local';
  }
  const campo = comHora ? verificadores.dataHora : verificadores.data;
  campo.value = iso;
  return campo.value !== '';
}

// ---- Campos com máscara ----

// Formatos de cada tipo de campo. Uma lista vai do menor formato para o maior: o campo usa o menor em que
// cabem as posições já usadas (telefone fixo, com 8 dígitos, e celular, com 9, dividem o campo). Uma função
// recebe a quantidade de posições usadas e devolve o formato: o CRP mostra 5 posições depois da barra e
// cresce conforme o número pede, até 8.
export const MASCARAS = {
  cpf: ['###.###.###-##'],
  telefone: ['(##) ####-####', '(##) #####-####'],
  crp: (usadas) => `##/${'#'.repeat(Math.min(8, Math.max(5, usadas - 2)))}`,
};

// Quantidade mínima de dígitos para o campo estar completo.
const MINIMOS = { cpf: 11, telefone: 10, crp: 3 };

const NOMES_MASCARA = { cpf: 'CPF', telefone: 'Telefone', crp: 'CRP' };

// Quantidade de posições de dígito de uma máscara.
export const quantos = (mascara) => [...mascara].filter((c) => c === '#').length;

// A menor máscara em que cabem as posições já usadas.
export function mascaraPara(mascaras, usadas) {
  if (typeof mascaras === 'function') return mascaras(usadas);
  return mascaras.find((m) => quantos(m) >= usadas) ?? mascaras[mascaras.length - 1];
}

// Posições de um texto com máscara: cada dígito é uma posição, e "_" é uma posição vazia ('').
// Os separadores ("/", ".", "-", parênteses e espaço) não contam.
export function posicoes(texto) {
  return [...(texto ?? '')].filter((c) => /[\d_]/.test(c)).map((c) => (c === '_' ? '' : c));
}

// Confere os dois dígitos verificadores e recusa sequências repetidas (111.111.111-11).
export function cpfValido(digitos) {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(digitos[i]) * (tamanho + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(digitos[tamanho])) return false;
  }
  return true;
}

// Mensagem de erro de um campo com máscara, ou '' se está certo. Campo vazio não é erro.
export function erroMascara(tipo, texto) {
  const pos = posicoes(texto);
  if (!pos.some(Boolean)) return '';
  if (pos.length < MINIMOS[tipo] || pos.includes('')) return `${NOMES_MASCARA[tipo]} incompleto`;
  if (tipo === 'cpf' && !cpfValido(pos.join(''))) return 'CPF inválido';
  return '';
}

// Situação de uma data (ou data e hora) guardada num campo de data: '' se está certa ou vazia,
// 'incompleta' se faltam dígitos e 'invalida' se está completa mas não existe.
// O valor certo é "AAAA-MM-DD"; o que ainda não virou data fica como o texto digitado.
export function statusData(valor, comHora = false) {
  if (!valor) return '';
  if (isoValido(valor, comHora)) return '';
  const pos = posicoes(valor);
  const completo = pos.length === (comHora ? 12 : 8) && !pos.includes('');
  return completo ? 'invalida' : 'incompleta';
}