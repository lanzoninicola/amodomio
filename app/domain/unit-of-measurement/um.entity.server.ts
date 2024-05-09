// Enums to define supported units
enum LengthUnit {
  Meters = "m",
  Kilometers = "km",
  Miles = "mi",
}

enum VolumeUnit {
  Liters = "l",
  Milliliters = "ml",
}

enum WeightUnit {
  Kilograms = "kg",
  Grams = "g",
}

// Interfaces to enforce correct function signatures
interface IConverter<T> {
  convert(value: number, fromUnit: T, toUnit: T): number;
}

interface IWeightConverter extends IConverter<WeightUnit> {
  toKg(value: number, fromUnit: WeightUnit): number;
  toGr(value: number, fromUnit: WeightUnit): number;
}

interface IVolumeConverter extends IConverter<VolumeUnit> {
  toLt(value: number, fromUnit: VolumeUnit): number;
}

class VolumeConverter implements IVolumeConverter {
  convert(value: number, fromUnit: VolumeUnit, toUnit: VolumeUnit): number {
    const factors = {
      [VolumeUnit.Liters]: 1,
      [VolumeUnit.Milliliters]: 0.001,
    };

    if (!(fromUnit in factors && toUnit in factors)) {
      throw new Error("Unsupported unit");
    }

    return (value * factors[fromUnit]) / factors[toUnit];
  }

  toLt(value: number, fromUnit: VolumeUnit) {
    return this.convert(value, fromUnit, VolumeUnit.Liters);
  }
}

class WeightConverter implements IWeightConverter {
  convert(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
    const factors = {
      [WeightUnit.Kilograms]: 1,
      [WeightUnit.Grams]: 0.001,
    };

    if (!(fromUnit in factors && toUnit in factors)) {
      throw new Error("Unsupported unit");
    }

    return (value * factors[fromUnit]) / factors[toUnit];
  }

  toKg(value: number, fromUnit: WeightUnit) {
    return this.convert(value, fromUnit, WeightUnit.Kilograms);
  }

  toGr(value: number, fromUnit: WeightUnit) {
    return this.convert(value, fromUnit, WeightUnit.Grams);
  }
}

interface IUM {
  volumeConvert: IConverter<VolumeUnit>;
  weightConverter: IConverter<WeightUnit>;
}

class UM {
  private _volume: IConverter<VolumeUnit>;
  private _weight: IConverter<WeightUnit>;

  constructor({ volumeConvert, weightConverter }: IUM) {
    this._volume = volumeConvert;
    this._weight = weightConverter;
  }

  get volume() {
    return this._volume;
  }

  get weight() {
    return this._weight;
  }

  /**
   * This function returns a list of all supported units.
   *
   * @param options
   * @returns
   */
  units(options: { case: "uppercase" | "lowercase" } = { case: "uppercase" }) {
    const units = [
      "un",
      ...Object.values(VolumeUnit),
      ...Object.values(WeightUnit),
    ];

    if (options.case === "uppercase") {
      return units.map((unit) => unit.toUpperCase());
    }
    return units;
  }
}

export const umEntity = new UM({
  volumeConvert: new VolumeConverter(),
  weightConverter: new WeightConverter(),
});
