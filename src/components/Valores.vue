<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { dataBR, reais, reaisParaCentavos, hoje, mensagemDeErro } from '../utilitarios.js';

const props = defineProps({ pacienteId: Number });

const atual = ref(null);
const historico = ref([]);
const valor = ref('');
const aPartirDe = ref(hoje());
const erro = ref('');
const menuAberto = ref(false);
const menuRef = ref(null);

async function carregar() {
  [atual.value, historico.value] = await Promise.all([
    window.api.valores.atual(props.pacienteId),
    window.api.valores.listar(props.pacienteId),
  ]);
}

// O menu do histórico fecha ao clicar fora dele ou ao apertar Esc.
function fecharSeClicouFora(evento) {
  if (menuAberto.value && !menuRef.value?.contains(evento.target)) menuAberto.value = false;
}

function fecharComEsc(evento) {
  if (evento.key === 'Escape') menuAberto.value = false;
}

onMounted(() => {
  carregar();
  document.addEventListener('click', fecharSeClicouFora);
  document.addEventListener('keydown', fecharComEsc);
});

onUnmounted(() => {
  document.removeEventListener('click', fecharSeClicouFora);
  document.removeEventListener('keydown', fecharComEsc);
});

async function adicionar() {
  erro.value = '';
  const centavos = reaisParaCentavos(valor.value);
  if (centavos === null) {
    erro.value = 'Digite o valor em reais, por exemplo 150,00';
    return;
  }
  try {
    await window.api.valores.adicionar(props.pacienteId, centavos, aPartirDe.value);
    valor.value = '';
    await carregar();
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}
</script>

<template>
  <section class="bloco">
    <h3>Valor da sessão</h3>

    <div class="linha-atual">
      <p v-if="atual">
        Atual: <strong>{{ reais(atual.valor) }}</strong> desde {{ dataBR(atual.a_partir_de) }}
      </p>
      <p v-else class="vazio">Nenhum valor registrado.</p>

      <div v-if="historico.length" ref="menuRef" class="menu-historico">
        <button type="button" :aria-expanded="menuAberto" @click="menuAberto = !menuAberto">
          Histórico de valores
        </button>
        <ul v-if="menuAberto" class="historico">
          <li v-for="v in historico" :key="v.id">{{ dataBR(v.a_partir_de) }}: {{ reais(v.valor) }}</li>
        </ul>
      </div>
    </div>

    <form class="form-valor" @submit.prevent="adicionar">
      <label>Novo valor (R$)
        <input v-model="valor" inputmode="decimal" placeholder="150,00" required />
      </label>
      <label>A partir de
        <input v-model="aPartirDe" type="date" required />
      </label>
      <button type="submit" class="principal">Registrar valor</button>
    </form>
    <p v-if="erro" class="erro">{{ erro }}</p>
  </section>
</template>