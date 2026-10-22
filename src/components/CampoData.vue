<script setup>
// Campo de data (ou data e hora) digitado com máscara, com um calendário no estilo do app.
// O valor que entra e sai é o do banco: "AAAA-MM-DD", ou "AAAA-MM-DDTHH:MM" com a prop "hora".
// Enquanto a data está incompleta ou inválida, o valor é vazio e o campo fica com a borda de erro.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import CampoMascara from './CampoMascara.vue';
import { isoValido } from '../utilitarios.js';

const props = defineProps({ hora: Boolean, disabled: Boolean, id: String });
const modelo = defineModel({ type: String, default: '' });

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const mascara = computed(() => (props.hora ? '##/##/#### ##:##' : '##/##/####'));
const texto = ref('');

const pad = (n) => String(n).padStart(2, '0');
const isoDe = (d) => `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function paraTexto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso ?? '');
  if (!m) return '';
  const data = `${m[3]}/${m[2]}/${m[1]}`;
  return props.hora ? `${data} ${m[4] ?? '00'}:${m[5] ?? '00'}` : data;
}

// Devolve o valor do banco, ou null se o texto não for uma data real.
// Quem decide o que é válido é o Chromium, o mesmo dos campos de data nativos (ver isoValido).
function paraIso(t) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(t);
  if (!m) return null;
  if (props.hora && m[4] === undefined) return null;
  const data = `${m[3]}-${m[2]}-${m[1]}`;
  const iso = props.hora ? `${data}T${m[4]}:${m[5]}` : data;
  return isoValido(iso, props.hora) ? iso : null;
}

// Texto digitado e valor do banco andam juntos; o texto só é refeito quando o valor muda por fora.
watch(modelo, (iso) => {
  if (iso !== (paraIso(texto.value) ?? '')) texto.value = paraTexto(iso);
}, { immediate: true });
watch(texto, (t) => {
  modelo.value = paraIso(t) ?? '';
});

const invalida = computed(() => texto.value.length === mascara.value.length && paraIso(texto.value) === null);

// ---- Calendário ----
const aberto = ref(false);
const aDireita = ref(false);
const vista = ref('dias');
const mes = ref(0);
const ano = ref(0);
const inicioAnos = ref(0);
const raiz = ref(null);

const selecionado = computed(() => modelo.value.slice(0, 10));
const hoje = computed(() => isoDe(new Date()));
const anos = computed(() => Array.from({ length: 12 }, (_, i) => inicioAnos.value + i));

// Sempre 6 semanas, começando no domingo; os dias do mês vizinho aparecem apagados.
const dias = computed(() => {
  const inicio = new Date(ano.value, mes.value, 1);
  inicio.setDate(1 - inicio.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    return { iso: isoDe(d), numero: d.getDate(), fora: d.getMonth() !== mes.value };
  });
});

function alternar() {
  if (aberto.value) {
    aberto.value = false;
    return;
  }
  const m = /^(\d{4})-(\d{2})/.exec(modelo.value);
  const agora = new Date();
  ano.value = m ? Number(m[1]) : agora.getFullYear();
  mes.value = m ? Number(m[2]) - 1 : agora.getMonth();
  vista.value = 'dias';
  // Perto da borda direita da janela, o calendário abre para a esquerda.
  aDireita.value = raiz.value.getBoundingClientRect().left + 290 > window.innerWidth;
  aberto.value = true;
}

function alternarVista() {
  if (vista.value === 'dias') {
    inicioAnos.value = ano.value - (ano.value % 12);
    vista.value = 'anos';
  } else {
    vista.value = 'dias';
  }
}

function anterior() {
  if (vista.value === 'anos') inicioAnos.value -= 12;
  else if (mes.value === 0) {
    mes.value = 11;
    ano.value--;
  } else mes.value--;
}

function proximo() {
  if (vista.value === 'anos') inicioAnos.value += 12;
  else if (mes.value === 11) {
    mes.value = 0;
    ano.value++;
  } else mes.value++;
}

function escolherAno(a) {
  ano.value = a;
  vista.value = 'dias';
}

function escolher(iso) {
  const [a, m, d] = iso.split('-');
  let t = `${d}/${m}/${a}`;
  if (props.hora) {
    // Mantém a hora já digitada, se for válida; sem ela, usa a hora de agora.
    const digitada = texto.value.slice(11, 16);
    const agora = new Date();
    t += ` ${isoValido(`2000-01-01T${digitada}`, true) ? digitada : `${pad(agora.getHours())}:${pad(agora.getMinutes())}`}`;
  }
  texto.value = t;
  aberto.value = false;
}

function limpar() {
  texto.value = '';
  aberto.value = false;
}

// composedPath guarda o caminho do clique mesmo se o botão clicado já saiu da tela (troca de vista).
function aoClicarFora(evento) {
  if (aberto.value && !evento.composedPath().includes(raiz.value)) aberto.value = false;
}

function aoPressionarTecla(evento) {
  if (evento.key === 'Escape') aberto.value = false;
}

onMounted(() => {
  document.addEventListener('click', aoClicarFora);
  document.addEventListener('keydown', aoPressionarTecla);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', aoClicarFora);
  document.removeEventListener('keydown', aoPressionarTecla);
});
</script>

<template>
  <div class="campo-data">
    <div ref="raiz" class="campo-com-botao caixa-botao" :class="{ invalida }">
      <CampoMascara :id="id" v-model="texto" :mascara="mascara" :disabled="disabled" />
      <button
        type="button"
        class="botao-embutido"
        title="Abrir calendário"
        aria-label="Abrir calendário"
        :aria-expanded="aberto"
        :disabled="disabled"
        @click="alternar"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      <div v-if="aberto" class="calendario" :class="{ 'a-direita': aDireita }" role="dialog" aria-label="Calendário">
        <div class="cal-topo">
          <button
            type="button"
            class="cal-titulo"
            :title="vista === 'dias' ? 'Escolher o ano' : 'Voltar aos dias'"
            @click="alternarVista"
          >
            {{ vista === 'dias' ? `${NOMES_MES[mes]} de ${ano}` : `${inicioAnos} – ${inicioAnos + 11}` }}
          </button>
          <div class="cal-setas">
            <button type="button" class="cal-nav" aria-label="Anterior" @click="anterior">
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 2.5L4 6l3.5 3.5" /></svg>
            </button>
            <button type="button" class="cal-nav" aria-label="Próximo" @click="proximo">
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg>
            </button>
          </div>
        </div>

        <div v-if="vista === 'dias'" class="cal-grade">
          <span v-for="(letra, i) in SEMANA" :key="i" class="cal-semana">{{ letra }}</span>
          <button
            v-for="d in dias"
            :key="d.iso"
            type="button"
            class="cal-dia"
            :class="{ fora: d.fora, hoje: d.iso === hoje, escolhido: d.iso === selecionado }"
            @click="escolher(d.iso)"
          >
            {{ d.numero }}
          </button>
        </div>
        <div v-else class="cal-anos">
          <button
            v-for="a in anos"
            :key="a"
            type="button"
            class="cal-ano"
            :class="{ escolhido: a === ano }"
            @click="escolherAno(a)"
          >
            {{ a }}
          </button>
        </div>

        <div class="cal-rodape">
          <button type="button" class="cal-link" @click="limpar">Limpar</button>
          <button type="button" class="cal-link" @click="escolher(hoje)">Hoje</button>
        </div>
      </div>
    </div>
    <span v-if="invalida" class="erro">{{ hora ? 'Data ou hora inválida' : 'Data inválida' }}</span>
  </div>
</template>

<style scoped>
.campo-data {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.calendario {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 25;
  width: 280px;
  padding: 12px;
  border: 1px solid var(--borda-forte);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  color: var(--texto);
  font-size: 14px;
}

.calendario.a-direita {
  left: auto;
  right: 0;
}

.cal-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cal-titulo {
  padding: 4px 8px;
  border-color: transparent;
  border-radius: 8px;
  font-weight: 600;
}

.cal-setas {
  display: flex;
  gap: 4px;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-color: transparent;
  border-radius: 8px;
  color: var(--texto-suave);
}

.cal-nav:hover {
  color: var(--roxo);
}

.cal-grade {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-semana {
  padding: 4px 0;
  text-align: center;
  font-size: 12px;
  color: var(--texto-suave);
}

.cal-dia {
  height: 32px;
  padding: 0;
  border-color: transparent;
  border-radius: 8px;
}

.cal-dia.fora {
  color: var(--texto-suave);
  opacity: 0.6;
}

.cal-dia.hoje {
  border-color: var(--roxo);
}

.cal-anos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.cal-ano {
  height: 36px;
  padding: 0;
  border-color: transparent;
  border-radius: 8px;
}

.cal-dia.escolhido,
.cal-dia.escolhido:hover,
.cal-ano.escolhido,
.cal-ano.escolhido:hover {
  border-color: var(--roxo);
  background: var(--roxo);
  color: var(--sobre-roxo);
  font-weight: 600;
  opacity: 1;
}

.cal-rodape {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.cal-link {
  padding: 4px 8px;
  border-color: transparent;
  border-radius: 8px;
  color: var(--roxo);
  font-size: 13px;
}
</style>