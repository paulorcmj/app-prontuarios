<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import PerfilLateral from './PerfilLateral.vue';

const props = defineProps({
  situacao: String,
  pacientes: Array,
  aberto: [Number, String],
  profissional: Object,
});
defineEmits(['trocar-aba', 'abrir', 'novo', 'configuracoes']);

const busca = defineModel('busca');

const ORDENS = [
  { valor: 'nome-az', rotulo: 'Nome (A–Z)' },
  { valor: 'nome-za', rotulo: 'Nome (Z–A)' },
  { valor: 'cadastro-recente', rotulo: 'Cadastro mais recente' },
  { valor: 'cadastro-antigo', rotulo: 'Cadastro mais antigo' },
  { valor: 'modificacao', rotulo: 'Última modificação' },
  { valor: 'sessao', rotulo: 'Última sessão' },
];

// A ordem escolhida fica guardada para a próxima vez que o app abrir.
const CHAVE_ORDEM = 'ordem-pacientes';

function ordemSalva() {
  try {
    const salva = localStorage.getItem(CHAVE_ORDEM);
    return ORDENS.some((o) => o.valor === salva) ? salva : 'nome-az';
  } catch {
    return 'nome-az';
  }
}

const ordem = ref(ordemSalva());
watch(ordem, (valor) => {
  try {
    localStorage.setItem(CHAVE_ORDEM, valor);
  } catch {
    // sem armazenamento, a ordem só vale até fechar o app
  }
});

// Menu de ordenação (no lugar do seletor nativo, que não aceita o visual do app).
// Fecha ao escolher, ao clicar fora e com Esc.
const ordemAberta = ref(false);
const raizOrdem = ref(null);

function escolherOrdem(valor) {
  ordem.value = valor;
  ordemAberta.value = false;
}

function aoClicarFora(evento) {
  if (raizOrdem.value && !raizOrdem.value.contains(evento.target)) ordemAberta.value = false;
}

function aoPressionarTecla(evento) {
  if (evento.key === 'Escape') ordemAberta.value = false;
}

onMounted(() => {
  document.addEventListener('click', aoClicarFora);
  document.addEventListener('keydown', aoPressionarTecla);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', aoClicarFora);
  document.removeEventListener('keydown', aoPressionarTecla);
});

const comparar = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const nome = (a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR', { sensitivity: 'base' });

// As datas vêm como texto AAAA-MM-DD HH:MM, então comparar o texto já respeita a ordem cronológica.
// O cadastro mais recente é o de maior id. Quem nunca teve sessão fica no fim de "Última sessão".
const COMPARACOES = {
  'nome-az': nome,
  'nome-za': (a, b) => nome(b, a),
  'cadastro-recente': (a, b) => b.id - a.id,
  'cadastro-antigo': (a, b) => a.id - b.id,
  modificacao: (a, b) => comparar(b.modificado_em ?? '', a.modificado_em ?? '') || b.id - a.id,
  sessao: (a, b) => comparar(b.ultima_sessao ?? '', a.ultima_sessao ?? '') || nome(a, b),
};

const ordenados = computed(() => [...props.pacientes].sort(COMPARACOES[ordem.value]));
</script>

<template>
  <aside class="lista">
    <!-- O topo (perfil até "Novo paciente") fica parado; só a lista de pacientes rola. -->
    <div class="lista-topo">
      <PerfilLateral :profissional="profissional" @configuracoes="$emit('configuracoes')" />
      <div class="abas">
        <button :class="{ ativa: situacao === 'ativo' }" @click="$emit('trocar-aba', 'ativo')">Prontuários</button>
        <button :class="{ ativa: situacao === 'arquivado' }" @click="$emit('trocar-aba', 'arquivado')">Arquivo</button>
      </div>
      <div ref="raizOrdem" class="busca-linha">
        <input v-model="busca" type="search" placeholder="Buscar por nome" />
        <button v-if="busca" type="button" class="limpar-busca" title="Limpar busca" aria-label="Limpar busca" @click="busca = ''">
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
        <button
          type="button"
          class="botao-ordenar"
          title="Ordenar pacientes"
          aria-label="Ordenar pacientes"
          :aria-expanded="ordemAberta"
          @click="ordemAberta = !ordemAberta"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
            <path d="M3 5.5h14M3 10h10M3 14.5h6" />
          </svg>
        </button>
        <div v-if="ordemAberta" class="ordem-menu">
          <button
            v-for="o in ORDENS"
            :key="o.valor"
            type="button"
            :class="{ escolhida: o.valor === ordem }"
            @click="escolherOrdem(o.valor)"
          >
            <span>{{ o.rotulo }}</span>
            <svg v-if="o.valor === ordem" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </button>
        </div>
      </div>
      <button v-if="situacao === 'ativo'" class="principal" @click="$emit('novo')">Novo paciente</button>
    </div>

    <div class="lista-rolagem">
      <ul>
        <li v-for="p in ordenados" :key="p.id">
          <button :class="{ selecionado: p.id === aberto }" @click="$emit('abrir', p.id)">
            {{ p.nome_completo }}
          </button>
        </li>
      </ul>
      <p v-if="!pacientes.length" class="vazio">Nenhum paciente</p>
    </div>
  </aside>
</template>