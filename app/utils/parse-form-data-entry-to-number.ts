export default function parserFormDataEntryToNumber(entry: FormDataEntryValue) {
  if (entry === null || entry === undefined) {
    return 0;
  }

  return isNaN(Number(entry)) ? 0 : Number(entry);
}
