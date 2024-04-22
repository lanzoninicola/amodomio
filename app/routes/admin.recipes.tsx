import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import PageHeader from "~/components/layout/page/page-header/page-header";

export default function RecipesOutlet() {
    return (
        <Container className="mt-12">
            <PageHeader
                title="Receitas"
                goBackLink="/admin/recipes"
                newItemBtnLabel="Nova receita"
            />
            <Outlet />
        </Container>
    )
}

