<script setup>
import { ref, computed, onMounted } from 'vue';
import Confirmacao from './Confirmacao.vue';
import { dataHoraBR, agoraLocal, mensagemDeErro } from '../utilitarios.js';

const props = defineProps({ pacienteId: Number });

const sessoes = ref([]);
// O banco devolve em ordem cronológica; a tela mostra da mais recente para a mais antiga.
const sessoesRecentesPrimeiro = computed(() => [...sessoes.value].reverse());
const erro = ref('');
const excluindo = ref(null);
const formRef = ref(null);

// Um formulário só serve para sessão nova (id null) e para edição.
function formularioVazio() {
  return { id: null, data_hora: agoraLocal(), relato: '', anotacoes: '' };
}
const formulario = ref(formularioVazio());

async function carregar() {
  sessoes.value = await window.api.sessoes.listar(props.pacienteId);
}

onMounted(carregar);

async function salvar() {
  erro.value = '';
  try {
    const { id, data_hora, relato, anotacoes } = formulario.value;
    // O datetime-local entrega "AAAA-MM-DDTHH:MM"; o banco guarda com espaço no lugar do T.
    const dados = { data_hora: data_hora.replace('T', ' '), relato, anotacoes };
    if (id === null) await window.api.sessoes.criar(props.pacienteId, dados);
    else await window.api.sessoes.atualizar(id, dados);
    formulario.value = formularioVazio();
    await carregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

function editar(sessao) {
  formulario.value = {
    id: sessao.id,
    data_hora: sessao.data_hora.replace(' ', 'T'),
    relato: sessao.relato ?? '',
    anotacoes: sessao.anotacoes ?? '',
  };
  formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicao() {
  formulario.value = formularioVazio();
}

async function excluir() {
  const { id } = excluindo.value;
  excluindo.value = null;
  erro.value = '';
  try {
    await window.api.sessoes.excluir(id);
    if (formulario.value.id === id) formulario.value = formularioVazio();
    await carregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}
</script>

<template>
  <section class="bloco">
    <h3>Sessões</h3>

    <form ref="formRef" class="form-sessao" @submit.prevent="salvar">
      <label>Data e hora
        <input v-model="formulario.data_hora" type="datetime-local" required />
      </label>
      <label>Relato da sessão
        <textarea v-model="formulario.relato" rows="4" />
      </label>
      <label>Anotações
        <textarea v-model="formulario.anotacoes" rows="3" />
      </label>
      <div class="acoes">
        <button type="submit" class="principal">
          {{ formulario.id === null ? 'Adicionar sessão' : 'Salvar alterações' }}
        </button>
        <button v-if="formulario.id !== null" type="button" @click="cancelarEdicao">Cancelar edição</button>
      </div>
    </form>
    <p v-if="erro" class="erro">{{ erro }}</p>

    <ol class="sessoes">
      <li v-for="s in sessoesRecentesPrimeiro" :key="s.id" :class="{ editando: s.id === formulario.id }">
        <header>
          <strong>{{ dataHoraBR(s.data_hora) }}</strong>
          <span class="acoes">
            <button type="button" @click="editar(s)">Editar</button>
            <button type="button" class="perigo" @click="excluindo = s">Excluir</button>
          </span>
        </header>
        <p v-if="s.relato" class="texto">{{ s.relato }}</p>
        <p v-if="s.anotacoes" class="texto anotacoes"><em>Anotações:</em> {{ s.anotacoes }}</p>
      </li>
    </ol>
    <p v-if="!sessoes.length" class="vazio">Nenhuma sessão registrada.</p>

    <Confirmacao
      v-if="excluindo"
      texto="Excluir esta sessão?"
      @cancelar="excluindo = null"
      @confirmar="excluir"
    />
  </section>
</template>