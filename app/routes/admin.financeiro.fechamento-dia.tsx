import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { DatePicker } from "~/components/ui/date-picker";
import { FechamentoDiaResultados, financeEntity } from "~/domain/finance/finance.entity.server";
import { MogoOrderInbound } from "~/domain/mogo-orders-inbound/mogo-orders-inbound.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";

import { ok, serverError } from "~/utils/http-response.server";



export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    let resultados: FechamentoDiaResultados | null = null

    if (date) {
        const [err, relatorioDia] = await prismaIt(financeEntity.fechamentoDia(date))

        if (err) {
            return serverError(err)
        }

        console.log()

        resultados = {
            ...relatorioDia
        }

        return ok({ resultados })
    } else {
        resultados = null
    }



    return null
};


export default function FechamentoDia() {
    const loaderData = useLoaderData<typeof loader>()
    const resultados: FechamentoDiaResultados | null = loaderData.payload?.resultados || null

    console.log({
        loaderData

    })

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const navigate = useNavigate();

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);

        if (date) {
            navigate(`?date=${date.toISOString().split("T")[0]}`);
        } else {
            navigate("");
        }
    };

    return (
        <Container>
            <h2 className="font-semibold text-lg tracking-tight mb-6">Fechamento do dia {selectedDate.toISOString().split("T")[0]}</h2>
            <div className="flex flex-col gap-2 mb-8">
                <span className="text-sm text-muted-foreground text-center">Selecione uma data</span>
                <div className="flex gap-4 items-center justify-center ">
                    <DatePicker selected={selectedDate} onChange={setSelectedDate} />
                    <SubmitButton actionName="date-selected" showText={false} icon={<ArrowRight />} className="w-max" onClick={() => handleDateChange(selectedDate)} />
                </div>
            </div>
            <div className="flex flex-col gap-4i items-center">

                {
                    !resultados && <div className="text-center">Selecione uma data</div>
                }

                {
                    resultados && (

                        <div className="flex flex-col justify-center items-center border rounded-md py-4 px-8">
                            <h3 className="font-semibold mb-4 md:mb-2 text-center md:text-xl">Receita Líquida</h3>
                            <div className="grid grid-cols-5 items-center  text-muted-foreground mb-4">
                                <div className="flex flex-col w-full col-span-2">
                                    <span className="text-xs leading-none">Receita Bruta</span>
                                    <AmountReais valueClassName="text-xs" valutaClassName="text-xs">{resultados?.receitaBruta}</AmountReais>

                                </div>
                                <span className="text-center">-</span>
                                <div className="flex flex-col col-span-2">
                                    <span className="text-xs leading-none">Resultado Entrega</span>
                                    <AmountReais valueClassName="text-xs" valutaClassName="text-xs">{resultados?.resultadoEntrega}</AmountReais>

                                </div>


                            </div>
                            <div className="flex justify-center items-start gap-4">
                                <span>R$</span>
                                <span className="text-6xl md:text-4xl">{resultados?.receitaLiquida}</span>
                            </div>
                        </div>

                    )
                }
            </div>


        </Container>
    );
}


interface AmountReaisProps {
    children: React.ReactNode
    valutaClassName?: string
    valueClassName?: string
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
                "text-6xl md:text-4xl",
                valueClassName
            )}>{children}</span>
        </div>
    )
}
