import { Icons } from "~/components/primitives/icons/icons";
import { WebsiteNavigationLinks } from "../website-navigation.type";
import GLOBAL_LINKS from "../global-links.constant";

const PUBLIC_WEBSITE_NAVIGATION_ITEMS: Partial<WebsiteNavigationLinks> = {
  mainNav: [
    GLOBAL_LINKS.faleConosco,
    GLOBAL_LINKS.instagram,
    GLOBAL_LINKS.maps,
  ],
};

export default PUBLIC_WEBSITE_NAVIGATION_ITEMS;
