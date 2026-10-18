<script setup>
import { ref, onMounted } from 'vue';
import Confirmacao from './Confirmacao.vue';
import Valores from './Valores.vue';
import Sessoes from './Sessoes.vue';
import { reaisParaCentavos, hoje, mensagemDeErro } from '../utilitarios.js';

const props = defineProps({ pacienteId: [Number, String] });
const emit = defineEmits(['salvo', 'mudou-situacao']);
const valorInicial = ref('');

const CAMPOS = [
  'nome_completo', 'cpf', 'data_nascimento', 'cidade', 'queixa_inicial',
  'data_inicio', 'celular', 'contato_emergencia_nome',
  'contato_emergencia_telefone', 'adendos', 'anotacoes_caso',
];

// O pai recria este componente (:key) ao trocar de paciente, então 'novo' vale só no setup.
const novo = props.pacienteId === 'novo';
const ficha = ref(Object.fromEntries(CAMPOS.map((c) => [c, ''])));
const situacao = ref('ativo');
const erro = ref('');
const confirmandoExclusao = ref(false);
const editando = ref(novo);

async function carregarFicha() {
  const p = await window.api.pacientes.obter(props.pacienteId);
  for (const c of CAMPOS) ficha.value[c] = p[c] ?? '';
  situacao.value = p.situacao;
}

onMounted(() => {
  if (!novo) executar(carregarFicha);
});

async function executar(acao) {
  erro.value = '';
  try {
    await acao();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

function salvar() {
  executar(async () => {
    // A cópia ({ ...ficha }) tira o proxy do Vue, que o IPC não consegue enviar.
    const dados = { ...ficha.value };

    if (!novo) {
      await window.api.pacientes.atualizar(props.pacienteId, dados);
      editando.value = false;
      emit('salvo', props.pacienteId);
      return;
    }

    // O valor é conferido antes de criar o paciente, para não ficar um cadastro pela metade.
    let centavos = null;
    if (valorInicial.value.trim()) {
      centavos = reaisParaCentavos(valorInicial.value);
      if (centavos === null) throw new Error('Digite o valor em reais, por exemplo 150,00');
    }

    const id = await window.api.pacientes.criar(dados);
    if (centavos !== null) {
      // Vale desde o início do atendimento (ou desde hoje, se a data estiver vazia).
      // Se falhar, o paciente já existe e o valor pode ser registrado depois, no bloco da ficha.
      await window.api.valores.adicionar(id, centavos, ficha.value.data_inicio || hoje()).catch(() => {});
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
    <h2>{{ novo ? 'Novo paciente' : 'Ficha do paciente' }}</h2>

    <fieldset :disabled="!editando">
      <label class="largo">Nome completo
        <input v-model="ficha.nome_completo" required />
      </label>
      <label>CPF
        <input v-model="ficha.cpf" />
      </label>
      <label>Data de nascimento
        <input v-model="ficha.data_nascimento" type="date" />
      </label>
      <label>Cidade
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
      <label>Contato de emergência (telefone)
        <input v-model="ficha.contato_emergencia_telefone" />
      </label>
      <label v-if="novo">Valor da sessão (R$)
        <input v-model="valorInicial" inputmode="decimal" placeholder="150,00" />
      </label>
      <label class="largo">Queixa inicial
        <textarea v-model="ficha.queixa_inicial" rows="3" />
      </label>
      <label class="largo">Adendos
        <textarea v-model="ficha.adendos" rows="3" />
      </label>
      <label class="largo">Anotações do caso
        <textarea v-model="ficha.anotacoes_caso" rows="4" />
      </label>
    </fieldset>

    <p v-if="erro" class="erro">{{ erro }}</p>

    <div class="acoes">
      <!-- As chaves impedem o Vue de reaproveitar o mesmo botão: o clique em
           "Editar" viraria um envio do formulário ao trocar o tipo do botão. -->
      <template v-if="editando" key="edicao">
        <button type="submit" class="principal">Salvar</button>
        <button v-if="!novo" type="button" @click="cancelarEdicao">Cancelar</button>
      </template>
      <template v-else key="leitura">
        <button type="button" class="principal" @click="editando = true">Editar</button>
        <button v-if="situacao === 'ativo'" type="button" @click="arquivar">Arquivar</button>
        <button v-else type="button" @click="desarquivar">Desarquivar</button>
        <button type="button" class="perigo" @click="confirmandoExclusao = true">Excluir</button>
      </template>
    </div>

    <Confirmacao
      v-if="confirmandoExclusao"
      texto="Excluir este paciente? As sessões e os valores dele também serão excluídos."
      @cancelar="confirmandoExclusao = false"
      @confirmar="excluir"
    />
  </form>
  <template v-if="!novo">
    <Valores :paciente-id="pacienteId" />
    <Sessoes :paciente-id="pacienteId" />
  </template>
</template>