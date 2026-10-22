// Preferências de tela guardadas no localStorage.
// A ordenação vale para o app inteiro; as seções abertas ou fechadas valem por paciente.

const CHAVE_SECOES = 'secoes-por-paciente';

function lerSecoes() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SECOES)) ?? {};
  } catch {
    return {};
  }
}

// Devolve se a seção estava aberta para este paciente; sem registro, vale o padrão.
export function lerSecao(pacienteId, secao, padrao) {
  const valor = lerSecoes()[pacienteId]?.[secao];
  return typeof valor === 'boolean' ? valor : padrao;
}

export function guardarSecao(pacienteId, secao, aberta) {
  const todas = lerSecoes();
  todas[pacienteId] = { ...todas[pacienteId], [secao]: aberta };
  try {
    localStorage.setItem(CHAVE_SECOES, JSON.stringify(todas));
  } catch {
    // sem armazenamento, o estado só vale até fechar o app
  }
}

// Ao excluir um paciente, o que foi guardado sobre ele também vai embora.
export function esquecerPaciente(pacienteId) {
  const todas = lerSecoes();
  delete todas[pacienteId];
  try {
    localStorage.setItem(CHAVE_SECOES, JSON.stringify(todas));
  } catch {
    // nada a fazer
  }
}

// Ordem escolhida num menu de ordenação; só aceita valores da lista.
export function lerOrdem(chave, validas, padrao) {
  try {
    const salva = localStorage.getItem(chave);
    return validas.includes(salva) ? salva : padrao;
  } catch {
    return padrao;
  }
}

export function guardarOrdem(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento, a ordem só vale até fechar o app
  }
}