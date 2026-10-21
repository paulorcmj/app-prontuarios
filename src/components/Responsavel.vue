<script setup>
// Seção do responsável, para paciente menor de idade. Num paciente já cadastrado ela tem
// botões próprios (editar, salvar, gerar termo). Num paciente novo não há onde gravar ainda:
// os dados ficam na tela e a ficha chama salvarPara() depois de criar o paciente.
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import Colapsavel from './Colapsavel.vue';
import { mensagemDeErro } from '../utilitarios.js';

const props = defineProps({ pacienteId: [Number, String] });
const emit = defineEmits(['alteracao-pendente']);

const CAMPOS = ['nome_completo', 'data_nascimento', 'cpf', 'endereco', 'cidade_estado'];
const vazio = () => Object.fromEntries(CAMPOS.map((c) => [c, '']));

const novo = props.pacienteId === 'novo';
const dados = ref(vazio());
const aberto = ref(true);
const editando = ref(novo);
// Já existe um responsável salvo para este paciente?
const existe = ref(false);
const erro = ref('');

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

function conferirNome() {
  if (!dados.value.nome_completo.trim()) throw new Error('O nome do responsável é obrigatório');
}

function temConteudo() {
  return CAMPOS.some((c) => dados.value[c].trim()) || termoPendente.value !== null;
}

function salvar() {
  executar(async () => {
    conferirNome();
    // A cópia ({ ...dados }) tira o proxy do Vue, que o IPC não consegue enviar.
    await window.api.responsavel.salvar(props.pacienteId, { ...dados.value }, termoPendente.value);
    await carregar();
  });
}

function cancelar() {
  executar(carregar);
}

// Usadas pela ficha ao criar um paciente novo. Se a seção estiver vazia, não há nada a gravar;
// se tiver algo, o nome é obrigatório e é conferido antes de o paciente ser criado.
function conferir() {
  if (temConteudo()) conferirNome();
}

async function salvarPara(id) {
  if (!temConteudo()) return;
  conferirNome();
  await window.api.responsavel.salvar(id, { ...dados.value }, termoPendente.value);
}

defineExpose({ conferir, salvarPara });

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
    <Colapsavel v-model:aberto="aberto" titulo="Responsável">
      <template v-if="!novo" #acoes>
        <div class="acoes">
          <template v-if="editando">
            <button key="salvar" type="button" class="principal" @click="salvar">Salvar</button>
            <button v-if="existe" key="cancelar" type="button" @click="cancelar">Cancelar</button>
          </template>
          <button v-else key="editar" type="button" class="principal" @click="editando = true">Editar</button>
          <button type="button" @click="gerarTermo">Gerar termo</button>
        </div>
      </template>

      <p v-if="erro" class="erro aviso">{{ erro }}</p>

      <div class="grade">
        <label class="largo">Nome completo do responsável
          <input v-model="dados.nome_completo" :disabled="!editando" />
        </label>
        <label>Data de nascimento do responsável
          <input v-model="dados.data_nascimento" type="date" :disabled="!editando" />
        </label>
        <label>CPF do responsável
          <input v-model="dados.cpf" :disabled="!editando" />
        </label>
        <label class="largo">Endereço completo do responsável
          <input v-model="dados.endereco" :disabled="!editando" />
        </label>
        <label class="largo">Cidade/Estado do responsável
          <input v-model="dados.cidade_estado" :disabled="!editando" />
        </label>

        <div class="largo termo">
          <span class="rotulo">Termo de autorização assinado</span>
          <div class="termo-linha">
            <span v-if="termoAtual" class="termo-nome" :title="termoAtual.nome">
              {{ termoAtual.nome }}
              <small v-if="termoAtual.novo">será anexado ao salvar</small>
              <small v-else-if="termoAtual.anexadoEm">anexado em {{ dataBR(termoAtual.anexadoEm) }}</small>
            </span>
            <span v-else-if="removendo" class="vazio">O termo será removido ao salvar</span>
            <span v-else class="vazio">Nenhum termo anexado</span>

            <div class="termo-botoes">
              <template v-if="editando">
                <button type="button" @click="anexar">{{ termoAtual ? 'Substituir' : 'Anexar termo assinado' }}</button>
                <button v-if="termoAtual" type="button" class="perigo" @click="remover">Remover</button>
              </template>
              <button v-else-if="termoAtual" type="button" @click="abrir">Abrir</button>
            </div>
          </div>
        </div>
      </div>
    </Colapsavel>
  </div>
</template>

<style scoped>
.aviso {
  margin-bottom: 12px;
}

.termo {
  gap: 6px;
}

/* Caixa tracejada, no mesmo estilo dos campos que guardam algo que não é texto. */
.termo-linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 10px 12px;
  border: 1px dashed var(--borda-forte);
  border-radius: 10px;
  background: var(--campo);
  color: var(--texto);
  font-size: 14px;
}

.termo-nome {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
}

.termo-nome small {
  font-size: 12px;
  color: var(--texto-suave);
}

.termo-botoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.termo-botoes button {
  padding: 4px 12px;
  font-size: 13px;
}
</style>