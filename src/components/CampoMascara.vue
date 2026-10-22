<script setup>
// Campo de texto com máscara (CPF, telefone, CRP e as datas). O formato aparece sempre inteiro, com os
// separadores no lugar e "_" nas posições vazias. Só entram números. Um clique seleciona um dígito e o
// que for digitado entra no lugar dele; depois a seleção passa para a posição seguinte. Arrastar o mouse
// seleciona um trecho, como em qualquer campo.
// Quando o tipo tem formatos de tamanhos diferentes (telefone, CRP), o formato é escolhido pela
// quantidade de posições usadas e o campo nunca mostra posições além do necessário.
// O valor guardado é o texto formatado até o último dígito, com "_" nas posições apagadas no meio
// (por exemplo "123.4_5"). Com a prop "tipo", o campo também mostra o aviso de incompleto ou inválido;
// o formulário que o usa confere o mesmo texto com erroMascara() antes de salvar.
import { computed, inject, nextTick, ref } from 'vue';
import { MASCARAS, mascaraPara, posicoes, quantos, erroMascara } from '../utilitarios.js';

defineOptions({ inheritAttrs: false });
const props = defineProps({
  mascara: { type: [String, Array], default: null },
  tipo: { type: String, default: '' },
});
const modelo = defineModel({ type: String, default: '' });
const campo = ref(null);

// O formulário avisa que tentou salvar; a partir daí o aviso de incompleto aparece assim que o campo perde o foco.
const tentou = inject('tentouSalvar', ref(false));
const focado = ref(false);
// Enquanto o botão do mouse está apertado, o navegador cuida da seleção e o foco não mexe nela.
let pressionando = false;

const mascaras = computed(() => {
  const m = props.mascara ?? MASCARAS[props.tipo];
  return typeof m === 'function' || Array.isArray(m) ? m : [m];
});
// Formato dado por função (CRP): o limite é o que a própria função devolve para um número enorme.
const maximo = computed(() =>
  typeof mascaras.value === 'function'
    ? quantos(mascaras.value(1000))
    : quantos(mascaras.value[mascaras.value.length - 1])
);
// Posições usadas: cada item é um dígito ou '' (posição apagada).
const atuais = computed(() => posicoes(modelo.value).slice(0, maximo.value));
const mascaraAtual = computed(() => mascaraPara(mascaras.value, atuais.value.length));
const exibido = computed(() => montar(mascaraAtual.value, atuais.value, true));
const indicesAtuais = computed(() => indices(mascaraAtual.value));

const erro = computed(() => (props.tipo ? erroMascara(props.tipo, modelo.value) : ''));
const temBuraco = computed(() => atuais.value.includes(''));
// Inválido (completo, mas errado) aparece na hora. Incompleto só aparece com um buraco no meio do campo,
// ou depois de tentar salvar e sair do campo: quem ainda está digitando não é avisado.
const mostrarErro = computed(() => {
  if (!erro.value) return false;
  if (erro.value.endsWith('inválido')) return true;
  return temBuraco.value || (tentou.value && !focado.value);
});

// Índice, dentro da máscara, de cada posição de dígito.
function indices(mascara) {
  const resultado = [];
  [...mascara].forEach((c, i) => {
    if (c === '#') resultado.push(i);
  });
  return resultado;
}

// Monta o texto. Com "completo", as posições vazias viram "_"; sem ele, o texto para na última usada.
function montar(mascara, lista, completo) {
  let usados = 0;
  let saida = '';
  for (const c of mascara) {
    if (c === '#') {
      if (usados < lista.length) saida += lista[usados++] || '_';
      else if (completo) saida += '_';
      else break;
    } else if (completo || usados < lista.length) {
      saida += c;
    } else {
      break;
    }
  }
  return saida;
}

function guardar(lista) {
  const novas = [...lista];
  while (novas.length && novas[novas.length - 1] === '') novas.pop();
  modelo.value = montar(mascaraPara(mascaras.value, novas.length), novas, false);
}

