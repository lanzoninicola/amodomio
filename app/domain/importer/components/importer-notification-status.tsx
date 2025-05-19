import { cn } from "~/lib/utils";

interface ImporterNotificationStatusProps {

  status: "idle" | "success" | "error";
  message: string;
}

export default function ImporterNotificationStatus({ status, message }: ImporterNotificationStatusProps) {
  return (
    <div className="flex gap-4 items-center">
      <span className="font-semibold text-sm">Status:</span>
      <span className={
        cn(
          "font-semibold text-sm",
          status === "error" && "text-red-500",
          status === "success" && "text-green-500",
          status === "idle" && "text-gray-500",
        )
      }>{message}</span>
    </div>
  )
}