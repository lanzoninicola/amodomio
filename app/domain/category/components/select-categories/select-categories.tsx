import { Category } from "@prisma/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";


interface SelectCategoryProps {
    categories: Category[]
}


export default function SelectCategory({ categories }: SelectCategoryProps) {
    return (
        <Select name="categories" required>
            <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent >
                <SelectGroup >
                    {
                        categories.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))
                    }
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}