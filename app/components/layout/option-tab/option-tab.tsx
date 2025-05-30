import { cn } from "~/lib/utils"

const OptionTab = ({ label, onClickFn, highlightCondition }: {
  label: string,
  onClickFn?: () => void,
  highlightCondition: boolean
}) => {
  return (
    <div className={
      cn(
        "grid place-items-center bg-none cursor-pointer p-1 hover:bg-slate-500 hover:text-white transition-colors duration-200",
        highlightCondition === true && "bg-black text-white font-semibold px-2 py-1",
      )
    }>
      <span className={
        cn(
          "text-xs uppercase tracking-widest cursor-pointer text-center hover:font-semibold transition-colors duration-200",
        )
      }
        onClick={onClickFn}>{label}</span>
    </div>
  )
}

export default OptionTab