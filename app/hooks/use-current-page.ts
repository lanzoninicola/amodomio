import { matchPath, useLocation } from "@remix-run/react";
import { useMemo } from "react";

export type CurrentPage = "busca" | "single" | "other";

const searchPagePath = "/cardapio/buscar";
const singleItemPattern = "/cardapio/:id";

export default function useCurrentPage(): CurrentPage {
  const { pathname } = useLocation();

  return useMemo<CurrentPage>(() => {
    if (matchPath({ path: searchPagePath, end: false }, pathname)) {
      return "busca";
    }

    if (matchPath({ path: singleItemPattern, end: true }, pathname)) {
      return "single";
    }

    return "other";
  }, [pathname]);
}
