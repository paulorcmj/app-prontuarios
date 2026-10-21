<script setup>
defineProps({
  texto: String,
  rotuloCancelar: { type: String, default: 'Cancelar' },
  rotuloConfirmar: { type: String, default: 'Excluir' },
});
defineEmits(['cancelar', 'confirmar']);
</script>

<template>
  <div class="fundo" @click.self="$emit('cancelar')">
    <div class="janela" role="dialog" aria-modal="true">
      <!-- Sem conteúdo no slot, mostra o texto simples. -->
      <slot><p>{{ texto }}</p></slot>
      <div class="acoes">
        <!-- type="button" evita que o clique envie o formulário em que a janela está -->
        <button type="button" @click="$emit('cancelar')">{{ rotuloCancelar }}</button>
        <button type="button" class="perigo" @click="$emit('confirmar')">{{ rotuloConfirmar }}</button>
      </div>
    </div>
  </div>
</template>