// Seleciona a posição k. Depois da última posição usada, o cursor vai para o fim do campo.
// Posições além da primeira livre não são selecionáveis: o dígito digitado sempre entra na primeira livre.
function selecionar(k) {
  const el = campo.value;
  if (!el || document.activeElement !== el) return;
  const alvo = Math.min(k, atuais.value.length);
  const idx = indicesAtuais.value;
  if (alvo < idx.length) el.setSelectionRange(idx[alvo], idx[alvo] + 1);
  else el.setSelectionRange(el.value.length, el.value.length);
}

// Quais posições a seleção do campo cobre: de "de" até "ate" (sem incluir). Selecionar uma posição
// livre (depois do último dígito) vale como cursor parado no fim.
function faixa(el) {
  const idx = indicesAtuais.value;
  const n = atuais.value.length;
  const primeiro = idx.findIndex((i) => i >= el.selectionStart);
  const de = primeiro === -1 ? idx.length : primeiro;
  const ate = idx.filter((i) => i < el.selectionEnd).length;
  if (de >= n) return { de: n, ate: n };
  return { de, ate };
}

function digitar(tecla, el) {
  let novas = [...atuais.value];
  const { de, ate } = faixa(el);
  // Com tudo selecionado, o dígito recomeça o campo; com vários selecionados, eles são esvaziados.
  if (de === 0 && ate >= novas.length && novas.length > 0) novas = [];
  else for (let k = de + 1; k < ate && k < novas.length; k++) novas[k] = '';
  const p = Math.min(de, novas.length);
  if (p >= maximo.value) return;
  novas[p] = tecla;
  guardar(novas);
  nextTick(() => selecionar(p + 1));
}

function apagar(tecla, el) {
  let novas = [...atuais.value];
  const { de, ate } = faixa(el);
  let foco = de;
  if (ate > de) {
    // Com seleção, cada posição vira "_"; com tudo selecionado, o campo esvazia.
    if (de === 0 && ate >= novas.length) novas = [];
    else for (let k = de; k < ate && k < novas.length; k++) novas[k] = '';
  } else {
    // Sem seleção: Backspace apaga a posição anterior ao cursor e Delete, a seguinte.
    const k = tecla === 'Backspace' ? Math.min(de, novas.length) - 1 : de;
    if (k < 0 || k >= novas.length) return;
    novas[k] = '';
    foco = k;
  }
  guardar(novas);
  nextTick(() => selecionar(foco));
}

function aoPressionar(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    // O desfazer nativo não conhece a máscara e bagunçaria o texto.
    if (e.ctrlKey && /^[zy]$/i.test(e.key)) e.preventDefault();
    return;
  }
  const el = e.target;

  if (/^\d$/.test(e.key)) {
    e.preventDefault();
    digitar(e.key, el);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    apagar(e.key, el);
    return;
  }
  // As setas andam de posição em posição, pulando os separadores.
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey) {
    e.preventDefault();
    const { de, ate } = faixa(el);
    const alvo = e.key === 'ArrowLeft' ? de - 1 : ate > de ? ate : de;
    selecionar(Math.max(0, alvo));
    return;
  }
  // Letras e símbolos são ignorados; Tab, Enter e as demais teclas (com nome) passam.
  if (e.key.length === 1) e.preventDefault();
}

// Mede o texto com a fonte do próprio campo para descobrir em qual caractere o mouse clicou.
function caractereDoClique(el, evento) {
  const estilo = getComputedStyle(el);
  const contexto = document.createElement('canvas').getContext('2d');
  contexto.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  const caixa = el.getBoundingClientRect();
  const x =
    evento.clientX - caixa.left - parseFloat(estilo.borderLeftWidth) - parseFloat(estilo.paddingLeft) + el.scrollLeft;
  let acumulado = 0;
  for (let i = 0; i < el.value.length; i++) {
    const largura = contexto.measureText(el.value[i]).width;
    if (x < acumulado + largura) return { i, esquerda: x - acumulado < largura / 2 };
    acumulado += largura;
  }
  return { i: el.value.length, esquerda: false };
}

