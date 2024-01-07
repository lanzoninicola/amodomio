import { type HTMLAttributes } from "react";

interface FadeInProps {
  children: React.ReactNode;
  clazzName?: HTMLAttributes<HTMLDivElement>["className"];
}

export default function FadeIn({ children, clazzName }: FadeInProps) {
  return <div className={`w-full animate-fadeIn ${clazzName}`}>{children}</div>;
}
