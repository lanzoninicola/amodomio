export {
  action,
  loader,
} from "~/domain/pizza-flavor-wizard/pizza-flavor-wizard-route.server";

import PizzaFlavorWizardRoute from "~/domain/pizza-flavor-wizard/pizza-flavor-wizard-route";

export default function AdminMobileNewPizzaFlavor() {
  return <PizzaFlavorWizardRoute mobile />;
}
