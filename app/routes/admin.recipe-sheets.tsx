import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import PageHeader from "~/components/layout/page/page-header/page-header";

export default function RecipeSheetsOutlet() {
  return (
    <Container className="mt-12">
      <PageHeader
        title="Fichas Técnicas"
        goBackLink="/admin/recipe-sheets"
        newItemBtnLabel="Nova ficha técnica"
      />
      <Outlet />
    </Container>
  );
}
