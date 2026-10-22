<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import Confirmacao from './Confirmacao.vue';
import Colapsavel from './Colapsavel.vue';
import FormSessao from './FormSessao.vue';
import BuscaComOrdem from './BuscaComOrdem.vue';
import { dataHoraBR, mensagemDeErro } from '../utilitarios.js';
import { lerOrdem, guardarOrdem, lerSecao, guardarSecao } from '../preferencias.js';

const props = defineProps({ pacienteId: Number });
const emit = defineEmits(['alteracao-pendente']);

const sessoes = ref([]);

// Ordem da lista. O banco devolve em ordem cronológica; a tela escolhe como mostrar.
// A escolha vale para todos os pacientes e fica guardada entre uma abertura do app e outra.
const ORDENS = [
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'antigas', rotulo: 'Mais antigas' },
  { valor: 'modificadas', rotulo: 'Última modificação' },
];
const CHAVE_ORDEM = 'ordem-sessoes';
const ordem = ref(lerOrdem(CHAVE_ORDEM, ORDENS.map((o) => o.valor), 'recentes'));
watch(ordem, (valor) => guardarOrdem(CHAVE_ORDEM, valor));

const sessoesOrdenadas = computed(() => {
  const lista = [...sessoes.value];
  if (ordem.value === 'antigas') return lista;
  if (ordem.value === 'modificadas') {
    // O id desempata sessões modificadas no mesmo minuto.
    return lista.sort(
      (a, b) => (b.modificado_em ?? '').localeCompare(a.modificado_em ?? '') || b.id - a.id
    );
  }
  return lista.reverse();
});

const busca = ref('');
const erro = ref('');
const excluindo = ref(null);
const novaRef = ref(null);

// A seção "Sessões" e cada sessão lembram, por paciente, se estavam abertas.
const secaoAberta = ref(lerSecao(props.pacienteId, 'sessoes', true));
watch(secaoAberta, (valor) => guardarSecao(props.pacienteId, 'sessoes', valor));

// Estado de cada sessão (id -> aberta). Sem registro guardado, a sessão começa fechada.
const abertas = ref({});

function definirAberta(id, aberto) {
  abertas.value[id] = aberto;
  guardarSecao(props.pacienteId, `sessao-${id}`, aberto);
}

// Sessão nova: formulário no topo, só aberto pelo botão.
const novaAberta = ref(false);
const nova = ref(formularioVazio());
// Edição: o formulário aparece dentro da própria sessão, no lugar do texto.
const edicao = ref(null);

// Retrato dos formulários como estavam ao abrir, para saber se há texto sem salvar.
const novaOriginal = ref('');
const edicaoOriginal = ref('');
const novaAlterada = computed(() => novaAberta.value && JSON.stringify(nova.value) !== novaOriginal.value);
const edicaoAlterada = computed(
  () => edicao.value !== null && JSON.stringify(edicao.value) !== edicaoOriginal.value
);
const alteracaoPendente = computed(() => novaAlterada.value || edicaoAlterada.value);
// A ficha repassa o aviso ao App.vue, que protege a troca de tela e o fechamento do app.
watch(alteracaoPendente, (pendente) => emit('alteracao-pendente', pendente));

function formularioVazio() {
  // A data e a hora começam vazias: o usuário preenche (ou escolhe no calendário).
  return { data_hora: '', titulo: '', relato: '', anotacoes: '' };
}
// O datetime-local entrega "AAAA-MM-DDTHH:MM"; o banco guarda com espaço no lugar do T.
function paraBanco(f) {
  return { data_hora: f.data_hora.replace('T', ' '), titulo: f.titulo, relato: f.relato, anotacoes: f.anotacoes };
}

async function carregar() {
  sessoes.value = await window.api.sessoes.listar(props.pacienteId, busca.value);
  // Sessões que ainda não têm estado na tela recebem o que ficou guardado.
  for (const s of sessoes.value) {
    if (!(s.id in abertas.value)) {
      abertas.value[s.id] = lerSecao(props.pacienteId, `sessao-${s.id}`, false);
    }
  }
}

onMounted(carregar);

watch(busca, carregar);

// Rola só o necessário para a sessão ficar inteira à vista; se já está, não mexe.
async function mostrarSessao(id) {
  await nextTick();
  document.getElementById(`sessao-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function alternarSessao(id, aberto) {
  definirAberta(id, aberto);
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
    const id = await window.api.sessoes.criar(props.pacienteId, paraBanco(nova.value));
    fecharNova();
    // Limpa a busca para a sessão salva não ficar escondida pelo filtro.
    busca.value = '';
    await carregar();
    // A sessão criada nasce aberta e continua assim até o usuário fechar.
    if (id) {
      definirAberta(id, true);
      mostrarSessao(id);
    }
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

function editar(sessao) {
  definirAberta(sessao.id, true);
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
      <BuscaComOrdem
        v-model:busca="busca"
        v-model:ordem="ordem"
        class="busca-sessoes"
        :ordens="ORDENS"
        placeholder="Buscar nas sessões"
        rotulo-busca="Buscar nas sessões"
        rotulo-ordenar="Ordenar sessões"
        popup
      />
      <button type="button" class="principal" @click="abrirNova">Nova sessão</button>
    </template>

    <div v-if="novaAberta" ref="novaRef">
      <FormSessao
        v-model="nova"
        rotulo-salvar="Adicionar sessão"
        :pendente="novaAlterada"
        @salvar="salvarNova"
        @cancelar="fecharNova"
      />
    </div>
    <p v-if="erro" class="erro">{{ erro }}</p>

    <ol v-if="sessoes.length" class="sessoes">
      <li v-for="s in sessoesOrdenadas" :id="`sessao-${s.id}`" :key="s.id">
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
            rotulo-salvar="Salvar"
            contorno
            :pendente="edicaoAlterada"
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
              <p class="texto">{{ s.anotacoes }}</p>
            </div>
            <div class="acoes">
              <button type="button" class="perigo" @click="excluindo = s">Excluir</button>
              <!-- Só uma sessão é editada por vez, para não perder texto digitado. -->
              <button type="button" class="contorno" :disabled="edicao !== null" @click="editar(s)">Editar</button>
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

<style scoped>
/* Excluir e Editar ficam na ponta direita da sessão. */
.sessao-corpo .acoes {
  justify-content: flex-end;
}
</style>