import { cn } from "~/lib/utils";

interface ImporterNotificationStatusProps {

  status: "idle" | "success" | "error";
  message: string;
}

export default function ImporterNotificationStatus({ status, message }: ImporterNotificationStatusProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2 p-4 rounded-md",
      status === "error" && "bg-red-100 text-red-800",
      status === "success" && "bg-green-100 text-green-800",
      status === "idle" && "bg-gray-100 text-gray-800",
    )}>
      <span className="font-semibold text-xs uppercase tracking-wide">Status:</span>
      <p className={
        cn(
          "text-xs whitespace-pre-line leading-none",
          status === "error" && "text-red-500",
          status === "success" && "text-green-500",
          status === "idle" && "text-gray-500",
        )}>
        {message}
      </p>
    </div>
  )
}