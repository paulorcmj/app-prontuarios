<script setup>
// Confirmação de carregar um backup. É a mesma na janela de backup e na tela de senha.
// "dados" vem do app: se há dados atuais (e então uma cópia deles é guardada antes) e em que pasta.
import Confirmacao from './Confirmacao.vue';

defineProps({ dados: Object });
defineEmits(['cancelar', 'confirmar']);
</script>

<template>
  <Confirmacao
    rotulo-cancelar="Cancelar"
    rotulo-confirmar="Carregar backup"
    @cancelar="$emit('cancelar')"
    @confirmar="$emit('confirmar')"
  >
    <p><strong>Substituir os dados atuais pelos do backup?</strong></p>
    <template v-if="dados.jaTemDados">
      <p>Uma cópia dos dados atuais será guardada antes em:</p>
      <p class="caminho">{{ dados.pastaDaCopia }}</p>
    </template>
    <p>
      O app vai reiniciar e pedir a senha que valia na data do backup.
      <template v-if="dados.jaTemDados">O que não foi salvo na tela será perdido.</template>
    </p>
  </Confirmacao>
</template>

<style scoped>
.caminho {
  color: var(--texto-suave);
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* A confirmação fica maior que a janela de backup que aparece por trás dela,
   para cobri-la por inteiro. Os botões ficam no pé da janela. */
:deep(.janela) {
  display: flex;
  flex-direction: column;
  width: 440px;
  min-height: 340px;
  padding: 28px;
}

:deep(.janela .acoes) {
  margin-top: auto;
  padding-top: 16px;
}
</style>