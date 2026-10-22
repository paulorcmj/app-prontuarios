<script setup>
// Formulário de sessão, usado tanto para sessão nova quanto para edição no lugar.
// "pendente" avisa que há texto sem salvar: nesse caso o Cancelar pede confirmação.
import { ref, watch, provide } from 'vue';
import Confirmacao from './Confirmacao.vue';
import CampoData from './CampoData.vue';
import { statusData } from '../utilitarios.js';

const props = defineProps({ rotuloSalvar: String, pendente: Boolean, contorno: Boolean });
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

// Avisa o campo de data que o salvamento foi tentado, para ele mostrar o aviso de incompleto.
const tentou = ref(false);
provide('tentouSalvar', tentou);

function enviar() {
  tentou.value = true;
  erros.value = {
    data_hora: dados.value.data_hora ? '' : 'Informe a data e a hora',
    titulo: dados.value.titulo.trim() ? '' : 'Título obrigatório',
  };
  // Data incompleta ou inválida também impede o envio; o aviso aparece no próprio campo.
  if (erros.value.data_hora || erros.value.titulo || statusData(dados.value.data_hora, true)) return;
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
      <CampoData v-model="dados.data_hora" hora />
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
      <button type="submit" :class="contorno ? 'contorno' : 'principal'">{{ rotuloSalvar }}</button>
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