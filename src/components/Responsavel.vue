<script setup>
// Seção do responsável, para paciente menor de idade. Num paciente já cadastrado ela tem
// botões próprios (editar, salvar, gerar termo). Num paciente novo não há onde gravar ainda:
// os dados ficam na tela e a ficha chama salvarPara() depois de criar o paciente.
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, provide } from 'vue';
import Colapsavel from './Colapsavel.vue';
import CampoMascara from './CampoMascara.vue';
import Confirmacao from './Confirmacao.vue';
import { mensagemDeErro, erroMascara, statusData } from '../utilitarios.js';
import { lerSecao, guardarSecao } from '../preferencias.js';
import CampoData from './CampoData.vue';

const props = defineProps({ pacienteId: [Number, String] });
const emit = defineEmits(['alteracao-pendente']);

const CAMPOS = ['nome_completo', 'data_nascimento', 'cpf', 'endereco', 'cidade_estado', 'contato'];
const vazio = () => Object.fromEntries(CAMPOS.map((c) => [c, '']));

const novo = props.pacienteId === 'novo';
const dados = ref(vazio());
// Cada paciente lembra se esta seção estava aberta; paciente novo começa aberto.
const aberto = ref(novo ? true : lerSecao(props.pacienteId, 'responsavel', true));
watch(aberto, (valor) => {
  if (!novo) guardarSecao(props.pacienteId, 'responsavel', valor);
});
const editando = ref(novo);
// Já existe um responsável salvo para este paciente?
const existe = ref(false);
const erro = ref('');
const confirmandoCancelamento = ref(false);

// Avisa os campos que o salvamento foi tentado, para mostrarem o aviso de incompleto.
const tentou = ref(false);
provide('tentouSalvar', tentou);

// Campo incompleto ou inválido impede o salvamento; campo vazio não é erro.
function conferir() {
  tentou.value = true;
  const ok =
    !erroMascara('cpf', dados.value.cpf) &&
    !erroMascara('telefone', dados.value.contato) &&
    !statusData(dados.value.data_nascimento);
  if (!ok) aberto.value = true;
  return ok;
}

// O termo salvo no banco (só nome e data) e a mudança que espera o Salvar:
// null (nada mudou), 'remover' ou o arquivo escolhido, com os bytes.
// É um shallowRef porque os bytes do arquivo não podem virar proxy do Vue: o IPC não clona proxy.
const termoSalvo = ref(null);
const termoPendente = shallowRef(null);

const retrato = () => JSON.stringify(dados.value);
const retratoSalvo = ref(retrato());
const pendente = computed(
  () => editando.value && (retrato() !== retratoSalvo.value || termoPendente.value !== null)
);
watch(pendente, (valor) => emit('alteracao-pendente', valor));

// Se a seção some (caixa de menor de idade desmarcada), a ficha não pode ficar achando que há algo pendente.
onBeforeUnmount(() => emit('alteracao-pendente', false));

// O termo que aparece na tela: o escolhido agora, se houver, ou o que já estava salvo.
const termoAtual = computed(() => {
  if (termoPendente.value === 'remover') return null;
  if (termoPendente.value) return { nome: termoPendente.value.nome, novo: true };
  return termoSalvo.value ? { ...termoSalvo.value, novo: false } : null;
});
const removendo = computed(() => termoPendente.value === 'remover');

const dataBR = (data) => (data ? data.slice(0, 10).split('-').reverse().join('/') : '');

async function carregar() {
  const r = await window.api.responsavel.obter(props.pacienteId);
  dados.value = vazio();
  if (r) for (const c of CAMPOS) dados.value[c] = r[c] ?? '';
  existe.value = !!r;
  termoSalvo.value = r?.termo_nome ? { nome: r.termo_nome, anexadoEm: r.termo_anexado_em } : null;
  termoPendente.value = null;
  retratoSalvo.value = retrato();
  tentou.value = false;
  // Sem responsável salvo, a seção já abre para preenchimento.
  editando.value = !r;
}

onMounted(() => {
  if (!novo) executar(carregar);
});

