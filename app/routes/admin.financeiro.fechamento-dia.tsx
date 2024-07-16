import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import dayjs from "dayjs";
import { ArrowRight, LoaderIcon } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { DatePicker } from "~/components/ui/date-picker";
import FinanceEntity, { ResultadoFinanceiro } from "~/domain/finance/finance.entity.server";
import { MogoOrderInbound, mogoOrdersInboundEntity } from "~/domain/mogo-orders-inbound/mogo-orders-inbound.entity.server";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";

import { ok, serverError } from "~/utils/http-response.server";



export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    let resultados: ResultadoFinanceiro | null = null

    const orders = await mogoOrdersInboundEntity.findByDate(date || "")

    const finance = new FinanceEntity({
        orders,
    })

    if (date) {
        const resultados = finance.fechamento()
        return ok({ resultados })
    }


    return ok({ resultados })
};


export default function FechamentoDia() {
    const loaderData = useLoaderData<typeof loader>()
    const resultados: ResultadoFinanceiro | null = loaderData.payload?.resultados || null

    const [searchParams, _] = useSearchParams()
    const dateFiltered = searchParams.get("date")

    const [selectedDate, setSelectedDate] = useState<Date>(dayjs(dateFiltered).toDate() || new Date());

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
                        !resultados && <div className="text-center">
                            Nenhuma consulta encontrada
                        </div>
                    }

                    {
                        resultados && (

                            <div className="flex flex-col justify-center items-center border rounded-md py-4 px-6 md:px-16 md:max-w-md">
                                <h3 className="font-semibold mb-4 text-center md:text-xl">Receita Líquida</h3>
                                <div className="grid grid-cols-5 md:gap-4 items-center  text-muted-foreground mb-4">

                                    <div className="flex flex-col col-span-2 bg-slate-50 rounded-md p-2">
                                        <span className="text-xs leading-tight text-center mb-4">Receita Bruta</span>
                                        <AmountReais valueClassName="text-md" valutaClassName="text-xs">
                                            {resultados?.receitaBruta}
                                        </AmountReais>
                                    </div>
                                    <span className="text-center">-</span>
                                    <div className="flex flex-col col-span-2 bg-slate-50 rounded-md p-2">
                                        <span className="text-xs leading-tight text-center mb-4">Resultado Entrega</span>
                                        <AmountReais valueClassName="text-md" valutaClassName="text-xs">
                                            {resultados?.resultadoEntrega}
                                        </AmountReais>
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
            </div>


        </Container >
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
                "text-6xl md:text-2xl",
                valueClassName
            )}>{children}</span>
        </div>
    )
}
