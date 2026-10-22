<script setup>
import { ref, computed, watch } from 'vue';
import PerfilLateral from './PerfilLateral.vue';
import BuscaComOrdem from './BuscaComOrdem.vue';
import { lerOrdem, guardarOrdem } from '../preferencias.js';

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
const ordem = ref(lerOrdem(CHAVE_ORDEM, ORDENS.map((o) => o.valor), 'nome-az'));
watch(ordem, (valor) => guardarOrdem(CHAVE_ORDEM, valor));

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
      <BuscaComOrdem
        v-model:busca="busca"
        v-model:ordem="ordem"
        class="busca-linha"
        :ordens="ORDENS"
        placeholder="Buscar por nome"
        rotulo-ordenar="Ordenar pacientes"
      />
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