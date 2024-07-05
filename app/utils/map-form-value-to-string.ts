export default function mapFormValueToString(
  value: FormDataEntryValue
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return value.toString();
}
