<script setup>
import { ref, watch, onMounted } from 'vue';
import ListaPacientes from './components/ListaPacientes.vue';
import FichaPaciente from './components/FichaPaciente.vue';

const situacao = ref('ativo');
const busca = ref('');
const pacientes = ref([]);
// id do paciente aberto, 'novo' para cadastro, ou null quando não há nenhum
const aberto = ref(null);

async function carregarLista() {
  pacientes.value = await window.api.pacientes.listar(situacao.value, busca.value);
}

watch([situacao, busca], carregarLista);
onMounted(carregarLista);

function trocarAba(nova) {
  situacao.value = nova;
  aberto.value = null;
}

async function aoSalvar(id) {
  await carregarLista();
  aberto.value = id;
}

// Arquivar, desarquivar e excluir tiram o paciente da lista atual.
async function aoMudarSituacao() {
  aberto.value = null;
  await carregarLista();
}
</script>

<template>
  <div class="app">
    <ListaPacientes
      v-model:busca="busca"
      :situacao="situacao"
      :pacientes="pacientes"
      :aberto="aberto"
      @trocar-aba="trocarAba"
      @abrir="aberto = $event"
      @novo="aberto = 'novo'"
    />
    <main class="painel">
      <FichaPaciente
        v-if="aberto !== null"
        :key="aberto"
        :paciente-id="aberto"
        @salvo="aoSalvar"
        @mudou-situacao="aoMudarSituacao"
      />
      <p v-else class="vazio">Selecione um paciente ou cadastre um novo.</p>
    </main>
    <footer class="rodape">Os dados ficam só neste computador.</footer>
  </div>
</template>