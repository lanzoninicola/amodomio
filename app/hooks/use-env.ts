import { useMatches } from "@remix-run/react";

export const useEnv = () => {
  const matches = useMatches();
  const data =
    matches.find((route) => {
      return route.id === "root";
    })?.data || {};

  const ENV = data.payload?.env;

  return ENV || {};
};
