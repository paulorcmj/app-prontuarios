<script setup>
defineProps({
  situacao: String,
  pacientes: Array,
  aberto: [Number, String],
});
defineEmits(['trocar-aba', 'abrir', 'novo']);

const busca = defineModel('busca');
</script>

<template>
  <aside class="lista">
    <div class="abas">
      <button :class="{ ativa: situacao === 'ativo' }" @click="$emit('trocar-aba', 'ativo')">Prontuários</button>
      <button :class="{ ativa: situacao === 'arquivado' }" @click="$emit('trocar-aba', 'arquivado')">Arquivo</button>
    </div>
    <input v-model="busca" type="search" placeholder="Buscar por nome" />
    <button v-if="situacao === 'ativo'" class="principal" @click="$emit('novo')">Novo paciente</button>
    <ul>
      <li v-for="p in pacientes" :key="p.id">
        <button :class="{ selecionado: p.id === aberto }" @click="$emit('abrir', p.id)">
          {{ p.nome_completo }}
        </button>
      </li>
    </ul>
    <p v-if="!pacientes.length" class="vazio">Nenhum paciente.</p>
    <p class="aviso-local">Os dados estão apenas neste computador.</p>
  </aside>
</template>