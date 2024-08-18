export class RecipeUtilsEntity {
  static getTypes(): {
    key: "pizzaTopping" | "semiFinished";
    value: string;
  }[] {
    return [
      {
        key: "pizzaTopping",
        value: "Sabor Pizza",
      },
      {
        key: "semiFinished",
        value: "Produzido",
      },
    ];
  }
}
