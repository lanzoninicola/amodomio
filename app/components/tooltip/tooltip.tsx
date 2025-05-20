import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TooltipDemoProps {
  trigger: React.ReactNode
  content: React.ReactNode
  showMark?: boolean
}

export default function Toooltip({ trigger, content, showMark }: TooltipDemoProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex">
            {trigger}{showMark && (
              <span className="text-xs text-gray-500">
                <span className="text-red-500">*</span>
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
