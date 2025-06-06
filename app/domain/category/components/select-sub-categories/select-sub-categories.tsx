import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { TCategory, TSubCategory } from "../../category.model.server";


interface SelectSubCategoryProps {
    subCategories: TSubCategory[]
}


export default function SelectSubCategory({ subCategories }: SelectSubCategoryProps) {
    return (
        <Select name="sub-categories" required>
            <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent >
                <SelectGroup >
                    {
                        subCategories.map(sc => (
                            <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                        ))
                    }
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}