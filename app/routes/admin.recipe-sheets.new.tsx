import { Link } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { Button } from "~/components/ui/button";

export default function AdminRecipeSheetsNew() {
  return (
    <Container>
      <div className="rounded-md border p-6">
        <h2 className="text-lg font-semibold">Nova ficha técnica</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A criação de ficha técnica acontece no contexto do item do cardápio e tamanho.
        </p>
        <div className="mt-4 flex gap-2">
          <Link to="/admin/gerenciamento/cardapio/main/list">
            <Button type="button">Abrir cardápio</Button>
          </Link>
          <Link to="/admin/recipe-sheets">
            <Button type="button" variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
