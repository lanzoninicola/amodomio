import { Input } from "~/components/ui/input";

export default function InputItem({ ghost = false, ...props }) {

    return (
        <Input className={`text-lg p-2 placeholder:text-gray-400 ${ghost === true ? `border-none` : ``}`} {...props} autoComplete="nope" />
    )
}