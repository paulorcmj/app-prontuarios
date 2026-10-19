<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import Confirmacao from './Confirmacao.vue';
import { dataBR, reais, mensagemDeErro } from '../utilitarios.js';

defineProps({ historico: Array, editando: Boolean });
const emit = defineEmits(['removido', 'erro']);

const valor = defineModel('valor');
const data = defineModel('data');

const menuAberto = ref(false);
const menuRef = ref(null);
const removendo = ref(null);

// O menu do histórico fecha ao clicar fora dele ou ao apertar Esc.
function fecharSeClicouFora(evento) {
  if (menuAberto.value && !menuRef.value?.contains(evento.target)) menuAberto.value = false;
}

function fecharComEsc(evento) {
  if (evento.key === 'Escape') menuAberto.value = false;
}

onMounted(() => {
  document.addEventListener('click', fecharSeClicouFora);
  document.addEventListener('keydown', fecharComEsc);
});

onUnmounted(() => {
  document.removeEventListener('click', fecharSeClicouFora);
  document.removeEventListener('keydown', fecharComEsc);
});

async function remover() {
  const { id } = removendo.value;
  removendo.value = null;
  try {
    await window.api.valores.excluir(id);
    emit('removido');
  } catch (e) {
    emit('erro', mensagemDeErro(e));
  }
}
</script>

<template>
  <!-- Fica fora dos fieldset da ficha: botão dentro de fieldset desabilitado também fica
       desabilitado, e o histórico precisa abrir com a ficha travada. -->
  <div class="par-valor">
    <div class="campo">
      <label for="campo-valor">Valor da sessão (R$)</label>
      <div class="campo-com-botao">
        <input id="campo-valor" v-model="valor" inputmode="decimal" placeholder="150,00" :disabled="!editando" />
        <span ref="menuRef" class="menu-historico">
          <button
            type="button"
            class="icone"
            title="Histórico de valores"
            aria-label="Histórico de valores"
            :aria-expanded="menuAberto"
            @click="menuAberto = !menuAberto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </button>
          <ul v-if="menuAberto" class="historico">
            <li v-for="v in historico" :key="v.id">
              <span>{{ dataBR(v.a_partir_de) }}: {{ reais(v.valor) }}</span>
              <button type="button" class="perigo" @click="removendo = v">Remover</button>
            </li>
            <li v-if="!historico.length" class="vazio">Nenhum valor registrado.</li>
          </ul>
        </span>
      </div>
    </div>

    <div class="campo">
      <label for="campo-data">A partir de</label>
      <input id="campo-data" v-model="data" type="date" :disabled="!editando" />
    </div>

    <Confirmacao
      v-if="removendo"
      :texto="`Remover o valor de ${reais(removendo.valor)} (a partir de ${dataBR(removendo.a_partir_de)})?`"
      rotulo-confirmar="Remover"
      @cancelar="removendo = null"
      @confirmar="remover"
    />
  </div>
</template>