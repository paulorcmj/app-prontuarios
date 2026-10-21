<script setup>
// Formulário de sessão, usado tanto para sessão nova quanto para edição no lugar.
// "pendente" avisa que há texto sem salvar: nesse caso o Cancelar pede confirmação.
import { ref, watch } from 'vue';
import Confirmacao from './Confirmacao.vue';

const props = defineProps({ rotuloSalvar: String, pendente: Boolean });
const emit = defineEmits(['salvar', 'cancelar']);
const dados = defineModel({ type: Object });
const confirmando = ref(false);

// Os campos obrigatórios são conferidos aqui (e não por "required") para o aviso aparecer
// embaixo do campo, no padrão do app, e não num balão do navegador.
const erros = ref({ data_hora: '', titulo: '' });
watch(() => dados.value.data_hora, () => {
  erros.value.data_hora = '';
});
watch(() => dados.value.titulo, () => {
  erros.value.titulo = '';
});

function enviar() {
  erros.value = {
    data_hora: dados.value.data_hora ? '' : 'Informe a data e a hora',
    titulo: dados.value.titulo.trim() ? '' : 'Título obrigatório',
  };
  if (erros.value.data_hora || erros.value.titulo) return;
  emit('salvar');
}

function pedirCancelamento() {
  if (props.pendente) confirmando.value = true;
  else emit('cancelar');
}

function descartar() {
  confirmando.value = false;
  emit('cancelar');
}
</script>

<template>
  <form class="form-sessao" novalidate @submit.prevent="enviar">
    <label>Data e hora
      <input v-model="dados.data_hora" type="datetime-local" />
      <span v-if="erros.data_hora" class="erro">{{ erros.data_hora }}</span>
    </label>
    <label>Título
      <input v-model="dados.titulo" />
      <span v-if="erros.titulo" class="erro">{{ erros.titulo }}</span>
    </label>
    <label>Relato da sessão
      <textarea v-model="dados.relato" />
    </label>
    <label>Anotações da sessão
      <textarea v-model="dados.anotacoes" />
    </label>
    <div class="acoes">
      <button type="button" @click="pedirCancelamento">Cancelar</button>
      <button type="submit" class="principal">{{ rotuloSalvar }}</button>
    </div>

    <Confirmacao
      v-if="confirmando"
      texto="Há alterações que não foram salvas. Se cancelar agora, elas serão perdidas."
      rotulo-cancelar="Continuar editando"
      rotulo-confirmar="Descartar alterações"
      @cancelar="confirmando = false"
      @confirmar="descartar"
    />
  </form>
</template>

<style scoped>
/* Cancelar e salvar ficam na ponta direita. */
.acoes {
  justify-content: flex-end;
}
</style>