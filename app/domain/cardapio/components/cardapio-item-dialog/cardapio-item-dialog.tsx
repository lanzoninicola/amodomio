import { Dialog, DialogContent, DialogTrigger, DialogClose } from "~/components/ui/dialog";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { Button } from "~/components/ui/button";


interface CardapioItemDialogProps {
    children?: React.ReactNode;
    item: MenuItemWithAssociations;
    triggerComponent?: React.ReactNode;
}


export default function CardapioItemDialog({ item, children, triggerComponent }: CardapioItemDialogProps) {
    return (
        <Dialog >
            <DialogTrigger asChild className="w-full">
                <button>
                    {triggerComponent}
                </button>
            </DialogTrigger>
            <DialogContent className="p-0">

                {children}
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        <span className="font-body-website tracking-wide text-xs font-semibold uppercase">Fechar</span>
                    </Button>
                </DialogClose>
            </DialogContent>
        </Dialog>
    )
}