<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import Confirmacao from './Confirmacao.vue';
import Colapsavel from './Colapsavel.vue';
import FormSessao from './FormSessao.vue';
import { dataHoraBR, agoraLocal, mensagemDeErro } from '../utilitarios.js';

const props = defineProps({ pacienteId: Number });
const emit = defineEmits(['alteracao-pendente']);

const sessoes = ref([]);
// O banco devolve em ordem cronológica; a tela mostra da mais recente para a mais antiga.
const sessoesRecentesPrimeiro = computed(() => [...sessoes.value].reverse());
const busca = ref('');
const erro = ref('');
const excluindo = ref(null);
const novaRef = ref(null);

const secaoAberta = ref(true);
// Toda sessão começa fechada; aqui ficam as que o usuário abriu (id -> true).
const abertas = ref({});

// Sessão nova: formulário no topo, só aberto pelo botão.
const novaAberta = ref(false);
const nova = ref(formularioVazio());
// Edição: o formulário aparece dentro da própria sessão, no lugar do texto.
const edicao = ref(null);

// Retrato dos formulários como estavam ao abrir, para saber se há texto sem salvar.
const novaOriginal = ref('');
const edicaoOriginal = ref('');
const alteracaoPendente = computed(
  () =>
    (novaAberta.value && JSON.stringify(nova.value) !== novaOriginal.value) ||
    (edicao.value !== null && JSON.stringify(edicao.value) !== edicaoOriginal.value)
);
// A ficha repassa o aviso ao App.vue, que protege a troca de tela e o fechamento do app.
watch(alteracaoPendente, (pendente) => emit('alteracao-pendente', pendente));

function formularioVazio() {
  return { data_hora: agoraLocal(), titulo: '', relato: '', anotacoes: '' };
}

// O datetime-local entrega "AAAA-MM-DDTHH:MM"; o banco guarda com espaço no lugar do T.
function paraBanco(f) {
  return { data_hora: f.data_hora.replace('T', ' '), titulo: f.titulo, relato: f.relato, anotacoes: f.anotacoes };
}

async function carregar() {
  sessoes.value = await window.api.sessoes.listar(props.pacienteId, busca.value);
}

onMounted(carregar);
watch(busca, carregar);

// Rola só o necessário para a sessão ficar inteira à vista; se já está, não mexe.
async function mostrarSessao(id) {
  await nextTick();
  document.getElementById(`sessao-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function alternarSessao(id, aberto) {
  abertas.value[id] = aberto;
  if (aberto) mostrarSessao(id);
}

async function abrirNova() {
  secaoAberta.value = true;
  // Já há uma sessão nova sendo digitada: não apaga o que foi escrito.
  if (!novaAberta.value) {
    nova.value = formularioVazio();
    novaOriginal.value = JSON.stringify(nova.value);
    novaAberta.value = true;
  }
  await nextTick();
  novaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function fecharNova() {
  novaAberta.value = false;
  nova.value = formularioVazio();
}

async function salvarNova() {
  erro.value = '';
  try {
    await window.api.sessoes.criar(props.pacienteId, paraBanco(nova.value));
    fecharNova();
    // Limpa a busca para a sessão salva não ficar escondida pelo filtro.
    busca.value = '';
    await carregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

function editar(sessao) {
  abertas.value[sessao.id] = true;
  edicao.value = {
    id: sessao.id,
    data_hora: sessao.data_hora.replace(' ', 'T'),
    titulo: sessao.titulo,
    relato: sessao.relato ?? '',
    anotacoes: sessao.anotacoes ?? '',
  };
  edicaoOriginal.value = JSON.stringify(edicao.value);
  mostrarSessao(sessao.id);
}

async function salvarEdicao() {
  erro.value = '';
  try {
    await window.api.sessoes.atualizar(edicao.value.id, paraBanco(edicao.value));
    edicao.value = null;
    await carregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

async function excluir() {
  const { id } = excluindo.value;
  excluindo.value = null;
  erro.value = '';
  try {
    await window.api.sessoes.excluir(id);
    if (edicao.value?.id === id) edicao.value = null;
    await carregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}
</script>

<template>
  <Colapsavel v-model:aberto="secaoAberta" class="bloco">
    <template #titulo>Sessões <span class="contagem">{{ sessoes.length }}</span></template>
    <template #acoes>
      <input v-model="busca" type="search" aria-label="Buscar nas sessões" placeholder="Buscar nas sessões" />
      <button type="button" class="principal" @click="abrirNova">Nova sessão</button>
    </template>

    <div v-if="novaAberta" ref="novaRef">
      <FormSessao v-model="nova" rotulo-salvar="Adicionar sessão" @salvar="salvarNova" @cancelar="fecharNova" />
    </div>
    <p v-if="erro" class="erro">{{ erro }}</p>

    <ol v-if="sessoes.length" class="sessoes">
      <li v-for="s in sessoesRecentesPrimeiro" :id="`sessao-${s.id}`" :key="s.id">
        <Colapsavel
          class="sessao"
          :class="{ editando: edicao?.id === s.id }"
          :aberto="!!abertas[s.id]"
          @update:aberto="alternarSessao(s.id, $event)"
        >
          <template #titulo>
            <span class="sessao-data">{{ dataHoraBR(s.data_hora) }}</span>
            <span class="sessao-titulo">{{ s.titulo }}</span>
          </template>

          <FormSessao
            v-if="edicao?.id === s.id"
            v-model="edicao"
            rotulo-salvar="Salvar alterações"
            @salvar="salvarEdicao"
            @cancelar="edicao = null"
          />
          <div v-else class="sessao-corpo">
            <div v-if="s.relato">
              <p class="rotulo">Relato da sessão</p>
              <p class="texto">{{ s.relato }}</p>
            </div>
            <div v-if="s.anotacoes">
              <p class="rotulo">Anotações da sessão</p>
              <p class="texto anotacoes">{{ s.anotacoes }}</p>
            </div>
            <div class="acoes">
              <!-- Só uma sessão é editada por vez, para não perder texto digitado. -->
              <button type="button" :disabled="edicao !== null" @click="editar(s)">Editar</button>
              <button type="button" class="perigo" @click="excluindo = s">Excluir</button>
            </div>
          </div>
        </Colapsavel>
      </li>
    </ol>
    <p v-else class="vazio">{{ busca ? 'Nenhuma sessão encontrada' : 'Nenhuma sessão registrada' }}</p>

    <Confirmacao
      v-if="excluindo"
      texto="Excluir esta sessão?"
      @cancelar="excluindo = null"
      @confirmar="excluir"
    />
  </Colapsavel>
</template>