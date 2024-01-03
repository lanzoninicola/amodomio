import { Textarea } from "~/components/ui/textarea";

export default function TextareaItem({ ...props }) {
    return (
        <Textarea className="text-lg p-2 placeholder:text-gray-400" {...props} autoComplete="nope" />
    )
}