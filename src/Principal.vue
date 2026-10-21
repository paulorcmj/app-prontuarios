<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import ListaPacientes from './components/ListaPacientes.vue';
import FichaPaciente from './components/FichaPaciente.vue';
import Confirmacao from './components/Confirmacao.vue';
import Profissional from './components/Profissional.vue';

const situacao = ref('ativo');
const busca = ref('');
const pacientes = ref([]);
// id do paciente aberto, 'novo' para cadastro, ou null quando não há nenhum
const aberto = ref(null);

// Dados do profissional (perfil da lateral) e janela de configurações.
const profissional = ref({ nome: '', crp: '', email: '', foto: '' });
const dadosProfissionalAberto = ref(false);

// ---- Barra lateral ----
// A largura escolhida pelo usuário fica guardada; se não houver, vale a largura natural.
// A lateral abre sempre aberta: só a largura é lembrada. Ctrl+0 esquece a largura guardada.
// Larguras em pixels: o mínimo e a natural. O máximo é simétrico em torno da natural.
const LARGURA_MINIMA = 249;
const LARGURA_BASE = 284;
// Espaço que a ficha precisa para não quebrar; a lateral nunca toma esse espaço.
const LARGURA_FICHA_MIN = 400;
const CHAVE_LARGURA = 'largura-lateral';

// A lateral pode crescer tanto quanto pode encolher a partir da largura natural.
// Em janelas pequenas, o limite também respeita o espaço que a ficha precisa.
const larguraJanela = ref(window.innerWidth);
const larguraMaxima = computed(() => {
  const simetrica = LARGURA_BASE + (LARGURA_BASE - LARGURA_MINIMA);
  return Math.max(LARGURA_MINIMA, Math.min(simetrica, larguraJanela.value - LARGURA_FICHA_MIN));
});

function lerLarguraSalva() {
  try {
    const numero = Number(localStorage.getItem(CHAVE_LARGURA));
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  } catch {
    return null;
  }
}

function guardarLargura() {
  try {
    localStorage.setItem(CHAVE_LARGURA, String(larguraEscolhida.value));
  } catch {
    // sem armazenamento, a largura só vale até fechar o app
  }
}

// Esquece a largura guardada: a lateral volta à largura natural.
function restaurarLargura() {
  larguraEscolhida.value = null;
  try {
    localStorage.removeItem(CHAVE_LARGURA);
  } catch {
    // sem armazenamento, não há o que esquecer
  }
}

const larguraEscolhida = ref(lerLarguraSalva());
const lateralAberta = ref(true);
// Se a janela encolher, a lateral encolhe junto, sem perder o tamanho escolhido.
const larguraEfetiva = computed(() =>
  Math.min(larguraMaxima.value, Math.max(LARGURA_MINIMA, larguraEscolhida.value ?? LARGURA_BASE))
);
const colunas = computed(() => `${lateralAberta.value ? larguraEfetiva.value : 0}px minmax(0, 1fr)`);

function aoRedimensionarJanela() {
  larguraJanela.value = window.innerWidth;
}

// A lateral começa na borda esquerda da janela, então a largura é a posição do mouse.
// Um clique na borda, sem arrastar, fecha a lateral.
function comecarArraste(evento) {
  esconderDica();
  const alca = evento.currentTarget;
  const inicioX = evento.clientX;
  let moveu = false;
  alca.setPointerCapture(evento.pointerId);
  const mover = (e) => {
    if (Math.abs(e.clientX - inicioX) > 3) moveu = true;
    if (moveu) {
      larguraEscolhida.value = Math.min(larguraMaxima.value, Math.max(LARGURA_MINIMA, e.clientX));
    }
  };
  const soltar = () => {
    alca.removeEventListener('pointermove', mover);
    alca.removeEventListener('pointerup', soltar);
    alca.removeEventListener('pointercancel', soltar);
    if (moveu) guardarLargura();
    else lateralAberta.value = false;
  };
  alca.addEventListener('pointermove', mover);
  alca.addEventListener('pointerup', soltar);
  alca.addEventListener('pointercancel', soltar);
}

// Dica ao passar o mouse na borda, depois de uma pequena pausa.
const dicaVisivel = ref(false);
const dicaY = ref(0);
let temporizadorDica = null;

function mostrarDica(evento) {
  const y = evento.clientY;
  clearTimeout(temporizadorDica);
  temporizadorDica = setTimeout(() => {
    dicaY.value = Math.max(8, y - 28);
    dicaVisivel.value = true;
  }, 350);
}

function esconderDica() {
  clearTimeout(temporizadorDica);
  dicaVisivel.value = false;
}

