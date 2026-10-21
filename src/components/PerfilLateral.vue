<script setup>
// Perfil no topo da lateral: foto, nome e um menu suspenso com "Configurações".
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import AlterarSenha from './AlterarSenha.vue';
import Backup from './Backup.vue';

const props = defineProps({ profissional: Object });
const emit = defineEmits(['configuracoes']);

const aberto = ref(false);
const raiz = ref(null);
const alterandoSenha = ref(false);
const backupAberto = ref(false);

const inicial = computed(() => props.profissional.nome.trim().charAt(0).toUpperCase() || '?');

// Mostra "CRP" antes do número, mesmo que tenha sido digitado só o número.
const crp = computed(() => {
  const texto = props.profissional.crp.trim();
  if (!texto) return '';
  return /^crp/i.test(texto) ? texto : `CRP ${texto}`;
});

// Clicar fora do perfil fecha o menu.
function aoClicarFora(evento) {
  if (raiz.value && !raiz.value.contains(evento.target)) aberto.value = false;
}

function abrirConfiguracoes() {
  aberto.value = false;
  emit('configuracoes');
}

function abrirAlterarSenha() {
  aberto.value = false;
  alterandoSenha.value = true;
}

function abrirBackup() {
  aberto.value = false;
  backupAberto.value = true;
}

// O pedido vai para o Principal, que mostra o aviso de alterações não salvas
// (o mesmo da troca de paciente) antes de sair.
function sair() {
  aberto.value = false;
  window.dispatchEvent(new CustomEvent('pedir-saida'));
}

onMounted(async () => {
  document.addEventListener('click', aoClicarFora);
  try {
    const estado = await window.api.backup.estado();
    if (!estado.pasta || estado.aviso) backupAberto.value = true;
  } catch {
    // sem resposta, o botão do menu continua disponível
  }
});
onBeforeUnmount(() => document.removeEventListener('click', aoClicarFora));
</script>

<template>
  <div ref="raiz" class="perfil">
    <button type="button" class="perfil-botao" :aria-expanded="aberto" @click="aberto = !aberto">
      <span class="avatar">
        <img v-if="profissional.foto" :src="profissional.foto" alt="" />
        <template v-else>{{ inicial }}</template>
      </span>
      <span class="perfil-texto">
        <span class="perfil-nome">{{ profissional.nome || 'Perfil' }}</span>
        <span v-if="crp" class="perfil-crp">{{ crp }}</span>
      </span>
    </button>
    <div v-if="aberto" class="perfil-menu">
      <button type="button" @click="abrirConfiguracoes">Configurações</button>
      <button type="button" @click="abrirAlterarSenha">Alterar senha</button>
      <button type="button" @click="abrirBackup">Backup</button>
      <button type="button" @click="sair">Sair</button>
    </div>
    <Teleport to="body">
      <AlterarSenha v-if="alterandoSenha" @fechar="alterandoSenha = false" />
      <Backup v-if="backupAberto" @fechar="backupAberto = false" />
    </Teleport>
  </div>
</template>