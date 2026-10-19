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