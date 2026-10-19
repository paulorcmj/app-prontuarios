<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  situacao: String,
  pacientes: Array,
  aberto: [Number, String],
});
defineEmits(['trocar-aba', 'abrir', 'novo']);

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
    <div class="abas">
      <button :class="{ ativa: situacao === 'ativo' }" @click="$emit('trocar-aba', 'ativo')">Prontuários</button>
      <button :class="{ ativa: situacao === 'arquivado' }" @click="$emit('trocar-aba', 'arquivado')">Arquivo</button>
    </div>
    <input v-model="busca" type="search" placeholder="Buscar por nome" />
    <label>Ordenar por
      <select v-model="ordem">
        <option v-for="o in ORDENS" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
      </select>
    </label>
    <button v-if="situacao === 'ativo'" class="principal" @click="$emit('novo')">Novo paciente</button>
    <ul>
      <li v-for="p in ordenados" :key="p.id">
        <button :class="{ selecionado: p.id === aberto }" @click="$emit('abrir', p.id)">
          {{ p.nome_completo }}
        </button>
      </li>
    </ul>
    <p v-if="!pacientes.length" class="vazio">Nenhum paciente.</p>
    <p class="aviso-local">Os dados estão apenas neste computador.</p>
  </aside>
</template>