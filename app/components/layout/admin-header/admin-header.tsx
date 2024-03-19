
import { Link } from "@remix-run/react";
import { Globe, Shield } from "lucide-react";
import { WebsiteNavigation } from "../mobile-nav/mobile-nav";

export function AdminHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center">
                <WebsiteNavigation />
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