<script setup>
// Janela de configurações: foto, nome, CRP e e-mail do profissional.
// Nome, CRP e e-mail vão para o cabeçalho dos PDFs; a foto só aparece no perfil da lateral.
import { ref, computed, watch, onMounted, provide } from 'vue';
import Confirmacao from './Confirmacao.vue';
import CampoMascara from './CampoMascara.vue';
import { mensagemDeErro, erroMascara } from '../utilitarios.js';

const emit = defineEmits(['fechar', 'salvo']);
const dados = ref({ nome: '', crp: '', email: '', foto: '' });
const erro = ref('');
const erroEmail = ref('');
const inicial = computed(() => dados.value.nome.trim().charAt(0).toUpperCase() || '?');

const TAMANHO_FOTO = 256;

// Retrato dos dados como foram carregados, para saber se há alteração sem salvar.
// Fica nulo até os dados chegarem, para o Cancelar não estranhar antes disso.
const retratoSalvo = ref(null);
const pendente = computed(
  () => retratoSalvo.value !== null && JSON.stringify(dados.value) !== retratoSalvo.value
);
const confirmandoFechar = ref(false);

// Avisa o campo do CRP que o salvamento foi tentado, para ele mostrar o aviso de incompleto.
const tentou = ref(false);
provide('tentouSalvar', tentou);

// O erro do e-mail some assim que o usuário mexe no campo.
watch(() => dados.value.email, () => {
  erroEmail.value = '';
});

onMounted(async () => {
  try {
    dados.value = await window.api.profissional.obter();
    retratoSalvo.value = JSON.stringify(dados.value);
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
});

// Recorta a imagem em quadrado, pelo centro, e reduz para 256 px,
// para a foto ocupar pouco espaço no banco.
async function escolherFoto(evento) {
  const arquivo = evento.target.files[0];
  evento.target.value = '';
  if (!arquivo) return;
  erro.value = '';
  try {
    const imagem = await createImageBitmap(arquivo);
    const lado = Math.min(imagem.width, imagem.height);
    const canvas = document.createElement('canvas');
    canvas.width = TAMANHO_FOTO;
    canvas.height = TAMANHO_FOTO;
    const contexto = canvas.getContext('2d');
    // Fundo branco: imagens com transparência não ficam pretas no JPEG.
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, TAMANHO_FOTO, TAMANHO_FOTO);
    contexto.drawImage(
      imagem,
      (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado,
      0, 0, TAMANHO_FOTO, TAMANHO_FOTO
    );
    dados.value.foto = canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    erro.value = 'Não foi possível abrir essa imagem';
  }
}

// Com alterações sem salvar, o Cancelar pede confirmação antes de fechar.
function pedirFechar() {
  if (pendente.value) confirmandoFechar.value = true;
  else emit('fechar');
}

async function salvar() {
  erro.value = '';
  tentou.value = true;
  // O e-mail é conferido aqui (e não pelo navegador) para o aviso aparecer embaixo do campo.
  const email = dados.value.email.trim();
  const emailInvalido = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  erroEmail.value = emailInvalido ? 'E-mail inválido' : '';
  // CRP incompleto não é salvo: o aviso aparece embaixo do campo.
  if (emailInvalido || erroMascara('crp', dados.value.crp)) return;
  try {
    await window.api.profissional.salvar({ ...dados.value });
    emit('salvo');
    emit('fechar');
  } catch (e) {
    erro.value = mensagemDeErro(e);
  }
}
</script>

<template>
  <div class="fundo">
    <form class="janela janela-dados" novalidate @submit.prevent="salvar">
      <h3>Configurações</h3>
      <p class="vazio">O nome, o CRP e o e-mail aparecem no cabeçalho dos PDFs.</p>

      <div class="foto-linha">
        <span class="avatar avatar-grande">
          <img v-if="dados.foto" :src="dados.foto" alt="" />
          <template v-else>{{ inicial }}</template>
        </span>
        <div class="acoes">
          <label class="botao-arquivo">Escolher foto
            <input type="file" accept="image/*" hidden @change="escolherFoto" />
          </label>
          <button v-if="dados.foto" type="button" @click="dados.foto = ''">Remover</button>
        </div>
      </div>

      <label>Nome
        <input v-model="dados.nome" />
      </label>
      <label>CRP
        <CampoMascara v-model="dados.crp" tipo="crp" />
      </label>
      <label>E-mail
        <input v-model="dados.email" type="email" />
        <span v-if="erroEmail" class="erro">{{ erroEmail }}</span>
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" @click="pedirFechar">Cancelar</button>
        <button type="submit" class="principal">Salvar</button>
      </div>
    </form>

    <Confirmacao
      v-if="confirmandoFechar"
      texto="Há alterações que não foram salvas. Se cancelar agora, elas serão perdidas."
      rotulo-cancelar="Continuar editando"
      rotulo-confirmar="Descartar alterações"
      @cancelar="confirmandoFechar = false"
      @confirmar="emit('fechar')"
    />
  </div>
</template>