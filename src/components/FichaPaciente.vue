<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import Confirmacao from './Confirmacao.vue';
import Colapsavel from './Colapsavel.vue';
import CampoValor from './CampoValor.vue';
import Sessoes from './Sessoes.vue';
import { reaisParaCentavos, centavosParaCampo, mensagemDeErro } from '../utilitarios.js';

const props = defineProps({ pacienteId: [Number, String] });
const emit = defineEmits(['salvo', 'mudou-situacao', 'alteracao-pendente']);

const CAMPOS = [
  'nome_completo', 'cpf', 'data_nascimento', 'cidade', 'queixa_inicial',
  'data_inicio', 'celular', 'contato_emergencia_nome',
  'contato_emergencia_telefone', 'adendos', 'anotacoes_caso',
];

// O pai recria este componente (:key) ao trocar de paciente, então 'novo' vale só no setup.
const novo = props.pacienteId === 'novo';
const ficha = ref(Object.fromEntries(CAMPOS.map((c) => [c, ''])));
const nomeSalvo = ref('');
const situacao = ref('ativo');
const erro = ref('');
const confirmandoExclusao = ref(false);
const editando = ref(novo);
const dadosAbertos = ref(true);

// Menu "Gerar PDF": fecha ao escolher uma opção e ao clicar fora.
const menuPdfAberto = ref(false);
const raizPdf = ref(null);

function aoClicarFora(evento) {
  if (raizPdf.value && !raizPdf.value.contains(evento.target)) menuPdfAberto.value = false;
}

// Histórico de valores (o mais recente primeiro) e os dois campos de valor da ficha.
// O valor atual é a primeira linha do histórico.
const historico = ref([]);
const atual = computed(() => historico.value[0] ?? null);
const valorSalvo = computed(() => (atual.value ? centavosParaCampo(atual.value.valor) : ''));
const dataSalva = computed(() => atual.value?.a_partir_de ?? '');
const valorCampo = ref('');
const dataCampo = ref('');

// Retrato dos campos como estão salvos, para saber se há alteração pendente.
const retrato = () => JSON.stringify(ficha.value);
const retratoSalvo = ref(retrato());
const alterado = computed(
  () =>
    editando.value &&
    (retrato() !== retratoSalvo.value ||
      valorCampo.value !== valorSalvo.value ||
      dataCampo.value !== dataSalva.value)
);

// Formulários de sessão com texto sem salvar também contam como alteração pendente.
const sessoesPendentes = ref(false);
const pendente = computed(() => alterado.value || sessoesPendentes.value);

// O App.vue usa isso para proteger a saída da ficha.
watch(pendente, (valor) => emit('alteracao-pendente', valor));

function restaurarCampoValor() {
  valorCampo.value = valorSalvo.value;
  dataCampo.value = dataSalva.value;
}

async function carregarHistorico() {
  historico.value = await window.api.valores.listar(props.pacienteId);
}

async function carregarFicha() {
  const p = await window.api.pacientes.obter(props.pacienteId);
  for (const c of CAMPOS) ficha.value[c] = p[c] ?? '';
  nomeSalvo.value = p.nome_completo;
  situacao.value = p.situacao;
  retratoSalvo.value = retrato();
  await carregarHistorico();
  restaurarCampoValor();
}

onMounted(() => {
  document.addEventListener('click', aoClicarFora);
  if (!novo) executar(carregarFicha);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', aoClicarFora);
});

