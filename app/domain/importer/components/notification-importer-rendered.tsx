import { cn } from "~/lib/utils"

export interface IImporterNotification {
    status: 'idle' | 'success' | 'error' | 'submitting'
    message: string | null
}

interface NotificationImporterProps extends IImporterNotification {
}

export function NotificationImporterRenderer({ status, message }: NotificationImporterProps) {
    return (
        <div className="flex gap-4 items-center ">
            <span className="font-semibold text-sm">Status:</span>
            <span className={
                cn(
                    "font-semibold text-sm",
                    status === "error" && "text-red-500",
                    status === "success" && "text-green-500",
                    (status === "idle" || status === "submitting") && "text-gray-500",
                )
            }>{message}</span>
        </div>
    )
}