import slugify from "slugify";

export const slugifyString = (str: string | undefined | null) => {
  // if string is empty return empty string
  if (!str) return null;

  // if not a string return empty string
  if (typeof str !== "string") return null;

  // if string is empty return empty string
  if (str.trim() === "") return null;

  // if undefined return empty string
  if (str === undefined) return null;

  return slugify(str, {
    lower: true,
    strict: true,
    locale: "pt",
    replacement: "-",
  });
};
