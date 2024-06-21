export default function left(str: string, x: number) {
  // Check if x is greater than the length of the string
  if (x > str.length) {
    return str;
  }
  // Return the first x characters of the string
  return str.slice(0, x);
}
