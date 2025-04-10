import { serverError } from "./http-response.server";

export default function toNumber(value: unknown): number {
  if (value === undefined || value === null) {
    value = 0;
  }

  if (typeof value === "string") {
    // Replace comma with dot to handle pt-BR decimal format
    value = value.replace(",", ".");
  }

  const number = Number(value);

  if (isNaN(number)) {
    serverError(`"${value}" is not a valid number`);
  }

  return number;
}
