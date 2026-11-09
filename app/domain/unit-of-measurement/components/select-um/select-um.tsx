import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { umEntity } from "../../um.entity.server";
import { cn } from "~/lib/utils";
import randomReactKey from "~/utils/random-react-key";


interface SelectUMProps {
    required?: boolean
    className?: string
}

export default function SelectUM({ required = true, className }: SelectUMProps) {
    return (
        <Select name="um" required={required} >
            <SelectTrigger className={
                cn(
                    className,
                )
            }>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent id="um">

                {umEntity.units().map(u => <SelectItem key={randomReactKey()} value={u}>{u}</SelectItem>)}
            </SelectContent>
        </Select>
    )
}