// O mouse é do navegador: clique, arraste, duplo clique e Shift+clique funcionam como em qualquer campo.
// Só marcamos que o botão está apertado, para o foco não mexer na seleção no meio do arraste.
function aoPressionarMouse(e) {
  if (e.button !== 0) return;
  pressionando = true;
  window.addEventListener('mouseup', aoSoltarMouse, { once: true });
}

// Ao soltar o botão sem nenhum trecho selecionado (um clique simples), o clique vira a seleção do dígito
// clicado. Num separador, vale o dígito mais próximo do clique. Com trecho selecionado, não mexe.
function aoSoltarMouse(e) {
  pressionando = false;
  const el = campo.value;
  if (!el || e.target !== el || e.shiftKey || document.activeElement !== el) return;
  if (el.selectionStart !== el.selectionEnd) return;

  const idx = indicesAtuais.value;
  const { i, esquerda } = caractereDoClique(el, e);
  let alvo;
  if (i >= el.value.length) {
    alvo = atuais.value.length;
  } else if (idx.includes(i)) {
    alvo = idx.indexOf(i);
  } else {
    const depois = idx.findIndex((j) => j > i);
    const antes = (depois === -1 ? idx.length : depois) - 1;
    const preferido = esquerda ? antes : depois;
    alvo = preferido >= 0 ? preferido : esquerda ? depois : antes;
  }
  selecionar(alvo);
}

function aoColar(e) {
  e.preventDefault();
  const colado = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
  if (!colado) return;
  let novas = [...atuais.value];
  const { de, ate } = faixa(e.target);
  // Um número completo, ou tudo selecionado, substitui o que havia; senão o texto entra a partir do cursor.
  if ((de === 0 && ate >= novas.length && novas.length > 0) || colado.length >= maximo.value) novas = [];
  const inicio = Math.min(de, novas.length);
  [...colado].forEach((digito, i) => {
    if (inicio + i < maximo.value) novas[inicio + i] = digito;
  });
  guardar(novas);
  nextTick(() => selecionar(inicio + colado.length));
}

function aoCortar(e) {
  const el = e.target;
  e.clipboardData.setData('text/plain', el.value.slice(el.selectionStart, el.selectionEnd));
  e.preventDefault();
  apagar('Delete', el);
}

// Alterações que escaparam do teclado (arrastar texto para dentro do campo): refaz a partir dos dígitos.
function aoAlterar(e) {
  guardar([...e.target.value].filter((c) => /\d/.test(c)).slice(0, maximo.value));
  nextTick(() => {
    if (campo.value) campo.value.value = exibido.value;
  });
}

// Entrando com Tab o navegador seleciona o campo todo; se há posição livre ou apagada, a seleção vai para ela.
function aoFocar() {
  focado.value = true;
  if (pressionando) return;
  setTimeout(() => {
    const buraco = atuais.value.indexOf('');
    const alvo = buraco !== -1 ? buraco : atuais.value.length;
    if (alvo < indicesAtuais.value.length) selecionar(alvo);
  }, 0);
}
</script>

<template>
  <input
    v-bind="$attrs"
    ref="campo"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    :class="{ vazia: !atuais.length, invalida: mostrarErro }"
    :value="exibido"
    @keydown="aoPressionar"
    @mousedown="aoPressionarMouse"
    @paste="aoColar"
    @cut="aoCortar"
    @input="aoAlterar"
    @focus="aoFocar"
    @blur="focado = false"
  />
  <span v-if="mostrarErro" class="erro">{{ erro }}</span>
</template>

<style scoped>
/* Sem nada digitado, o formato aparece apagado, como o texto de sugestão dos outros campos. */
.vazia,
.vazia:disabled {
  color: var(--texto-suave);
  -webkit-text-fill-color: var(--texto-suave);
}

/* Campo incompleto ou inválido: a borda fica vermelha, mesmo com o foco. */
.invalida {
  border-color: var(--perigo);
}
</style>