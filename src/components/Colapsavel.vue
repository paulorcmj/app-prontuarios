<script setup>
// Seção com cabeçalho clicável que mostra ou esconde o conteúdo.
// O conteúdo fica montado (v-show), então o que foi digitado não se perde ao recolher.
defineProps({ titulo: String });
const aberto = defineModel('aberto', { type: Boolean, default: true });
</script>

<template>
  <section class="colapsavel">
    <header class="colapsavel-cabecalho">
      <button type="button" class="colapsavel-botao" :aria-expanded="aberto" @click="aberto = !aberto">
        <span class="seta" :class="{ aberta: aberto }" aria-hidden="true"></span>
        <slot name="titulo">{{ titulo }}</slot>
      </button>
      <div v-if="$slots.acoes" class="colapsavel-acoes">
        <slot name="acoes" />
      </div>
    </header>
    <div v-show="aberto" class="colapsavel-corpo">
      <slot />
    </div>
  </section>
</template>