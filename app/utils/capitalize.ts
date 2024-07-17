export default function capitalize(input: string | undefined): string {
  if (!input) return "";

  if (input.length === 0) return "";

  if (typeof input !== "string") return input;

  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}
