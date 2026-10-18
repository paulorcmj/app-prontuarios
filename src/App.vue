<script setup>
import { ref, onMounted } from 'vue';

const total = ref(null);

// Teste provisório da ligação tela, preload e banco. Sai quando a tela real entrar.
onMounted(async () => {
  const pacientes = await window.api.pacientes.listar('ativo', '');
  total.value = pacientes.length;
});
</script>

<template>
  <main>
    <h1>Prontuários</h1>
    <p v-if="total !== null">Pacientes ativos: {{ total }}</p>
  </main>
</template>