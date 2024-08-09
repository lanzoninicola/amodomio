import { prismaIt } from "./prisma-it.server";

export async function prismaAll(promises: Promise<any>[]) {
  const returnedPromises = promises.map((p) => prismaIt(p));
  return Promise.all(returnedPromises);
}
