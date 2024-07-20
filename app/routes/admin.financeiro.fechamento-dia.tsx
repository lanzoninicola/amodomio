import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import dayjs from "dayjs";
import { ArrowRight, LoaderIcon } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { DatePicker } from "~/components/ui/date-picker";
import { Separator } from "~/components/ui/separator";
import FinanceEntity, { ResultadoFinanceiro } from "~/domain/finance/finance.entity.server";
import MogoOrderStatsEntity, { ResultadoStats } from "~/domain/mogo-order-stats/mogo-orders-stats.entity.server";
import { MogoOrderInbound, mogoOrdersInboundEntity } from "~/domain/mogo-orders-inbound/mogo-orders-inbound.entity.server";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import capitalize from "~/utils/capitalize";

import { ok, serverError } from "~/utils/http-response.server";



export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    let resultadosFinanceiro: ResultadoFinanceiro | null = null
    let resultadosStats: ResultadoStats | null = null

    const orders = await mogoOrdersInboundEntity.findByDate(date || "")

    const stats = new MogoOrderStatsEntity({
        orders,
    })

    const finance = new FinanceEntity({
        orders,
    })

    if (date) {
        const resultadosFinanceiro = finance.fechamento()
        const resultadosStats = stats.resultado()
        return ok({ resultadosFinanceiro, resultadosStats })
    }


    return ok({ resultadosFinanceiro, resultadosStats })
};


export default function FechamentoDia() {
    const loaderData = useLoaderData<typeof loader>()
    const resultadosFinanceiro: ResultadoFinanceiro | null = loaderData.payload?.resultadosFinanceiro || null
    const resultadosStats: ResultadoStats | null = loaderData.payload?.resultadosStats || null

    const [searchParams, _] = useSearchParams()
    const dateFiltered = searchParams.get("date")

    const initialDate = dateFiltered && dayjs(dateFiltered).toDate() || new Date();

    const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

    const navigate = useNavigate();

    const formSubmission = useFormSubmissionnState()


    const handleDateChange = (date: Date) => {
        setSelectedDate(date);

        const currentDateString = dayjs(date).format("YYYY/MM/DD");

        if (date) {
            navigate(`?date=${currentDateString}`);
        } else {
            navigate("");
        }
    };

    return (
        <Container>
            <h2 className="font-semibold text-lg tracking-tight mb-6">Fechamento do dia</h2>
            <div className="flex flex-col gap-6">
                <div className="flex gap-4 items-center justify-center ">
                    <DatePicker selected={selectedDate} onChange={setSelectedDate} />
                    <SubmitButton actionName="date-selected"
                        showText={false} icon={
                            formSubmission === "loading" ? <LoaderIcon /> : <ArrowRight />
                        }
                        className={
                            cn(
                                "w-max",
                                formSubmission === "loading" && "animate-pulse",
                            )
                        }
                        onClick={() => handleDateChange(selectedDate)} />
                </div>
                <div className="flex flex-col gap-4 items-center">

                    {
                        !resultadosFinanceiro && <div className="text-center">
                            Nenhuma consulta encontrada
                        </div>
                    }

                    {
                        resultadosFinanceiro && (

                            <div className="flex flex-col justify-center items-center border rounded-md py-4 px-6 md:px-16 md:max-w-md">
                                <h3 className="font-semibold mb-4 text-center md:text-xl">Receita Líquida</h3>
                                <div className="grid grid-cols-5 md:gap-4 items-center  text-muted-foreground mb-4">

                                    <div className="flex flex-col col-span-2 bg-slate-50 rounded-md p-2">
                                        <span className="text-xs leading-tight text-center mb-4">Receita Bruta</span>
                                        <AmountReais valueClassName="text-md" valutaClassName="text-xs">
                                            {resultadosFinanceiro?.receitaBruta}
                                        </AmountReais>
                                    </div>
                                    <span className="text-center">-</span>
                                    <div className="flex flex-col col-span-2 bg-slate-50 rounded-md p-2">
                                        <span className="text-xs leading-tight text-center mb-4">Resultado Entrega</span>
                                        <AmountReais valueClassName="text-md" valutaClassName="text-xs">
                                            {resultadosFinanceiro?.resultadoEntrega}
                                        </AmountReais>
                                    </div>


                                </div>
                                <div className="flex justify-center items-start gap-4">
                                    <span>R$</span>
                                    <span className="text-6xl md:text-4xl">{resultadosFinanceiro?.receitaLiquida}</span>
                                </div>
                            </div>

                        )
                    }
                </div>
                <Card className="col-span-2">
                    <CardHeader>


                        <CardTitle className="tracking-wide text-sm font-semibold uppercase flex justify-between items-center">
                            <span>Numero de pedidos</span>
                            <span className="font-semibold">{resultadosStats?.numberOfOrders}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>

                        <ul>
                            {
                                resultadosStats?.sizesAmount && Object.entries(resultadosStats?.sizesAmount).map(([key, value], index) => {
                                    return <li key={index} className="leading-tight mb-2 flex justify-between items-center gap-x-6">
                                        <span className="text-lg">{`Tamanho ${capitalize(key)}`}</span>
                                        <span className="text-lg">{value}</span>

                                    </li>
                                })
                            }
                        </ul>


                    </CardContent>

                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle className="tracking-wide text-sm font-semibold uppercase">Top 3 sabores do dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul>
                            {
                                resultadosStats?.topThreeToppings && Object.entries(resultadosStats?.topThreeToppings).map(([key, value], index) => {
                                    return (
                                        <div key={index}>
                                            <li
                                                className="leading-none grid grid-cols-8 items-center">
                                                <span className="text-lg">{index + 1}</span>
                                                <span className="text-lg col-span-7">{`${capitalize(key)} (${value})`}</span>
                                            </li>
                                            <Separator className="my-1" />
                                        </div>
                                    )
                                })
                            }

                        </ul>
                    </CardContent>

                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="tracking-wide text-sm font-semibold uppercase">Sabor menos vendido do dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-lg">{capitalize(resultadosStats?.lastTopping)}</span>
                    </CardContent>

                </Card>
            </div>


        </Container >
    );
}


interface AmountReaisProps {
    children: React.ReactNode
    valueClassName?: string
    valutaClassName?: string
}

const AmountReais = ({ children, valueClassName, valutaClassName }: AmountReaisProps) => {
    return (
        <div className="flex justify-center items-start gap-2">
            <span className={
                cn(
                    "text-muted-foreground",
                    valutaClassName
                )
            }>R$</span>
            <span className={cn(
                "text-6xl md:text-2xl",
                valueClassName
            )}>{children}</span>
        </div>
    )
}
