const render = (numbers) => {
  document.getElementById("orders").textContent = numbers
    .map((n) => (n === null ? "VL" : `#${n}`))
    .join(" · ");
};
window.ovenAlert.onChanged(render);
window.ovenAlert
  .get()
  .then(render)
  .catch(() => {
    document.getElementById("error").textContent =
      "Não foi possível carregar os pedidos.";
  });
for (const action of ["open", "dismiss"]) {
  document.getElementById(action).addEventListener("click", () => {
    window.ovenAlert.action(action).catch(() => {
      document.getElementById("error").textContent =
        "Não foi possível fechar o alerta. Tente novamente.";
    });
  });
}