// Ctrl+B abre e fecha a lateral (como no VS Code); Ctrl+0 volta à largura natural.
function aoPressionarTecla(evento) {
  if (!evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  if (evento.key.toLowerCase() === 'b') {
    evento.preventDefault();
    lateralAberta.value = !lateralAberta.value;
  } else if (evento.key === '0') {
    evento.preventDefault();
    restaurarLargura();
  }
}

// ---- Pacientes ----
// A ficha avisa quando há alterações que ainda não foram salvas.
const alteracaoPendente = ref(false);
// Navegação que ficou esperando a resposta do aviso de saída.
const saidaPendente = ref(null);

async function carregarLista() {
  pacientes.value = await window.api.pacientes.listar(situacao.value, busca.value);
}

async function carregarProfissional() {
  profissional.value = await window.api.profissional.obter();
}

watch([situacao, busca], carregarLista);
// Ao trocar de ficha, a anterior deixa de existir e o aviso dela também.
watch(aberto, () => {
  alteracaoPendente.value = false;
});
// Mantém o app informado, para o aviso valer também ao fechar a janela.
watch(alteracaoPendente, (valor) => window.api.janela.avisarAlteracoes(valor));

// Protege contra fechar o app ou recarregar a tela com alterações sem salvar.
// Quem mostra o aviso ao usuário é o main.js (evento will-prevent-unload).
function avisarAoFechar(evento) {
  if (!alteracaoPendente.value) return;
  evento.preventDefault();
  evento.returnValue = false;
}

onMounted(() => {
  carregarLista();
  carregarProfissional();
  window.addEventListener('beforeunload', avisarAoFechar);
  window.addEventListener('keydown', aoPressionarTecla);
  window.addEventListener('resize', aoRedimensionarJanela);
  window.addEventListener('pedir-saida', aoPedirSaida);
  window.api.janela.aoPedirFechar(aoPedirFechar);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', aoPressionarTecla);
  window.removeEventListener('resize', aoRedimensionarJanela);
  window.removeEventListener('pedir-saida', aoPedirSaida);
});

// Faz a navegação, ou pede confirmação antes se houver alterações sem salvar.
function navegar(acao) {
  if (alteracaoPendente.value) saidaPendente.value = acao;
  else acao();
}

function confirmarSaida() {
  const acao = saidaPendente.value;
  saidaPendente.value = null;
  alteracaoPendente.value = false;
  acao();
}

// Vem do botão "Sair" do menu do perfil. Passa pelo mesmo aviso de alterações
// não salvas das outras navegações; confirmada a saída, tranca o app e recarrega a tela.
function aoPedirSaida() {
  navegar(async () => {
    await window.api.acesso.sair();
    window.location.reload();
  });
}

// Vem do Alt+F4 ou do X da janela quando há alterações sem salvar.
// Usa o mesmo aviso das outras saídas; confirmado, o app fecha de verdade.
function aoPedirFechar() {
  saidaPendente.value = () => window.api.janela.fecharMesmoAssim();
}

function trocarAba(nova) {
  navegar(() => {
    situacao.value = nova;
    aberto.value = null;
  });
}

function abrirPaciente(id) {
  if (id === aberto.value) return;
  navegar(() => {
    aberto.value = id;
  });
}

function novoPaciente() {
  if (aberto.value === 'novo') return;
  navegar(() => {
    aberto.value = 'novo';
  });
}

async function aoSalvar(id) {
  await carregarLista();
  aberto.value = id;
}

// Arquivar, desarquivar e excluir tiram o paciente da lista atual.
async function aoMudarSituacao() {
  aberto.value = null;
  await carregarLista();
}
</script>

<template>
  <div class="app" :style="{ gridTemplateColumns: colunas }">
    <!-- A lateral só é escondida (v-show), sem desmontar: busca, ordem e perfil continuam como estavam. -->
    <ListaPacientes
      v-show="lateralAberta"
      v-model:busca="busca"
      :situacao="situacao"
      :pacientes="pacientes"
      :aberto="aberto"
      :profissional="profissional"
      @trocar-aba="trocarAba"
      @abrir="abrirPaciente"
      @novo="novoPaciente"
      @configuracoes="dadosProfissionalAberto = true"
    />
    <main class="painel">
      <FichaPaciente
        v-if="aberto !== null"
        :key="aberto"
        :paciente-id="aberto"
        @salvo="aoSalvar"
        @mudou-situacao="aoMudarSituacao"
        @alteracao-pendente="alteracaoPendente = $event"
      />
      <p v-else class="vazio">Selecione um paciente ou cadastre um novo.</p>
    </main>

    <!-- Borda arrastável da lateral, sem indicador visual: só o cursor muda e aparece uma dica. -->
    <div
      v-show="lateralAberta"
      class="alca"
      :style="{ left: larguraEfetiva - 4 + 'px' }"
      @pointerdown="comecarArraste"
      @pointerenter="mostrarDica"
      @pointerleave="esconderDica"
    ></div>
    <div v-if="dicaVisivel && lateralAberta" class="dica" :style="{ left: larguraEfetiva + 14 + 'px', top: dicaY + 'px' }">
      <div class="dica-linha"><span>Ocultar barra lateral</span><kbd>Ctrl+B</kbd></div>
      <div class="dica-sub">Arraste para redimensionar</div>
    </div>
    <!-- Abinha que se projeta para fora da lateral; fechada, fica colada na borda da janela. -->
    <button
      type="button"
      class="aba-lateral"
      :class="{ fechada: !lateralAberta }"
      :style="{ left: lateralAberta ? larguraEfetiva - 1 + 'px' : '0px' }"
      :title="lateralAberta ? 'Ocultar barra lateral (Ctrl+B)' : 'Mostrar barra lateral (Ctrl+B)'"
      :aria-label="lateralAberta ? 'Ocultar barra lateral' : 'Mostrar barra lateral'"
      @click="lateralAberta = !lateralAberta"
    >
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.5 2.5L4 6l3.5 3.5" />
      </svg>
    </button>

    <Confirmacao
      v-if="saidaPendente"
      texto="Há alterações que não foram salvas. Se sair agora, elas serão perdidas."
      rotulo-cancelar="Continuar editando"
      rotulo-confirmar="Sair sem salvar"
      @cancelar="saidaPendente = null"
      @confirmar="confirmarSaida"
    />
    <Profissional
      v-if="dadosProfissionalAberto"
      @salvo="carregarProfissional"
      @fechar="dadosProfissionalAberto = false"
    />
  </div>
</template>