import { Link } from "@remix-run/react";
import { Separator } from "~/components/ui/separator";

interface PageHeaderProps {
    title: string;
    goBackLink: string;
    newItemBtnLabel: string
    children?: React.ReactNode;
}

export default function PageHeader({ children, title, goBackLink, newItemBtnLabel }: PageHeaderProps) {
    return (
        <div className="lw-full px-4 py-8 bg-muted mb-6" >
            <div className="flex justify-between mb-4 items-center">

                <h1 className="font-bold text-xl">{title}</h1>
                <Link to={goBackLink} className="mr-4">
                    <span className="text-sm underline hover:font-semibold">Voltar</span>
                </Link>

            </div>
            <Separator className="mb-6" />
            <div className="flex items-center gap-4">
                <Link to="new" className="mr-4 py-2 px-4 rounded-md bg-black hover:bg-black/50">
                    <span className="text-white font-semibold">
                        {newItemBtnLabel}
                    </span>
                </Link>
                {children}
            </div>
        </div>
    )
}