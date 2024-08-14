import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";


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
            <DialogContent className="py-12">

                {children}
            </DialogContent>
        </Dialog>
    )
}