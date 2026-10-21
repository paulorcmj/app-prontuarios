<script setup>
// Janela para trocar a senha do app. A senha atual é conferida no processo principal.
import { ref } from 'vue';
import { mensagemDeErro } from '../utilitarios.js';

const emit = defineEmits(['fechar']);
const senhaAtual = ref('');
const novaSenha = ref('');
const confirmacao = ref('');
const erro = ref('');
const concluido = ref(false);

async function salvar() {
  erro.value = '';
  if (!novaSenha.value) {
    erro.value = 'Digite a nova senha';
    return;
  }
  if (novaSenha.value !== confirmacao.value) {
    erro.value = 'A confirmação não é igual à nova senha';
    return;
  }
  try {
    const trocou = await window.api.acesso.alterarSenha(senhaAtual.value, novaSenha.value);
    if (!trocou) {
      erro.value = 'A senha atual está incorreta';
      return;
    }
    concluido.value = true;
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}
</script>

<template>
  <div class="fundo">
    <div v-if="concluido" class="janela janela-dados">
      <h3>Senha alterada</h3>
      <p class="vazio">A nova senha já vale. A chave de recuperação continua a mesma.</p>
      <div class="acoes">
        <button type="button" class="principal" @click="emit('fechar')">Fechar</button>
      </div>
    </div>
    <form v-else class="janela janela-dados" @submit.prevent="salvar">
      <h3>Alterar senha</h3>
      <label>Senha atual
        <input v-model="senhaAtual" type="password" autocomplete="current-password" />
      </label>
      <label>Nova senha
        <input v-model="novaSenha" type="password" autocomplete="new-password" />
      </label>
      <label>Confirmar nova senha
        <input v-model="confirmacao" type="password" autocomplete="new-password" />
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" @click="emit('fechar')">Cancelar</button>
        <button type="submit" class="principal">Alterar</button>
      </div>
    </form>
  </div>
</template>