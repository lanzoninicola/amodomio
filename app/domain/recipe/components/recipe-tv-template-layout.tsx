import type { ReactNode } from "react";

export function RecipeTvTemplateLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 p-6 lg:p-10">
      <div className="mx-auto max-w-[1600px] rounded-2xl bg-slate-50 p-6 text-slate-900 lg:p-10 [&_h2]:text-4xl [&_.text-xs]:text-base [&_.text-sm]:text-xl [&_.text-lg]:text-2xl [&_input:not([type=hidden])]:min-h-14 [&_button]:min-h-12 [&_li]:p-5 [&_li_.leading-5]:leading-relaxed [&_ul]:grid [&_ul]:gap-4 xl:[&_ul]:grid-cols-2">
        {children}
      </div>
    </main>
  );
}
