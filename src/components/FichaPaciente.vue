<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, provide } from 'vue';
import Confirmacao from './Confirmacao.vue';
import Colapsavel from './Colapsavel.vue';
import CampoValor from './CampoValor.vue';
import CampoMascara from './CampoMascara.vue';
import Sessoes from './Sessoes.vue';
import Responsavel from './Responsavel.vue';
import { reaisParaCentavos, centavosParaCampo, mensagemDeErro, erroMascara, statusData } from '../utilitarios.js';
import { lerSecao, guardarSecao, esquecerPaciente } from '../preferencias.js';
import CampoData from './CampoData.vue';

const props = defineProps({ pacienteId: [Number, String] });
const emit = defineEmits(['salvo', 'mudou-situacao', 'alteracao-pendente']);

// Campos de texto da ficha. A marca de menor de idade é tratada à parte (é verdadeiro ou falso).
const CAMPOS = [
  'nome_completo', 'cpf', 'data_nascimento', 'cidade_estado', 'queixa_inicial',
  'data_inicio', 'celular', 'contato_emergencia_nome',
  'contato_emergencia_telefone', 'adendos', 'anotacoes_caso',
];

// O pai recria este componente (:key) ao trocar de paciente, então 'novo' vale só no setup.
const novo = props.pacienteId === 'novo';
const ficha = ref({ ...Object.fromEntries(CAMPOS.map((c) => [c, ''])), menor_de_idade: false });
const nomeSalvo = ref('');
const situacao = ref('ativo');
const erro = ref('');
const confirmandoExclusao = ref(false);
const editando = ref(novo);
// Cada paciente lembra se esta seção estava aberta; paciente novo começa aberto.
const dadosAbertos = ref(novo ? true : lerSecao(props.pacienteId, 'dados', true));
watch(dadosAbertos, (valor) => {
  if (!novo) guardarSecao(props.pacienteId, 'dados', valor);
});

// Erros mostrados embaixo de cada campo (o erro geral, no topo, fica para as falhas do banco).
const erroNome = ref('');
const vazioErrosValor = () => ({ valor: '', data: '' });
const errosValor = ref(vazioErrosValor());

// Avisa os campos (CampoMascara e CampoData) que o salvamento foi tentado: a partir daí, os campos
// incompletos mostram o aviso mesmo sem terem perdido o foco.
const tentou = ref(false);
provide('tentouSalvar', tentou);

// Campos com máscara e a conferência de cada um. Incompleto ou inválido impede o salvamento
// (o aviso aparece embaixo do campo) e abre a seção, se estiver recolhida. Campo vazio não é erro.
const TIPOS_MASCARA = { cpf: 'cpf', celular: 'telefone', contato_emergencia_telefone: 'telefone' };
const CAMPOS_DATA = ['data_nascimento', 'data_inicio'];

function conferirCampos(dados) {
  tentou.value = true;
  const comErro =
    Object.entries(TIPOS_MASCARA).some(([campo, tipo]) => erroMascara(tipo, dados[campo])) ||
    CAMPOS_DATA.some((campo) => statusData(dados[campo])) ||
    statusData(dataCampo.value);
  if (comErro) dadosAbertos.value = true;
  return !comErro;
}

// Seção do responsável: tem botões próprios, mas o paciente novo grava os dados dela junto com a ficha.
const responsavelRef = ref(null);
const responsavelPendente = ref(false);

// Menu "Gerar PDF": fecha ao escolher uma opção e ao clicar fora.
const menuPdfAberto = ref(false);

