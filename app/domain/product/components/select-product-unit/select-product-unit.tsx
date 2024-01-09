import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";




export default function SelectProductUnit() {
    return (
        <Select name="unit" required defaultValue="gr">
            <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent id="unit"  >
                <SelectGroup >
                    <SelectItem value="gr">GR</SelectItem>
                    <SelectItem value="un">UN</SelectItem>
                    <SelectItem value="lt">LT</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}