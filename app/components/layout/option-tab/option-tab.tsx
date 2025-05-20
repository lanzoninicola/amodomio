import { cn } from "~/lib/utils"

const OptionTab = ({ label, onClickFn, highlightCondition }: {
  label: string,
  onClickFn?: () => void,
  highlightCondition: boolean
}) => {
  return (
    <div className={
      cn(
        "grid place-items-center bg-none",
        highlightCondition === true && "bg-black text-white font-semibold px-2 py-1",
      )
    }>
      <span className={
        cn(
          "text-xs uppercase tracking-widest cursor-pointer hover:underline",
        )
      }
        onClick={onClickFn}>{label}</span>
    </div>
  )
}

export default OptionTab