// export default function formatStringList(
//   strings: string[] | undefined
// ): string {
//   if (!strings) return "";
//   if (strings.length === 0) return "";

//   const trimmedStrings = strings.map((str) => str.trim());
//   return trimmedStrings.join(", ") + ".";
// }

export default function formatStringList(
  strings: string[] | undefined,
  options?: { firstLetterCapitalized: true }
): string[] {
  if (!strings) return "";
  if (strings.length === 0) return "";

  return strings.map((str) => {
    const trimmedStr = str.trim();

    if (options?.firstLetterCapitalized === true) {
      return (
        trimmedStr.charAt(0).toUpperCase() + trimmedStr.slice(1).toLowerCase()
      );
    }

    return trimmedStr;
  });
}
