import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getDailyProgramming } from "../api/client";
import type { Plan, SizeKey } from "./calculation";
import {
  applyForecasts,
  FORECAST_OPTIONS,
  hasForecast,
  initialForecastDocument,
  loadForecasts,
  parseForecastDocument,
  restoreAutomatic,
  SALES_FIELDS,
  type ForecastDocument,
  type SalesField,
} from "./forecasts";

export function usePlanningForecasts({
  apiUrl,
  token,
  storageScope,
  dates,
  legacyPlan,
  planReady,
  onUnauthorized,
}: {
  apiUrl: string;
  token: string;
  storageScope: string;
  dates: string[];
  legacyPlan: Plan;
  planReady: boolean;
  onUnauthorized: () => void;
}) {
  const storageKey = `amodomio:dough-forecast:v1:${storageScope}`;
  const empty: ForecastDocument = { version: 1, cache: {}, manual: {} };
  const [document, setDocument] = useState<ForecastDocument>(empty);
  const documentRef = useRef(document);
  const legacyRef = useRef({ plan: legacyPlan, dates });
  legacyRef.current = { plan: legacyPlan, dates };
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [dayErrors, setDayErrors] = useState<Record<string, unknown>>({});
  const [retry, setRetry] = useState(0);
  const [reloadStorage, setReloadStorage] = useState(0);
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const write = useCallback(
    (next: ForecastDocument) => {
      const current = ++revision.current;
      writes.current = writes.current
        .catch(() => {})
        .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)))
        .then(() => {
          if (revision.current === current) setStorageError("");
        })
        .catch(() => {
          if (revision.current === current)
            setStorageError(
              "Não foi possível salvar as previsões. Toque em Tentar novamente."
            );
        });
    },
    [storageKey]
  );
  const commit = useCallback(
    (change: (previous: ForecastDocument) => ForecastDocument) => {
      const next = change(documentRef.current);
      documentRef.current = next;
      setDocument(next);
      write(next);
    },
    [write]
  );
  useEffect(() => {
    if (!planReady) return;
    let active = true;
    setReady(false);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        const restored = raw
          ? parseForecastDocument(raw)
          : initialForecastDocument(
              legacyRef.current.plan,
              legacyRef.current.dates
            );
        documentRef.current = restored;
        setDocument(restored);
        setReady(true);
        setStorageError("");
        if (!raw) write(restored);
      })
      .catch(() => {
        if (active)
          setStorageError(
            "Não foi possível abrir as previsões salvas. Toque em Tentar novamente."
          );
      });
    return () => {
      active = false;
    };
  }, [storageKey, planReady, reloadStorage, write]);
  const date0 = dates[0],
    date1 = dates[1],
    date2 = dates[2];
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const requestedDates = [date0, date1, date2];
    setLoading(true);
    setDayErrors({});
    loadForecasts(
      requestedDates,
      (weekday, signal) =>
        getDailyProgramming(
          apiUrl,
          token,
          weekday,
          FORECAST_OPTIONS.pct,
          FORECAST_OPTIONS.n,
          signal
        ),
      controller.signal
    )
      .then(({ cache, errors }) => {
        if (controller.signal.aborted) return;
        if (
          Object.values(errors).some(
            (error) => error instanceof ApiError && error.status === 401
          )
        ) {
          unauthorizedRef.current();
          return;
        }
        setDayErrors(errors);
        // Merge into the latest document: manual edits made during loading survive.
        if (Object.keys(cache).length)
          commit((previous) => ({
            ...previous,
            cache: { ...previous.cache, ...cache },
          }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDayErrors(
            Object.fromEntries(requestedDates.map((date) => [date, true]))
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl, token, date0, date1, date2, ready, retry, commit]);
  function setManual(field: SalesField, size: SizeKey, value: string) {
    if (!ready) return;
    const date = dates[SALES_FIELDS.indexOf(field)];
    commit((previous) => ({
      ...previous,
      manual: {
        ...previous.manual,
        [date]: { ...previous.manual[date], [size]: value },
      },
    }));
  }
  function clearSales() {
    if (!ready) return;
    commit((previous) => ({
      ...previous,
      manual: {
        ...previous.manual,
        ...Object.fromEntries(
          dates.map((date) => [
            date,
            { family: "", medium: "", individual: "", small: "" },
          ])
        ),
      },
    }));
  }
  function useAutomatic() {
    if (!ready) return;
    commit((previous) => restoreAutomatic(previous, dates));
    setRetry((value) => value + 1);
  }
  const manualCount = dates.reduce(
    (count, date) => count + Object.keys(document.manual[date] ?? {}).length,
    0
  );
  return {
    plan: ready ? applyForecasts(legacyPlan, dates, document) : legacyPlan,
    ready,
    loading,
    storageError,
    manualCount,
    hasError: dates.some((date) => dayErrors[date]),
    hasDay: (date: string) => ready && hasForecast(document, date),
    setManual,
    clearSales,
    useAutomatic,
    retry: () => {
      if (!ready) setReloadStorage((value) => value + 1);
      else {
        write(documentRef.current);
        setRetry((value) => value + 1);
      }
    },
  };
}
