export default function right(str: string, x: number) {
  // Check if x is greater than the length of the string
  if (x > str.length) {
    return str;
  }
  // Return the last x characters of the string
  return str.slice(-x);
}
