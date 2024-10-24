
import { Link } from "@remix-run/react";
import { Globe, Shield } from "lucide-react";
import { WebsiteNavigation } from "../mobile-nav/mobile-nav";
import { cn } from "~/lib/utils";
import { WebsiteNavigationSidebar } from "~/domain/website-navigation/components/website-navigation-sidebar";
import ADMIN_WEBSITE_NAVIGATION_ITEMS from "~/domain/website-navigation/admin/admin-website.nav-links";


interface AdminHeaderProps {
    urlSegment?: string
}


export function AdminHeader({ urlSegment }: AdminHeaderProps) {


    return (
        <header className={
            cn(
                "sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                urlSegment === "orders-delivery-time-left" && "hidden",
                urlSegment === "export-wall" && "hidden",
                urlSegment === "export-wall-two" && "hidden",

            )
        }>
            <div className="container flex h-14 max-w-screen-2xl items-center">
                <WebsiteNavigationSidebar
                    homeLink={{ label: "Iniçio", to: "admin" }}
                    navigationLinks={ADMIN_WEBSITE_NAVIGATION_ITEMS}
                    buttonTrigger={{
                        label: "Menu de navegação",
                    }}

                />
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* <CommandMenu /> */}
                    </div>
                    <nav className="flex items-center justify-center gap-6 lg:gap-4">
                        <Link to={"/admin"}>
                            <div className="flex gap-2 items-center hover:bg-slate-50 rounded-md p-2">
                                <Shield />
                                <span className="hidden text-foreground/60 transition-colors hover:text-foreground/80 lg:block">Administraçao</span>
                            </div>
                        </Link>
                        <Link to={"/"}>
                            <div className="flex gap-2 items-center hover:bg-slate-50 rounded-md p-2">
                                <Globe />
                                <span className="hidden text-foreground/60 transition-colors hover:text-foreground/80 lg:block">Website</span>
                            </div>
                        </Link>

                        {/* <ModeToggle /> */}
                    </nav>
                </div>
            </div>
        </header>
    )
}