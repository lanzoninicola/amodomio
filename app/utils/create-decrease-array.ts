export function createDecreasingArray(
  startNumber: number,
  stepTimeAmount: number
) {
  const resultArray = [];
  let stepNumber = 0;

  while (startNumber >= 0) {
    const maxRange = startNumber;
    let minRange = startNumber - (stepTimeAmount - 1);

    if (minRange < 0) {
      minRange = 0;
    }
    resultArray.push({
      max: maxRange,
      min: minRange,
      stepNumber: ++stepNumber,
    });
    startNumber -= stepTimeAmount;
  }

  const maxStepNumber = resultArray.length;

  return resultArray.map((r) => {
    return {
      ...r,
      maxStepNumber,
      isFirstStep: r.stepNumber === 1,
      isLastStep: r.stepNumber === maxStepNumber,
    };
  });
}
