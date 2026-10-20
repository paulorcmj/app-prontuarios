<script setup>
// Porta de entrada da tela: enquanto o banco estiver trancado mostra a tela de acesso,
// e só depois do desbloqueio monta o app de verdade.
import { ref, onMounted } from 'vue';
import TelaAcesso from './TelaAcesso.vue';
import Principal from './Principal.vue';

// "verificado" evita piscar a tela de senha antes de saber o estado real.
const verificado = ref(false);
const liberado = ref(false);

// Se a janela for recarregada com o banco já aberto, o estado volta como "liberado".
onMounted(async () => {
  liberado.value = (await window.api.acesso.estado()) === 'liberado';
  verificado.value = true;
});
</script>

<template>
  <template v-if="verificado">
    <Principal v-if="liberado" />
    <TelaAcesso v-else @liberado="liberado = true" />
  </template>
</template>