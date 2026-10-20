<script setup>
// Perfil no topo da lateral: foto, nome e um menu suspenso com "Configurações".
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({ profissional: Object });
const emit = defineEmits(['configuracoes']);

const aberto = ref(false);
const raiz = ref(null);

const inicial = computed(() => props.profissional.nome.trim().charAt(0).toUpperCase() || '?');

// Mostra "CRP" antes do número, mesmo que tenha sido digitado só o número.
const crp = computed(() => {
  const texto = props.profissional.crp.trim();
  if (!texto) return '';
  return /^crp/i.test(texto) ? texto : `CRP ${texto}`;
});

// Clicar fora do perfil fecha o menu.
function aoClicarFora(evento) {
  if (raiz.value && !raiz.value.contains(evento.target)) aberto.value = false;
}

function abrirConfiguracoes() {
  aberto.value = false;
  emit('configuracoes');
}

onMounted(() => document.addEventListener('click', aoClicarFora));
onBeforeUnmount(() => document.removeEventListener('click', aoClicarFora));
</script>

<template>
  <div ref="raiz" class="perfil">
    <button type="button" class="perfil-botao" :aria-expanded="aberto" @click="aberto = !aberto">
      <span class="avatar">
        <img v-if="profissional.foto" :src="profissional.foto" alt="" />
        <template v-else>{{ inicial }}</template>
      </span>
      <span class="perfil-texto">
        <span class="perfil-nome">{{ profissional.nome || 'Perfil' }}</span>
        <span v-if="crp" class="perfil-crp">{{ crp }}</span>
      </span>
    </button>
    <div v-if="aberto" class="perfil-menu">
      <button type="button" @click="abrirConfiguracoes">Configurações</button>
    </div>
  </div>
</template>