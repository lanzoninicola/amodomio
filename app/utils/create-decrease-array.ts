export default function createDecreasingArray(
  startNumber: number,
  step: number
) {
  const resultArray = [];

  while (startNumber >= 0) {
    resultArray.push(startNumber);
    startNumber -= step;
  }

  return resultArray;
}
