window.api.resultadoTeste().then((r) => {
  document.getElementById('saida').textContent = JSON.stringify(r, null, 2);
});