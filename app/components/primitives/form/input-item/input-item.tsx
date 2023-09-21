import { Input } from "~/components/ui/input";

export default function InputItem({ ...props }) {
    return (
        <Input className="text-lg p-2 placeholder:text-gray-400" {...props} autoComplete="nope" />
    )
}