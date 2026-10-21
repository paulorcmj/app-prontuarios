<script setup>
// Campo de texto com máscara fixa (CPF, celular). O formato aparece sempre inteiro, com os
// separadores no lugar e "_" nos espaços ainda vazios, como no campo de data do navegador.
// Só entram números, sempre preenchidos da esquerda para a direita. O valor guardado é o texto
// formatado, sem os "_" (por exemplo "123.45" enquanto o CPF está pela metade).
import { computed, nextTick, ref } from 'vue';

const props = defineProps({ mascara: { type: String, required: true } });
const modelo = defineModel({ type: String, default: '' });
const campo = ref(null);

const total = computed(() => [...props.mascara].filter((c) => c === '#').length);
const digitos = computed(() => (modelo.value ?? '').replace(/\D/g, '').slice(0, total.value));

// Monta o texto a partir dos dígitos. Com "completo", os espaços vazios viram "_";
// sem ele, o texto para no último dígito digitado.
function preencher(digs, completo) {
  let usados = 0;
  let saida = '';
  for (const c of props.mascara) {
    if (c === '#') {
      if (usados < digs.length) saida += digs[usados++];
      else if (completo) saida += '_';
      else break;
    } else if (completo || usados < digs.length) {
      saida += c;
    } else {
      break;
    }
  }
  return saida;
}

const exibido = computed(() => preencher(digitos.value, true));

// Posição do próximo espaço livre, onde o cursor fica.
const posicaoCursor = computed(() => {
  let achados = 0;
  for (let i = 0; i < props.mascara.length; i++) {
    if (props.mascara[i] !== '#') continue;
    if (achados === digitos.value.length) return i;
    achados++;
  }
  return props.mascara.length;
});

function posicionar() {
  const el = campo.value;
  if (el && document.activeElement === el) el.setSelectionRange(posicaoCursor.value, posicaoCursor.value);
}

function atualizar(digs) {
  modelo.value = preencher(digs, false);
  nextTick(posicionar);
}

function selecionouTudo(el) {
  return el.value.length > 0 && el.selectionStart === 0 && el.selectionEnd === el.value.length;
}

function aoPressionar(e) {
  // Atalhos (copiar, colar, selecionar tudo) seguem o comportamento normal.
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (/^\d$/.test(e.key)) {
    e.preventDefault();
    const base = selecionouTudo(e.target) ? '' : digitos.value;
    if (base.length < total.value) atualizar(base + e.key);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    atualizar(selecionouTudo(e.target) ? '' : digitos.value.slice(0, -1));
    return;
  }
  // Letras e símbolos são ignorados; Tab, setas e Enter (tecla com nome) passam.
  if (e.key.length === 1) e.preventDefault();
}

function aoColar(e) {
  e.preventDefault();
  const colado = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
  if (!colado) return;
  // Um número completo colado substitui o que havia; um pedaço é acrescentado ao final.
  const substitui = selecionouTudo(e.target) || colado.length >= total.value;
  atualizar((substitui ? colado : digitos.value + colado).slice(0, total.value));
}

// Alterações que escaparam do teclado (recortar, arrastar texto): refaz a partir do que sobrou.
function aoAlterar(e) {
  const digs = e.target.value.replace(/\D/g, '').slice(0, total.value);
  e.target.value = preencher(digs, true);
  atualizar(digs);
}

// Com Tab o navegador seleciona o campo todo; o cursor volta para o próximo espaço livre.
function aoFocar() {
  setTimeout(posicionar, 0);
}

function aoSoltarMouse(e) {
  if (e.target.selectionStart === e.target.selectionEnd) posicionar();
}
</script>

<template>
  <input
    ref="campo"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    :class="{ vazia: !digitos.length }"
    :value="exibido"
    @keydown="aoPressionar"
    @paste="aoColar"
    @input="aoAlterar"
    @focus="aoFocar"
    @mouseup="aoSoltarMouse"
  />
</template>

<style scoped>
/* Sem nada digitado, o formato aparece apagado, como o texto de sugestão dos outros campos. */
.vazia,
.vazia:disabled {
  color: var(--texto-suave);
  -webkit-text-fill-color: var(--texto-suave);
}
</style>