async function executar(acao) {
  erro.value = '';
  try {
    await acao();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}

function temConteudo() {
  return CAMPOS.some((c) => dados.value[c].trim()) || termoPendente.value !== null;
}

function salvar() {
  if (!conferir()) return;
  executar(async () => {
    // A cópia ({ ...dados }) tira o proxy do Vue, que o IPC não consegue enviar.
    await window.api.responsavel.salvar(props.pacienteId, { ...dados.value }, termoPendente.value);
    await carregar();
  });
}

// Descarta o que foi digitado e volta ao que está salvo; com alterações, pede confirmação antes.
function pedirCancelamento() {
  if (pendente.value) confirmandoCancelamento.value = true;
  else executar(carregar);
}

function descartar() {
  confirmandoCancelamento.value = false;
  executar(carregar);
}

// Usada pela ficha ao criar um paciente novo. Se a seção estiver vazia, não há nada a gravar.
async function salvarPara(id) {
  if (!temConteudo()) return;
  await window.api.responsavel.salvar(id, { ...dados.value }, termoPendente.value);
}

defineExpose({ salvarPara });

// O arquivo só é lido aqui; quem grava no banco é o Salvar da seção.
function anexar() {
  executar(async () => {
    const arquivo = await window.api.termo.escolher();
    if (arquivo) termoPendente.value = arquivo;
  });
}

function remover() {
  // Sem termo salvo, remover é só desistir do arquivo escolhido.
  termoPendente.value = termoSalvo.value ? 'remover' : null;
}

function abrir() {
  executar(() => window.api.termo.abrir(props.pacienteId));
}

// O documento a ser assinado ainda será definido.
function gerarTermo() {
  erro.value = 'O termo de autorização ainda não está disponível';
}
</script>

<template>
  <div class="bloco">
    <!-- "sem-quebra": o título e o botão do cabeçalho ficam sempre na mesma linha. -->
    <Colapsavel v-model:aberto="aberto" class="sem-quebra" titulo="Dados do responsável">
      <template v-if="!novo && !editando" #acoes>
        <div class="acoes">
          <button type="button" class="principal" @click="gerarTermo">Gerar termo</button>
        </div>
      </template>

      <p v-if="erro" class="erro aviso">{{ erro }}</p>

      <div class="grade">
        <label class="largo">Nome completo do responsável
          <input v-model="dados.nome_completo" :disabled="!editando" />
        </label>
        <label>CPF do responsável
          <CampoMascara v-model="dados.cpf" tipo="cpf" :disabled="!editando" />
        </label>
        <label>Data de nascimento do responsável
          <CampoData v-model="dados.data_nascimento" :disabled="!editando" />
        </label>
        <label>Cidade/Estado do responsável
          <input v-model="dados.cidade_estado" :disabled="!editando" />
        </label>
        <label>Contato do responsável
          <CampoMascara v-model="dados.contato" tipo="telefone" :disabled="!editando" />
        </label>
        <label class="largo">Endereço completo do responsável
          <input v-model="dados.endereco" :disabled="!editando" />
        </label>

<div class="largo termo">
  <span class="rotulo">Termo de autorização assinado</span>
  <div class="termo-linha">
    <span v-if="termoAtual" class="termo-texto termo-nome" :title="termoAtual.nome">
      <span class="termo-arquivo">{{ termoAtual.nome }}</span>
      <small v-if="termoAtual.novo">será anexado ao salvar</small>
      <small v-else-if="termoAtual.anexadoEm">anexado em {{ dataBR(termoAtual.anexadoEm) }}</small>
    </span>
    <span v-else-if="removendo" class="termo-texto vazio">O termo será removido ao salvar</span>
    <span v-else class="termo-texto vazio">Nenhum termo anexado</span>

    <div class="termo-botoes">
      <template v-if="editando">
        <button v-if="termoAtual" type="button" class="perigo" @click="remover">Remover</button>
        <button type="button" @click="anexar">{{ termoAtual ? 'Substituir' : 'Anexar termo assinado' }}</button>
      </template>
      <button v-else-if="termoAtual" type="button" @click="abrir">Abrir</button>
    </div>
  </div>
</div>
      </div>

      <!-- Um paciente novo grava o responsável junto com a ficha, então não tem botões aqui. -->
      <div v-if="!novo" class="acoes rodape">
        <template v-if="editando">
          <button v-if="existe" key="cancelar" type="button" @click="pedirCancelamento">Cancelar</button>
          <button key="salvar" type="button" class="principal" @click="salvar">Salvar</button>
        </template>
        <button v-else key="editar" type="button" class="principal" @click="editando = true">Editar</button>
      </div>
    </Colapsavel>

    <Confirmacao
      v-if="confirmandoCancelamento"
      texto="Há alterações que não foram salvas. Se cancelar agora, elas serão perdidas."
      rotulo-cancelar="Continuar editando"
      rotulo-confirmar="Descartar alterações"
      @cancelar="confirmandoCancelamento = false"
      @confirmar="descartar"
    />
  </div>
</template>

<style scoped>
.aviso {
  margin-bottom: 12px;
}

.termo {
  gap: 6px;
}

/* Altura fixa: o que muda dentro da caixa (nome do arquivo, botões) nunca muda o tamanho do campo.
   Textos longos são cortados com reticências e os botões não quebram de linha. */
.termo-linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 60px;
  padding: 0 12px;
  border: 1px dashed var(--borda-forte);
  border-radius: 10px;
  background: var(--campo);
  color: var(--texto);
  font-size: 14px;
}

.termo-texto {
  flex: 1 1 0;
  min-width: 0;
}

.termo-nome {
  display: flex;
  flex-direction: column;
}

.termo-arquivo,
.termo-nome small,
.termo-texto.vazio {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.termo-nome small {
  font-size: 12px;
  color: var(--texto-suave);
}

.termo-botoes {
  display: flex;
  flex: none;
  gap: 8px;
}

.termo-botoes button {
  height: 30px;
  padding: 0 12px;
  font-size: 13px;
}

/* A caixa do termo tem o mesmo fundo que o botão ganha ao passar o mouse; aqui o brilho é um tom acima.
   O "Remover" mantém o brilho vermelho dele. */
.termo-botoes button:not(.perigo):hover {
  background: var(--borda);
}
</style>