import { CircleHelp } from "lucide-react";

export function DnaHelpLink(props: {
  label: string;
  url?: string | null;
  className?: string;
}) {
  if (!props.url) {
    return <span className={props.className}>{props.label}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${props.className || ""}`.trim()}>
      <span>{props.label}</span>
      <a
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ajuda sobre DNA"
        className="text-slate-400 transition hover:text-slate-700"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}
