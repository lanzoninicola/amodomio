import { Link } from "@remix-run/react";
import OptionTab from "../layout/option-tab/option-tab";



export default function OptionLinkTab({ href, label, onClickFn, highlightCondition }: {
  href: string,
  label: string,
  onClickFn?: () => void,
  highlightCondition: boolean
}) {
  return (
    <Link to={href} className="grid place-items-center bg-none">
      <OptionTab label={label} onClickFn={onClickFn} highlightCondition={highlightCondition} />
    </Link>
  );
}