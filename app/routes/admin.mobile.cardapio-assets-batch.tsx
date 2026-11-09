import type { MetaFunction } from "@remix-run/node";

export { loader } from "./admin.gerenciamento.cardapio.assets-batch";
export { default } from "./admin.gerenciamento.cardapio.assets-batch";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Assets do cardápio" }];
