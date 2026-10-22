<script setup>
// Caixa de busca com o botão de ordenar embutido e o menu de ordenação.
// A classe do elemento raiz vem de quem usa (busca-linha ou busca-sessoes).
import { ref, onMounted, onBeforeUnmount } from 'vue';

defineProps({
  ordens: Array,
  placeholder: String,
  rotuloBusca: String,
  rotuloOrdenar: String,
  popup: Boolean,
});
const busca = defineModel('busca');
const ordem = defineModel('ordem');

// O menu fecha ao escolher, ao clicar fora e com Esc.
const aberto = ref(false);
const raiz = ref(null);

function escolher(valor) {
  ordem.value = valor;
  aberto.value = false;
}

function aoClicarFora(evento) {
  if (aberto.value && !raiz.value?.contains(evento.target)) aberto.value = false;
}

function aoPressionarTecla(evento) {
  if (evento.key === 'Escape') aberto.value = false;
}

onMounted(() => {
  document.addEventListener('click', aoClicarFora);
  document.addEventListener('keydown', aoPressionarTecla);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', aoClicarFora);
  document.removeEventListener('keydown', aoPressionarTecla);
});
</script>

<template>
  <div ref="raiz">
    <input v-model="busca" type="search" :aria-label="rotuloBusca" :placeholder="placeholder" />
    <button v-if="busca" type="button" class="limpar-busca" title="Limpar busca" aria-label="Limpar busca" @click="busca = ''">
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M2 2l8 8M10 2l-8 8" />
      </svg>
    </button>
    <button
      type="button"
      class="botao-ordenar"
      :title="rotuloOrdenar"
      :aria-label="rotuloOrdenar"
      :aria-haspopup="popup ? 'menu' : undefined"
      :aria-expanded="aberto"
      @click="aberto = !aberto"
    >
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <path d="M3 5.5h14M3 10h10M3 14.5h6" />
      </svg>
    </button>
    <div v-if="aberto" class="ordem-menu">
      <button
        v-for="o in ordens"
        :key="o.valor"
        type="button"
        :class="{ escolhida: o.valor === ordem }"
        @click="escolher(o.valor)"
      >
        <span>{{ o.rotulo }}</span>
        <svg v-if="o.valor === ordem" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </button>
    </div>
  </div>
</template>