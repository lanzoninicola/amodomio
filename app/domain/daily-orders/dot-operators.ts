import { DOTOperator } from "./daily-order.model.server";

export default function dotOperators(id?: string): DOTOperator[] | DOTOperator {
  const operators = [
    { id: 0, name: "gustavo" },
    { id: 1, name: "nicola" },
    { id: 2, name: "mara" },
    { id: 3, name: "kelly" },
  ];

  if (id) {
    return operators.filter((operator) => operator.id === Number(id))[0];
  }

  return operators;
}
