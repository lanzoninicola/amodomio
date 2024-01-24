export function createDecreasingArray(startNumber: number, step: number) {
  const resultArray = [];

  while (startNumber >= 0) {
    resultArray.push({
      max: startNumber,
      min: startNumber - (step - 1),
    });
    startNumber -= step;
  }

  return resultArray;
}
