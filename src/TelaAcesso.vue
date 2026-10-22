<script setup>
import { ref, onMounted } from 'vue';
import { mensagemDeErro } from './utilitarios.js';
import ConfirmarBackup from './components/ConfirmarBackup.vue';
import CampoSenha from './components/CampoSenha.vue';
import { ativarGlobais } from './globais.js';

const emit = defineEmits(['liberado']);

// criar | entrar | recuperar | chave
const modo = ref('entrar');
const senha = ref('');
const confirmacao = ref('');
const chaveDigitada = ref('');
const chaveGerada = ref('');
const salvou = ref(false);
const copiado = ref(false);
const erro = ref('');
const ocupado = ref(false);

onMounted(async () => {
  ativarGlobais();
  modo.value = (await window.api.acesso.estado()) === 'criar' ? 'criar' : 'entrar';
});

function trocarModo(novo) {
  modo.value = novo;
  senha.value = '';
  confirmacao.value = '';
  chaveDigitada.value = '';
  erro.value = '';
}

function validarNovaSenha() {
  if (!senha.value) return 'Digite uma senha';
  if (senha.value !== confirmacao.value) return 'As senhas não são iguais';
  return '';
}

// Gera a chave de recuperação, mas ainda não grava nada em disco.
async function criar() {
  erro.value = validarNovaSenha();
  if (erro.value) return;
  ocupado.value = true;
  try {
    chaveGerada.value = await window.api.acesso.preparar(senha.value);
    salvou.value = false;
    copiado.value = false;
    modo.value = 'chave';
  } catch {
    erro.value = 'Não foi possível criar a senha';
  } finally {
    ocupado.value = false;
  }
}

// Descarta a chave gerada. Se o usuário continuar de novo, uma chave nova é gerada.
async function voltarParaSenha() {
  try {
    await window.api.acesso.cancelar();
  } catch {
    // nada foi gravado, então não há o que desfazer
  }
  chaveGerada.value = '';
  salvou.value = false;
  erro.value = '';
  modo.value = 'criar';
}

// Só aqui a senha e a chave de recuperação passam a valer.
async function confirmar() {
  erro.value = '';
  ocupado.value = true;
  try {
    await window.api.acesso.confirmar();
    senha.value = '';
    confirmacao.value = '';
    emit('liberado');
  } catch {
    erro.value = 'Não foi possível concluir, tente de novo';
  } finally {
    ocupado.value = false;
  }
}

async function entrar() {
  erro.value = '';
  ocupado.value = true;
  try {
    if (await window.api.acesso.entrar(senha.value)) emit('liberado');
    else erro.value = 'Senha incorreta';
  } catch {
    erro.value = 'Não foi possível abrir o app';
  } finally {
    ocupado.value = false;
  }
}

async function recuperar() {
  erro.value = validarNovaSenha();
  if (erro.value) return;
  ocupado.value = true;
  try {
    if (await window.api.acesso.recuperar(chaveDigitada.value, senha.value)) emit('liberado');
    else erro.value = 'Chave de recuperação incorreta';
  } catch {
    erro.value = 'Não foi possível trocar a senha';
  } finally {
    ocupado.value = false;
  }
}

// Carregar backup em duas etapas: o app abre o seletor e confere o arquivo; a confirmação
// aparece aqui na tela e só depois da resposta a troca acontece (o app reinicia ao terminar).
const backupEscolhido = ref(null);

async function carregarBackup() {
  erro.value = '';
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
    await window.api.backup.confirmarCarregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
    ocupado.value = false;
  }
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(chaveGerada.value);
    copiado.value = true;
    setTimeout(() => (copiado.value = false), 1500);
  } catch {
    // se a cópia falhar, a chave continua visível na tela para anotar
  }
}
</script>

