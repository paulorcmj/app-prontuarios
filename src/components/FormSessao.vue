<script setup>
// Formulário de sessão, usado tanto para sessão nova quanto para edição no lugar.
defineProps({ rotuloSalvar: String });
defineEmits(['salvar', 'cancelar']);
const dados = defineModel({ type: Object });
</script>

<template>
  <form class="form-sessao" @submit.prevent="$emit('salvar')">
    <label>Data e hora
      <input v-model="dados.data_hora" type="datetime-local" required />
    </label>
    <label>Título
      <input v-model="dados.titulo" required />
    </label>
    <label>Relato da sessão
      <textarea v-model="dados.relato" />
    </label>
    <label>Anotações da sessão
      <textarea v-model="dados.anotacoes" />
    </label>
    <div class="acoes">
      <button type="submit" class="principal">{{ rotuloSalvar }}</button>
      <button type="button" @click="$emit('cancelar')">Cancelar</button>
    </div>
  </form>
</template>