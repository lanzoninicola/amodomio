import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import DoughForm from "~/domain/dough/components/dough-form/dough-form";
import { doughEntity } from "~/domain/dough/dough.entity.server";
import { Dough } from "~/domain/dough/dough.model.server";
import { ok } from "~/utils/http-response.server";

export async function loader() {
    const doughs = await doughEntity.findAll()
    return ok({ doughs })
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "category-create") {

    }
    return null
}


export default function DoughOutlet() {
    const loaderData = useLoaderData<typeof loader>()
    const doughs = loaderData.payload.doughs as Dough[]

    return (
        <Container>
            <div className="fixed top-[35px] left-0  w-full p-4 bg-muted z-10" >
                <div className="flex items-center justify-between mb-4">
                    <h1 className="font-bold text-xl">Massas</h1>

                    <Form method="post">
                        <SubmitButton actionName="menu-item-create" className="w-max" idleText="Criar item" loadingText="Criando..."
                        />
                    </Form>
                </div>


            </div>
            {doughs.map(dough => <DoughForm dough={dough} />)}
            <Outlet />
        </Container>
    )
}