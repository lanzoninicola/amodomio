import { PrismaClient } from "@prisma/client";

export const prismaClient = new PrismaClient();

/**
 * @param { Promise } promise
 * @param { Object= } errorExt - Additional Information you can pass to the err object
 * @return { Promise }
 */
function tryit<T, U = Error>(
  promise: Promise<T>,
  errorExt?: object
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt);
        return [parsedError, undefined];
      }

      return [err, undefined];
    });
}

/**
 * This is utilized to encapsulate the function responsible for querying the database and ensuring proper handling in the event of the client closing
 *
 * @param promise
 * @param errorExt
 * @returns
 */
export function prismaIt<T, U = Error>(promise: Promise<T>, errorExt?: object) {
  return tryit(promise, errorExt).finally(async () => {
    // do something
    await prismaClient.$disconnect();
  });
}
