/**
 * @param { Promise } promise - An array of promises
 * @param { Object= } errorExt - Additional Information you can pass to the err object
 * @return { errors, results } - An object containing an array of errors and an array of results
 */
async function tryAll<T, U = Error>(
  promises: Promise<T>[],
  errorExt?: object
): Promise<{ errors: U[]; results: (T | undefined)[] }> {
  const errors: U[] = [];
  const results: (T | undefined)[] = await Promise.all(
    promises.map((promise) =>
      promise
        .then((data: T) => data)
        .catch((err: U) => {
          if (errorExt) {
            const parsedError = Object.assign({}, err, errorExt);
            errors.push(parsedError);
          } else {
            errors.push(err);
          }
          return undefined;
        })
    )
  );

  return { errors, results };
}

export default tryAll;
