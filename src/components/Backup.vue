<script setup>
// Janela de backup: pasta escolhida, backup manual e carregar backup.
import { ref, onMounted } from 'vue';
import { mensagemDeErro } from '../utilitarios.js';
import ConfirmarBackup from './ConfirmarBackup.vue';

const emit = defineEmits(['fechar']);
const estado = ref({ pasta: '', ultimoBackupEm: '', aviso: '' });
const erro = ref('');
const feito = ref('');
const ocupado = ref(false);
// Backup escolhido e já conferido, esperando a confirmação do usuário.
const backupEscolhido = ref(null);

async function carregarEstado() {
  estado.value = await window.api.backup.estado();
}

onMounted(carregarEstado);

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Escolher pasta e fazer backup seguem o mesmo roteiro; a ação devolve false quando o usuário cancela a janela de arquivos.
async function executar(acao, mensagem) {
  erro.value = '';
  feito.value = '';
  ocupado.value = true;
  try {
    const resultado = await acao();
    if (resultado !== false) feito.value = mensagem;
  } catch (e) {
    erro.value = mensagemDeErro(e);
  } finally {
    ocupado.value = false;
    carregarEstado().catch(() => {});
  }
}

const escolherPasta = () => executar(() => window.api.backup.escolherPasta(), 'Pasta escolhida e primeiro backup feito');
const fazerAgora = () => executar(() => window.api.backup.agora(), 'Backup feito');

// Carregar backup em duas etapas: o app abre o seletor e confere o arquivo; a confirmação
// aparece aqui na tela e só depois da resposta a troca acontece.
async function carregar() {
  erro.value = '';
  feito.value = '';
  ocupado.value = true;
  try {
    const dados = await window.api.backup.escolherArquivo();
    if (dados) backupEscolhido.value = dados;
  } catch (e) {
    erro.value = mensagemDeErro(e);
  } finally {
    ocupado.value = false;
  }
}

async function cancelarCarregar() {
  backupEscolhido.value = null;
  await window.api.backup.cancelarCarregar().catch(() => {});
}

async function confirmarCarregar() {
  backupEscolhido.value = null;
  ocupado.value = true;
  try {
    // Se a troca acontecer, o app reinicia e esta janela some junto.
    await window.api.backup.confirmarCarregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
    ocupado.value = false;
  }
}
</script>

<template>
  <div class="fundo">
    <div class="janela janela-dados janela-backup">
      <h3>Backup</h3>
      <p class="vazio justificado">
        O backup guarda o banco e a chave de acesso juntos, num arquivo só. Ele é feito sozinho ao abrir e ao
        fechar o app, quando algo mudou desde o último, e nenhuma cópia é apagada. Vale escolher uma pasta
        fora deste computador, como um HD externo ou um serviço de nuvem.
      </p>

      <div class="campo">
        <span>Pasta dos backups</span>
        <div class="campo-pasta">
          <input
            readonly
            :value="estado.pasta"
            :title="estado.pasta"
            placeholder="Nenhuma pasta escolhida"
          />
          <button
            type="button"
            class="botao-pasta"
            :class="{ destaque: !estado.pasta }"
            :title="estado.pasta ? 'Trocar pasta' : 'Escolher pasta'"
            :aria-label="estado.pasta ? 'Trocar pasta' : 'Escolher pasta'"
            :disabled="ocupado"
            @click="escolherPasta"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      <p v-if="estado.ultimoBackupEm" class="vazio ultimo">Último backup: {{ formatarData(estado.ultimoBackupEm) }}</p>
      <p v-if="estado.aviso" class="erro">{{ estado.aviso }}</p>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <p v-if="feito">{{ feito }}</p>

      <div class="acoes">
        <button type="button" class="perigo" :disabled="ocupado" @click="carregar">Carregar backup</button>
        <button type="button" @click="emit('fechar')">Voltar</button>
        <button type="button" class="principal" :disabled="ocupado || !estado.pasta" @click="fazerAgora">Fazer backup</button>
      </div>
    </div>

    <ConfirmarBackup
      v-if="backupEscolhido"
      :dados="backupEscolhido"
      @cancelar="cancelarCarregar"
      @confirmar="confirmarCarregar"
    />
  </div>
</template>

<style scoped>
/* Um pouco mais larga que as outras janelas, para os três botões caberem numa linha. */
.janela-backup {
  width: 420px;
}

.justificado {
  text-align: justify;
}

.ultimo {
  font-size: 13px;
}

/* Campo do endereço e botão de pasta lado a lado, sem espaço entre eles:
   o botão ocupa a altura toda do campo e herda os cantos arredondados da direita. */
.campo-pasta {
  display: flex;
}

.campo-pasta input {
  flex: 1;
  min-width: 0;
  border-radius: 10px 0 0 10px;
  /* O endereço é só para leitura: o cursor não sugere digitação. */
  cursor: default;
}

.botao-pasta {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  padding: 0;
  /* margem negativa para a borda do botão cobrir a borda direita do campo, sem linha dupla */
  margin-left: -1px;
  border: 1px solid var(--borda);
  border-radius: 0 10px 10px 0;
  background: var(--roxo-fundo);
  color: var(--roxo);
}
.botao-pasta:hover {
  background: var(--borda);
}
/* Sem pasta escolhida, o botão chama a atenção: é o único passo obrigatório. */
.botao-pasta.destaque {
  border-color: var(--roxo);
  background: var(--roxo);
  color: var(--sobre-roxo);
}
.botao-pasta.destaque:hover {
  background: var(--roxo-hover);
  border-color: var(--roxo-hover);
}

/* Botão desativado: apagado e sem reação ao mouse. */
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:disabled:hover {
  background: transparent;
}
button.principal:disabled:hover {
  background: var(--roxo);
  border-color: var(--roxo);
}
.botao-pasta:disabled:hover {
  background: var(--roxo-fundo);
}
.botao-pasta.destaque:disabled:hover {
  background: var(--roxo);
  border-color: var(--roxo);
}
</style>