<script setup>
// Campo de senha com um olho no canto direito, que mostra ou esconde o que foi digitado.
import { ref } from 'vue';

defineProps({ autocomplete: String, autofocus: Boolean });
const senha = defineModel({ type: String, default: '' });
const visivel = ref(false);
</script>

<template>
  <div class="campo-senha">
    <input
      v-model="senha"
      :type="visivel ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
    />
    <!-- tabindex -1: o Tab pula direto para o próximo campo, sem parar no olho. -->
    <button
      type="button"
      class="olho"
      tabindex="-1"
      :title="visivel ? 'Ocultar senha' : 'Mostrar senha'"
      :aria-label="visivel ? 'Ocultar senha' : 'Mostrar senha'"
      :aria-pressed="visivel"
      @click="visivel = !visivel"
    >
      <svg v-if="!visivel" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="M1 1l22 22" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.campo-senha {
  position: relative;
}

.campo-senha input {
  padding-right: 42px;
}

/* Sem fundo nem borda, no mesmo tom do "x" da busca. */
.olho {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0 10px 10px 0;
  background: transparent;
  color: var(--texto-suave);
}

.olho:hover {
  background: transparent;
  color: var(--roxo);
}
</style>