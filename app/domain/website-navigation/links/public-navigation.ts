import { Icons } from "~/components/primitives/icons/icons";
import { WebsiteNavigationConfig } from "../types/navigation-types";
import WEBSITE_LINKS from "./website-links";

const PUBLIC_NAVIGATION_LINKS: Partial<WebsiteNavigationConfig> = {
  mainNav: [
    WEBSITE_LINKS.faleConosco,
    WEBSITE_LINKS.instagram,
    WEBSITE_LINKS.maps,
  ],
};

export default PUBLIC_NAVIGATION_LINKS;