function aoClicarFora(evento) {
  if (!evento.target.closest('.menu-pdf')) menuPdfAberto.value = false;
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

// Formulários de sessão e a seção do responsável com texto sem salvar também contam como alteração pendente.
const sessoesPendentes = ref(false);
const pendente = computed(
  () =>
    alterado.value ||
    sessoesPendentes.value ||
    (ficha.value.menor_de_idade && responsavelPendente.value)
);

// O App.vue usa isso para proteger a saída da ficha.
watch(pendente, (valor) => emit('alteracao-pendente', valor));

// O erro de um campo some assim que o usuário mexe nele.
watch(() => ficha.value.nome_completo, () => {
  erroNome.value = '';
});
watch([valorCampo, dataCampo], () => {
  errosValor.value = vazioErrosValor();
});

// Ação que ficou esperando a resposta do aviso de alterações sem salvar (cancelar a edição, arquivar).
const descarte = ref(null);

function comAviso(acao, temAlteracao) {
  if (temAlteracao) descarte.value = acao;
  else acao();
}

function confirmarDescarte() {
  const acao = descarte.value;
  descarte.value = null;
  acao();
}

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
  // O banco guarda 0 ou 1.
  ficha.value.menor_de_idade = !!p.menor_de_idade;
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

// O nome é conferido aqui (e não por "required") para o aviso aparecer embaixo do campo,
// mesmo com a seção recolhida: nesse caso ela é aberta.
function conferirNome(dados) {
  erroNome.value = dados.nome_completo.trim() ? '' : 'O nome do paciente é obrigatório';
  if (erroNome.value) dadosAbertos.value = true;
  return !erroNome.value;
}

// Valor e data "a partir de" andam juntos: ou os dois preenchidos, ou nenhum.
// Devolve null se algo estiver errado (a mensagem fica embaixo do campo) ou { novo }, onde
// "novo" é o valor a registrar, ou null quando não há nada novo.
function conferirValor() {
  errosValor.value = vazioErrosValor();
  const texto = valorCampo.value.trim();
  const data = dataCampo.value;
  if (!texto && !data) return { novo: null };
  // Data incompleta ou inválida: o aviso aparece no próprio campo, e conferirCampos cuida de bloquear.
  if (statusData(data)) return null;
  if (!texto) {
    errosValor.value.valor = 'Preencha o valor ou apague a data';
    return null;
  }
  if (!data) {
    errosValor.value.data = 'Preencha a data ou apague o valor';
    return null;
  }
  const centavos = reaisParaCentavos(texto);
  if (centavos === null) {
    errosValor.value.valor = 'Valor inválido';
    return null;
  }
  // Igual ao que já está salvo: não cria linha repetida no histórico.
  if (atual.value && centavos === atual.value.valor && data === atual.value.a_partir_de) return { novo: null };
  return { novo: { centavos, data } };
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
    // Tudo é conferido antes de gravar, para não ficar um cadastro pela metade.
    const nomeOk = conferirNome(dados);
    const conferido = conferirValor();
    const camposOk = conferirCampos(dados);
    if (!nomeOk || !conferido || !camposOk) return;
    const valorNovo = conferido.novo;

    if (!novo) {
      await window.api.pacientes.atualizar(props.pacienteId, dados);
      if (valorNovo) await window.api.valores.adicionar(props.pacienteId, valorNovo.centavos, valorNovo.data);
      nomeSalvo.value = dados.nome_completo;
      retratoSalvo.value = retrato();
      await carregarHistorico();
      restaurarCampoValor();
      editando.value = false;
      tentou.value = false;
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
    erroNome.value = '';
    errosValor.value = vazioErrosValor();
    tentou.value = false;
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

// Os PDFs são montados no processo principal, com o que está salvo no banco.
// "tipo" é 'paciente' ou 'analista'.
function gerarPdf(tipo) {
  menuPdfAberto.value = false;
  executar(() => window.api.pdf[tipo](props.pacienteId));
}

function excluir() {
  confirmandoExclusao.value = false;
  executar(async () => {
    await window.api.pacientes.excluir(props.pacienteId);
    esquecerPaciente(props.pacienteId);
    emit('mudou-situacao');
  });
}
</script>

<template>
  <form class="ficha" novalidate @submit.prevent="salvar">
    <header class="ficha-topo">
      <h2>{{ novo ? 'Novo paciente' : nomeSalvo }}</h2>
      <!-- Excluir e Arquivar ficam visíveis também durante a edição; o Gerar PDF some. -->
      <div v-if="!novo" class="acoes topo-sec">
        <button type="button" class="perigo" @click="confirmandoExclusao = true">Excluir</button>
        <button v-if="situacao === 'ativo'" type="button" @click="comAviso(arquivar, pendente)">Arquivar</button>
        <button v-else type="button" @click="comAviso(desarquivar, pendente)">Desarquivar</button>
      </div>
      <div v-if="!novo && !editando" class="acoes topo-pdf">
        <div class="menu-pdf">
          <button type="button" class="principal" aria-haspopup="menu" :aria-expanded="menuPdfAberto" @click="menuPdfAberto = !menuPdfAberto">Gerar PDF</button>
          <div v-if="menuPdfAberto" class="pdf-menu">
            <button type="button" @click="gerarPdf('paciente')">PDF do paciente</button>
            <button type="button" @click="gerarPdf('analista')">PDF do analista</button>
          </div>
        </div>
      </div>
    </header>

    <p v-if="erro" class="erro">{{ erro }}</p>

    <Colapsavel v-model:aberto="dadosAbertos" titulo="Dados do paciente">
      <div class="grade">
        <fieldset :disabled="!editando">
          <label class="largo">Nome completo
            <input v-model="ficha.nome_completo" />
            <span v-if="erroNome" class="erro">{{ erroNome }}</span>
          </label>
          <label>CPF
            <CampoMascara v-model="ficha.cpf" tipo="cpf" />
          </label>
          <div class="coluna">
            <label>Data de nascimento
              <CampoData v-model="ficha.data_nascimento" />
            </label>
            <label class="marcar">
              <input v-model="ficha.menor_de_idade" type="checkbox" />
              Paciente menor de idade
            </label>
          </div>
          <label>Cidade/Estado
            <input v-model="ficha.cidade_estado" />
          </label>
          <label>Início do atendimento
            <CampoData v-model="ficha.data_inicio" />
          </label>
          <label>Contato
            <CampoMascara v-model="ficha.celular" tipo="telefone" />
          </label>
        </fieldset>

        <CampoValor
          v-model:valor="valorCampo"
          v-model:data="dataCampo"
          :historico="historico"
          :editando="editando"
          :erros="errosValor"
          @removido="aposRemoverValor"
          @erro="erro = $event"
        />

        <fieldset :disabled="!editando">
          <label>Contato de emergência (número)
            <CampoMascara v-model="ficha.contato_emergencia_telefone" tipo="telefone" />
          </label>
          <label>Contato de emergência (nome)
            <input v-model="ficha.contato_emergencia_nome" />
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

      <!-- As chaves impedem o Vue de reaproveitar o mesmo botão: o clique em
           "Editar" viraria um envio do formulário ao trocar o tipo do botão. -->
      <div class="acoes rodape">
        <template v-if="editando">
          <button v-if="!novo" key="cancelar" type="button" @click="comAviso(cancelarEdicao, alterado)">Cancelar</button>
          <button key="salvar" type="submit" class="principal">Salvar</button>
        </template>
        <button v-else key="editar" type="button" class="principal" @click="iniciarEdicao">Editar</button>
      </div>
    </Colapsavel>

    <Confirmacao
      v-if="confirmandoExclusao"
      texto="Excluir este paciente? As sessões, os valores e os dados do responsável também serão excluídos."
      @cancelar="confirmandoExclusao = false"
      @confirmar="excluir"
    />
    <Confirmacao
      v-if="descarte"
      texto="Há alterações que não foram salvas. Se continuar, elas serão perdidas."
      rotulo-cancelar="Continuar editando"
      rotulo-confirmar="Descartar alterações"
      @cancelar="descarte = null"
      @confirmar="confirmarDescarte"
    />
  </form>
  <!-- Fora do formulário: a seção tem botões próprios e um formulário não pode ficar dentro de outro. -->
  <Responsavel
    v-if="ficha.menor_de_idade && !novo"
    ref="responsavelRef"
    :paciente-id="pacienteId"
    @alteracao-pendente="responsavelPendente = $event"
  />
  <Sessoes v-if="!novo" :paciente-id="pacienteId" @alteracao-pendente="sessoesPendentes = $event" />
</template>

<style scoped>
/* A data de nascimento e a caixa de menor de idade formam uma coluna só, a caixa logo embaixo da data. */
.coluna {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* A caixa fica ao lado do texto, não em cima. */
.marcar {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--texto);
}

/* O menu de PDF fica na ponta direita da linha; abrir para a direita estouraria a janela. */
.pdf-menu {
  left: auto;
  right: 0;
}
</style>