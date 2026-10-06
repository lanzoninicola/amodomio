const key = "amodomio.desktop.kds.statuses";
const statuses = [
  ["novoPedido", "Novo pedido"],
  ["emProducao", "Em produção"],
  ["aguardandoForno", "Aguardando forno"],
  ["assando", "Assando"],
  ["finalizado", "Finalizado"],
];
let selected = ["aguardandoForno", "assando"];
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (
    Array.isArray(saved) &&
    saved.some((id) => statuses.some(([value]) => value === id))
  )
    selected = saved;
} catch {}
const form = document.getElementById("statuses");
for (const [id, name] of statuses) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = id;
  input.checked = selected.includes(id);
  label.append(input, document.createTextNode(name));
  form.append(label);
}
document.getElementById("save").addEventListener("click", () => {
  const values = Array.from(form.querySelectorAll("input:checked")).map(
    (input) => input.value
  );
  const error = document.getElementById("error");
  if (!values.length) {
    error.textContent = "Selecione pelo menos um status.";
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(values));
    window.close();
  } catch {
    error.textContent = "Não foi possível salvar. Tente novamente.";
  }
});
