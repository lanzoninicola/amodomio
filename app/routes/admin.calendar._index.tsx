import { json } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest } from "~/utils/http-response.server";

import { useLoaderData, Form } from "@remix-run/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";


export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
  const month = Number(url.searchParams.get("month")) || new Date().getMonth() + 1;

  const days = await prismaClient.calendarDay.findMany({
    where: {
      year,
      month,
    },
    orderBy: { date: "asc" },
  });

  return json({ days, year, month });
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const id = formData.get("id") as string;
  const isHoliday = formData.get("isHoliday") === "true";
  const description = formData.get("description") as string | null;

  if (!id) {
    return badRequest("ID não informado")
  }

  await prismaClient.calendarDay.update({
    where: { id },
    data: {
      isHoliday,
      description,
    },
  });

  return json({ success: true });
}


export default function CalendarAdmin() {
  const { days, year, month } = useLoaderData<typeof loader>();

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold">Calendário {month}/{year}</h1>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Dia da Semana</TableHead>
                <TableHead>Feriado?</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    {new Date(d.date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.weekday]}
                  </TableCell>
                  <TableCell>{d.isHoliday ? "Sim" : "Não"}</TableCell>
                  <TableCell>{d.description || "-"}</TableCell>
                  <TableCell>
                    <Form method="post" className="flex gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <Select name="isHoliday" defaultValue={d.isHoliday ? "true" : "false"}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Sim</SelectItem>
                          <SelectItem value="false">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        name="description"
                        placeholder="Descrição"
                        defaultValue={d.description || ""}
                        className="w-48"
                      />
                      <Button type="submit">Salvar</Button>
                    </Form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
