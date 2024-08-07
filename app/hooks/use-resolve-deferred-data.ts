import { useEffect, useState } from "react";

/**
 *  // USAGE
    const loaderData = useLoaderData<typeof loader>()
    const [deferred_data, deferred_loading, deferred_error] = useResolveDeferredData(loaderData?.data?.payload.items)

    console.log({ deferred_data, deferred_loading, deferred_error })
 */

const isPromise = (input: any) => input && typeof input.then === "function";

const useResolveDeferredData = (input: any, emptyDataState = {}) => {
  const [data, setData] = useState<any>(
    isPromise(input) ? emptyDataState : input
  );
  const [loading, setLoading] = useState<boolean>(isPromise(input));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPromise(input)) {
      setLoading(true);

      Promise.resolve(input)
        .then((data) => {
          setData(data);
          setLoading(false);
        })
        .catch((error) => {
          if (error.message !== "Deferred data aborted") {
            // This should fire only in case of unexpected or expected server error
            setData(emptyDataState);
            setError(error.message);
            setLoading(false);
          }
        });
    } else {
      setData(input);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  return [data, loading, error];
};

export default useResolveDeferredData;
