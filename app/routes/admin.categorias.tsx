import { Link, Outlet, useSearchParams } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import PageHeader from "~/components/layout/page/page-header/page-header";



export default function AdminCategorias() {
    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")


    return (
        <Container className="mt-12">
            <PageHeader
                title="Categorias"
                goBackLink="/admin/categorias"
                newItemBtnLabel="Nova Categoria"
            >
                <div className="w-full p-4 bg-muted mb-6 rounded-lg" >
                    <div className="flex gap-2">
                        <Link to="?_action=categories-sortorder" className="mr-4">
                            <span className="text-sm underline">Ordenamento</span>
                        </Link>
                        {action === "categories-sortorder" && (
                            <Link to="/admin/categorias" className="mr-4">
                                <span className="text-sm underline">Fechar Ordenamento</span>
                            </Link>
                        )}
                    </div>
                </div>
            </PageHeader>
            <Outlet />
        </Container>

    )
}

