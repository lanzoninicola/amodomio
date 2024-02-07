export function createDecreasingArray(startNumber: number, step: number) {
  const resultArray = [];

  while (startNumber >= 0) {
    const maxRange = startNumber;
    let minRange = startNumber - (step - 1);

    if (minRange < 0) {
      minRange = 0;
    }
    resultArray.push({
      max: maxRange,
      min: minRange,
    });
    startNumber -= step;
  }

  return resultArray;
}
