import type { MetaFunction } from "@remix-run/node";
import { Outlet, useNavigation } from "@remix-run/react";
import Loading from "~/components/loading/loading";

export const meta: MetaFunction = () => [{ title: "CRM - Módulo" }];

export default function AdminCrmLayout() {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 ">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">CRM</h1>
      </header>

      {isLoading ? (
        <Loading showText text="Carregando..." cnContainer="min-h-[260px]" />
      ) : (
        <Outlet />
      )}
    </div>
  );
}
