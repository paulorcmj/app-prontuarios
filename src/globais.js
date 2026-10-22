// Comportamentos que valem para o app inteiro, ligados uma única vez:
// - dicas no estilo do app no lugar do balão nativo do atributo title;
// - o Tab não sai da janela (configurações, confirmações etc.) que estiver aberta por cima.

let ligado = false;

export function ativarGlobais() {
  if (ligado) return;
  ligado = true;
  ligarDicas();
  ligarPrisaoDeFoco();
  ligarRotulos();
}

function ligarDicas() {
  let balao = null;
  let alvo = null;
  let espera = null;

  function esconderBalao() {
    clearTimeout(espera);
    balao?.remove();
    balao = null;
  }

  // Ao sair do elemento, o title volta para ele (a menos que o Vue já tenha posto um novo).
  function soltar() {
    esconderBalao();
    if (alvo) {
      if (!alvo.hasAttribute('title') && alvo.dataset.dica) alvo.setAttribute('title', alvo.dataset.dica);
      delete alvo.dataset.dica;
      alvo = null;
    }
  }

  function mostrar(texto) {
    balao = document.createElement('div');
    balao.className = 'dica';
    Object.assign(balao.style, {
      zIndex: '100',
      whiteSpace: 'normal',
      maxWidth: 'min(360px, calc(100vw - 16px))',
      overflowWrap: 'anywhere',
    });
    // "Ocultar barra lateral (Ctrl+B)": o que está entre parênteses vira o atalho, à direita.
    const partes = /^(.*\S) \(([^()]+)\)$/.exec(texto);
    const linha = document.createElement('div');
    linha.className = 'dica-linha';
    const titulo = document.createElement('span');
    titulo.textContent = partes ? partes[1] : texto;
    linha.append(titulo);
    if (partes) {
      const tecla = document.createElement('kbd');
      tecla.textContent = partes[2];
      linha.append(tecla);
    }
    balao.append(linha);
    document.body.append(balao);

    const r = alvo.getBoundingClientRect();
    const largura = balao.offsetWidth;
    const altura = balao.offsetHeight;
    const esquerda = Math.max(8, Math.min(r.left + r.width / 2 - largura / 2, window.innerWidth - largura - 8));
    let topo = r.bottom + 8;
    if (topo + altura > window.innerHeight - 8) topo = r.top - altura - 8;
    balao.style.left = `${esquerda}px`;
    balao.style.top = `${topo}px`;
  }

  document.addEventListener('mouseover', (evento) => {
    const novo = evento.target.closest('[title], [data-dica]');
    if (novo === alvo) return;
    soltar();
    if (!novo) return;
    const texto = novo.getAttribute('title') || novo.dataset.dica;
    if (!texto) return;
    alvo = novo;
    // Sem o atributo title, o navegador não mostra o balão dele.
    novo.dataset.dica = texto;
    novo.removeAttribute('title');
    espera = setTimeout(() => mostrar(texto), 350);
  });

  // Se o Vue trocar o title enquanto o mouse está em cima (ex.: mostrar/ocultar senha), o texto novo vale.
  new MutationObserver((registros) => {
    for (const r of registros) {
      if (r.target === alvo && alvo.hasAttribute('title')) {
        alvo.dataset.dica = alvo.getAttribute('title');
        alvo.removeAttribute('title');
      }
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['title'] });

  document.addEventListener('pointerdown', esconderBalao, true);
  document.addEventListener('scroll', esconderBalao, true);
  document.addEventListener('mouseout', (evento) => {
    if (!evento.relatedTarget) soltar();
  });
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ligarPrisaoDeFoco() {
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    // A janela mais acima é a última no documento (as confirmações ficam dentro da janela que as abriu).
    const janelas = document.querySelectorAll('.fundo');
    const topo = janelas[janelas.length - 1];
    if (!topo) return;

    const itens = [...topo.querySelectorAll(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
    if (!itens.length) {
      evento.preventDefault();
      return;
    }
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    const atual = document.activeElement;

    if (!topo.contains(atual)) {
      evento.preventDefault();
      (evento.shiftKey ? ultimo : primeiro).focus();
    } else if (evento.shiftKey && atual === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && atual === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  });
}

// Clicar no espaço vazio ao lado do texto de um rótulo não leva o foco para o campo: só o texto
// do rótulo faz isso. O rótulo ocupa a linha toda, então sem isso qualquer clique ao lado ativaria o campo.
// Caixas de marcar e envio de arquivo ficam como estão (o texto delas é o próprio botão).
function ligarRotulos() {
  document.addEventListener('click', (evento) => {
    const rotulo = evento.target;
    if (!(rotulo instanceof HTMLLabelElement)) return;
    const controle = rotulo.control;
    if (!controle || controle.matches('input[type="checkbox"], input[type="radio"], input[type="file"]')) return;
    if (!cliqueNoTexto(rotulo, evento)) evento.preventDefault();
  });
}

// O clique caiu em cima de algum texto do próprio rótulo (não do campo que ele envolve)?
function cliqueNoTexto(rotulo, evento) {
  const faixa = document.createRange();
  for (const no of rotulo.childNodes) {
    if (no.nodeType !== Node.TEXT_NODE || !no.textContent.trim()) continue;
    faixa.selectNodeContents(no);
    for (const r of faixa.getClientRects()) {
      if (evento.clientX >= r.left && evento.clientX <= r.right && evento.clientY >= r.top && evento.clientY <= r.bottom) {
        return true;
      }
    }
  }
  return false;
}