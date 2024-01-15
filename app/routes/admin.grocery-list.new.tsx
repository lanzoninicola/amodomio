import { redirect, type ActionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { groceryListEntity } from "~/domain/grocery-list/grocery-list.entity.server";
import { now } from "~/lib/dayjs";
import { serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "groceryt-list-create") {

        const [err, record] = await tryit(groceryListEntity.create({
            name: values.name as string,
        }))

        if (err) {
            return serverError(err)
        }

        return redirect(`/admin/grocery-list/${record.id}`)
    }

    return null
}


export default function SingleGroceryListNew() {
    const currentDateString: string = now()

    return (
        <Card>
            <CardHeader>
                <CardTitle>Nova Lista</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
                <Form method="post"  >
                    <Fieldset>
                        <Label htmlFor="name">Nome</Label>
                        <Input type="string" id="name" placeholder="Nome lista" name="name" required defaultValue={`Lista do dia ${currentDateString}`} />
                    </Fieldset>
                    <div className="flex gap-2 mt-6">
                        <SubmitButton actionName="groceryt-list-create" className="w-[150px] gap-2" />
                    </div>
                </Form>
            </CardContent>
        </Card>
    )
}