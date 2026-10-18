<script setup>
defineProps({ texto: String });
defineEmits(['cancelar', 'confirmar']);
</script>

<template>
  <div class="fundo" @click.self="$emit('cancelar')">
    <div class="janela" role="dialog" aria-modal="true">
      <p>{{ texto }}</p>
      <div class="acoes">
        <!-- type="button" evita que o clique envie o formulário em que a janela está -->
        <button type="button" @click="$emit('cancelar')">Cancelar</button>
        <button type="button" class="perigo" @click="$emit('confirmar')">Excluir</button>
      </div>
    </div>
  </div>
</template>