<template>
  <main class="fundo">
    <form v-if="modo === 'criar'" class="janela janela-dados" @submit.prevent="criar">
      <h3>Prontuários</h3>
      <p class="vazio">Crie uma senha para proteger os prontuários. Ela será pedida toda vez que o app for aberto.</p>
      <label>Senha
        <CampoSenha v-model="senha" autocomplete="new-password" autofocus />
      </label>
      <label>Repita a senha
        <CampoSenha v-model="confirmacao" autocomplete="new-password" />
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" class="link" :disabled="ocupado" @click="carregarBackup">Carregar backup</button>
        <button type="submit" class="principal" :disabled="ocupado">Criar senha</button>
      </div>
    </form>

    <form v-else-if="modo === 'entrar'" class="janela janela-dados" @submit.prevent="entrar">
      <h3>Prontuários</h3>
      <label>Senha
        <CampoSenha v-model="senha" autocomplete="current-password" autofocus />
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" class="link" :disabled="ocupado" @click="carregarBackup">Carregar backup</button>
        <button type="button" @click="trocarModo('recuperar')">Esqueci a senha</button>
        <button type="submit" class="principal" :disabled="ocupado">Entrar</button>
      </div>
    </form>

    <form v-else-if="modo === 'recuperar'" class="janela janela-dados" @submit.prevent="recuperar">
      <h3>Recuperar acesso</h3>
      <p class="vazio">Digite a chave de recuperação e escolha uma senha nova.</p>
      <label>Chave de recuperação
        <input v-model="chaveDigitada" autocomplete="off" spellcheck="false" autofocus />
      </label>
      <label>Senha nova
        <CampoSenha v-model="senha" autocomplete="new-password" />
      </label>
      <label>Repita a senha nova
        <CampoSenha v-model="confirmacao" autocomplete="new-password" />
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" @click="trocarModo('entrar')">Voltar</button>
        <button type="submit" class="principal" :disabled="ocupado">Trocar senha e entrar</button>
      </div>
    </form>

    <div v-else-if="modo === 'chave'" class="janela janela-dados">
      <h3>Chave de recuperação</h3>
      <p class="vazio justificado">
        Se a senha for esquecida, esta chave é a única forma de abrir os prontuários. Guarde num
        lugar seguro, fora do computador (papel ou gerenciador de senhas). Ela não será mostrada de novo.
      </p>
      <div class="chave-linha">
        <p class="chave">{{ chaveGerada }}</p>
        <button type="button" class="icone" :title="copiado ? 'Copiado' : 'Copiar chave'" aria-label="Copiar chave" @click="copiar">
          <svg v-if="!copiado" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </button>
      </div>
      <label class="confirmar">
        <input type="checkbox" v-model="salvou" />
        <span>Guardei a chave em um lugar seguro</span>
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" :disabled="ocupado" @click="voltarParaSenha">Voltar</button>
        <button type="button" class="principal" :disabled="!salvou || ocupado" @click="confirmar">Continuar</button>
      </div>
    </div>
    <ConfirmarBackup
      v-if="backupEscolhido"
      :dados="backupEscolhido"
      @cancelar="cancelarCarregar"
      @confirmar="confirmarCarregar"
    />
  </main>
</template>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* "Carregar backup": texto clicável, sem caixa, no canto esquerdo da linha de botões.
   O tamanho da letra é o mesmo dos rótulos dos campos (13px). */
button.link {
  margin-right: auto;
  padding: 6px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--texto-suave);
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
button.link:hover:not(:disabled) {
  background: transparent;
  color: var(--roxo);
}

.chave {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--borda);
  border-radius: 10px;
  background: var(--campo);
  color: var(--texto);
  font-family: Consolas, monospace;
  font-size: 15px;
  text-align: center;
  overflow-wrap: anywhere;
}

/* A caixinha em si é estilizada no estilo.css, igual em todo o app. */
.confirmar {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--texto);
  cursor: pointer;
}

.justificado {
  text-align: justify;
}

.chave-linha {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.chave-linha .chave {
  flex: 1;
  min-width: 0;
}
button.icone {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 46px;
  padding: 0;
  border-radius: 10px;
}
</style>