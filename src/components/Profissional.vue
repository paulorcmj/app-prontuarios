<script setup>
// Janela de configurações: foto, nome, CRP e e-mail do profissional.
// Nome, CRP e e-mail vão para o cabeçalho dos PDFs; a foto só aparece no perfil da lateral.
import { ref, computed, onMounted } from 'vue';
import { mensagemDeErro } from '../utilitarios.js';

const emit = defineEmits(['fechar', 'salvo']);
const dados = ref({ nome: '', crp: '', email: '', foto: '' });
const erro = ref('');
const inicial = computed(() => dados.value.nome.trim().charAt(0).toUpperCase() || '?');

const TAMANHO_FOTO = 256;

onMounted(async () => {
  try {
    dados.value = await window.api.profissional.obter();
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

async function salvar() {
  erro.value = '';
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
    <form class="janela janela-dados" @submit.prevent="salvar">
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
        <input v-model="dados.crp" placeholder="CRP 00/00000" />
      </label>
      <label>E-mail
        <input v-model="dados.email" type="email" />
      </label>
      <p v-if="erro" class="erro">{{ erro }}</p>
      <div class="acoes">
        <button type="button" @click="emit('fechar')">Cancelar</button>
        <button type="submit" class="principal">Salvar</button>
      </div>
    </form>
  </div>
</template>