async function executar(acao) {
  erro.value = '';
  try {
    await acao();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

// Valor e data "a partir de" andam juntos: ou os dois preenchidos, ou nenhum.
// Devolve null quando não há valor novo a registrar.
function conferirValor() {
  const texto = valorCampo.value.trim();
  const data = dataCampo.value;
  if (!texto && !data) return null;
  if (!texto || !data) {
    throw new Error('Preencha o valor e a data "a partir de", ou deixe os dois vazios');
  }
  const centavos = reaisParaCentavos(texto);
  if (centavos === null) throw new Error('Digite o valor em reais, por exemplo 150,00');
  // Igual ao que já está salvo: não cria linha repetida no histórico.
  if (atual.value && centavos === atual.value.valor && data === atual.value.a_partir_de) return null;
  return { centavos, data };
}

function iniciarEdicao() {
  menuPdfAberto.value = false;
  dadosAbertos.value = true;
  editando.value = true;
}

function salvar() {
  executar(async () => {
    // A cópia ({ ...ficha }) tira o proxy do Vue, que o IPC não consegue enviar.
    const dados = { ...ficha.value };
    // O valor é conferido antes de gravar, para não ficar um cadastro pela metade.
    const valorNovo = conferirValor();

    if (!novo) {
      await window.api.pacientes.atualizar(props.pacienteId, dados);
      if (valorNovo) await window.api.valores.adicionar(props.pacienteId, valorNovo.centavos, valorNovo.data);
      nomeSalvo.value = dados.nome_completo;
      retratoSalvo.value = retrato();
      await carregarHistorico();
      restaurarCampoValor();
      editando.value = false;
      emit('salvo', props.pacienteId);
      return;
    }

    const id = await window.api.pacientes.criar(dados);
    if (valorNovo) {
      // Se falhar, o paciente já existe e o valor pode ser registrado depois, editando a ficha.
      await window.api.valores.adicionar(id, valorNovo.centavos, valorNovo.data).catch(() => {});
    }
    emit('salvo', id);
  });
}

// Descarta o que foi digitado e volta ao que está salvo no banco.
function cancelarEdicao() {
  executar(async () => {
    await carregarFicha();
    editando.value = false;
  });
}

// Depois de remover uma linha do histórico, o valor atual pode ter mudado.
function aposRemoverValor() {
  executar(async () => {
    await carregarHistorico();
    restaurarCampoValor();
  });
}

function arquivar() {
  executar(async () => {
    await window.api.pacientes.arquivar(props.pacienteId);
    emit('mudou-situacao');
  });
}

function desarquivar() {
  executar(async () => {
    await window.api.pacientes.desarquivar(props.pacienteId);
    emit('mudou-situacao');
  });
}

// O PDF é montado no processo principal, com o que está salvo no banco.
function gerarPdfPaciente() {
  menuPdfAberto.value = false;
  executar(async () => {
    await window.api.pdf.paciente(props.pacienteId);
  });
}

// O PDF do analista ainda não existe.
function gerarPdfAnalista() {
  menuPdfAberto.value = false;
  erro.value = 'O PDF do analista ainda não está disponível';
}

function excluir() {
  confirmandoExclusao.value = false;
  executar(async () => {
    await window.api.pacientes.excluir(props.pacienteId);
    emit('mudou-situacao');
  });
}
</script>

<template>
  <form class="ficha" @submit.prevent="salvar">
    <header class="ficha-topo">
      <h2>{{ novo ? 'Novo paciente' : nomeSalvo }}</h2>
      <div class="acoes">
        <!-- As chaves impedem o Vue de reaproveitar o mesmo botão: o clique em
             "Editar" viraria um envio do formulário ao trocar o tipo do botão. -->
        <template v-if="editando" key="edicao">
          <button type="submit" class="principal">Salvar</button>
          <button v-if="!novo" type="button" @click="cancelarEdicao">Cancelar</button>
        </template>
        <template v-else key="leitura">
          <button type="button" class="principal" @click="iniciarEdicao">Editar</button>
          <div ref="raizPdf" class="menu-pdf">
            <button type="button" aria-haspopup="menu" :aria-expanded="menuPdfAberto" @click="menuPdfAberto = !menuPdfAberto">Gerar PDF</button>
            <div v-if="menuPdfAberto" class="pdf-menu">
              <button type="button" @click="gerarPdfPaciente">PDF do paciente</button>
              <button type="button" @click="gerarPdfAnalista">PDF do analista</button>
            </div>
          </div>
          <button v-if="situacao === 'ativo'" type="button" @click="arquivar">Arquivar</button>
          <button v-else type="button" @click="desarquivar">Desarquivar</button>
          <button type="button" class="perigo" @click="confirmandoExclusao = true">Excluir</button>
        </template>
      </div>
    </header>

    <p v-if="erro" class="erro">{{ erro }}</p>

    <Colapsavel v-model:aberto="dadosAbertos" titulo="Dados do paciente">
      <!-- O nome é conferido pelo banco, e não por "required": com a seção recolhida
           o navegador bloquearia o envio sem mostrar nada. -->
      <div class="grade">
        <fieldset :disabled="!editando">
          <label class="largo">Nome completo
            <input v-model="ficha.nome_completo" />
          </label>
          <label>CPF
            <input v-model="ficha.cpf" />
          </label>
          <label>Data de nascimento
            <input v-model="ficha.data_nascimento" type="date" />
          </label>
          <label>Cidade e estado
            <input v-model="ficha.cidade" />
          </label>
          <label>Início do atendimento
            <input v-model="ficha.data_inicio" type="date" />
          </label>
          <label>Celular
            <input v-model="ficha.celular" />
          </label>
          <label>Contato de emergência (nome)
            <input v-model="ficha.contato_emergencia_nome" />
          </label>
        </fieldset>

        <CampoValor
          v-model:valor="valorCampo"
          v-model:data="dataCampo"
          :historico="historico"
          :editando="editando"
          @removido="aposRemoverValor"
          @erro="erro = $event"
        />

        <fieldset :disabled="!editando">
          <label>Contato de emergência (número)
            <input v-model="ficha.contato_emergencia_telefone" />
          </label>
          <label class="largo">Queixa inicial
            <textarea v-model="ficha.queixa_inicial" />
          </label>
          <label class="largo">Adendos
            <textarea v-model="ficha.adendos" />
          </label>
          <label class="largo">Anotações do caso
            <textarea v-model="ficha.anotacoes_caso" />
          </label>
        </fieldset>
      </div>
    </Colapsavel>

    <Confirmacao
      v-if="confirmandoExclusao"
      texto="Excluir este paciente? As sessões e os valores dele também serão excluídos."
      @cancelar="confirmandoExclusao = false"
      @confirmar="excluir"
    />
  </form>
  <Sessoes v-if="!novo" :paciente-id="pacienteId" @alteracao-pendente="sessoesPendentes = $event" />
</template>