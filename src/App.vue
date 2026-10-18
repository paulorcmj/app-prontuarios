<script setup>
import { ref, watch, onMounted } from 'vue';
import ListaPacientes from './components/ListaPacientes.vue';
import FichaPaciente from './components/FichaPaciente.vue';
import Confirmacao from './components/Confirmacao.vue';

const situacao = ref('ativo');
const busca = ref('');
const pacientes = ref([]);
// id do paciente aberto, 'novo' para cadastro, ou null quando não há nenhum
const aberto = ref(null);

// A ficha avisa quando há alterações que ainda não foram salvas.
const alteracaoPendente = ref(false);
// Navegação que ficou esperando a resposta do aviso de saída.
const saidaPendente = ref(null);

async function carregarLista() {
  pacientes.value = await window.api.pacientes.listar(situacao.value, busca.value);
}

watch([situacao, busca], carregarLista);
// Ao trocar de ficha, a anterior deixa de existir e o aviso dela também.
watch(aberto, () => {
  alteracaoPendente.value = false;
});

// Protege contra fechar o app ou recarregar a tela com alterações sem salvar.
// Quem mostra o aviso ao usuário é o main.js (evento will-prevent-unload).
function avisarAoFechar(evento) {
  if (!alteracaoPendente.value) return;
  evento.preventDefault();
  evento.returnValue = false;
}

onMounted(() => {
  carregarLista();
  window.addEventListener('beforeunload', avisarAoFechar);
});

// Faz a navegação, ou pede confirmação antes se houver alterações sem salvar.
function navegar(acao) {
  if (alteracaoPendente.value) saidaPendente.value = acao;
  else acao();
}

function confirmarSaida() {
  const acao = saidaPendente.value;
  saidaPendente.value = null;
  alteracaoPendente.value = false;
  acao();
}

function trocarAba(nova) {
  navegar(() => {
    situacao.value = nova;
    aberto.value = null;
  });
}

function abrirPaciente(id) {
  if (id === aberto.value) return;
  navegar(() => {
    aberto.value = id;
  });
}

function novoPaciente() {
  if (aberto.value === 'novo') return;
  navegar(() => {
    aberto.value = 'novo';
  });
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
      @abrir="abrirPaciente"
      @novo="novoPaciente"
    />
    <main class="painel">
      <FichaPaciente
        v-if="aberto !== null"
        :key="aberto"
        :paciente-id="aberto"
        @salvo="aoSalvar"
        @mudou-situacao="aoMudarSituacao"
        @alteracao-pendente="alteracaoPendente = $event"
      />
      <p v-else class="vazio">Selecione um paciente ou cadastre um novo.</p>
    </main>
    <footer class="rodape">Os dados ficam só neste computador.</footer>

    <Confirmacao
      v-if="saidaPendente"
      texto="Há alterações que não foram salvas. Se sair agora, elas serão perdidas."
      rotulo-cancelar="Continuar editando"
      rotulo-confirmar="Sair sem salvar"
      @cancelar="saidaPendente = null"
      @confirmar="confirmarSaida"
    />
  </div>
</template>