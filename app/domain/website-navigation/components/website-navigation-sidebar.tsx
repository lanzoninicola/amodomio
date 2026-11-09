import React from "react"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet"
import { cn } from "~/lib/utils"
import { AlignLeftIcon } from "lucide-react"
import MobileLink from "./mobile-link"
import { WebsiteNavigationConfig } from "../types/navigation-types"
import { Separator } from "~/components/ui/separator"

export interface WebsiteNavigationSidebarProps {
    buttonTrigger?: {
        label: string;
        classNameLabel?: string;
        classNameButton?: string;
        colorIcon?: string;
    };
    homeLink: {
        label: string;
        to: string;
    };
    cnLink?: string;
    navigationLinks: Partial<WebsiteNavigationConfig>;
    children?: React.ReactNode;
    preMenuContent?: React.ReactNode
}


export function WebsiteNavigationSidebar({
    buttonTrigger,
    homeLink,
    navigationLinks,
    children,
    cnLink,
    preMenuContent
}: WebsiteNavigationSidebarProps) {
    const [open, setOpen] = React.useState(false)

    const renderSidebarItems = (
        items: WebsiteNavigationConfig["sidebarNav"][number]["items"],
        depth = 0
    ) => {
        return items
            .filter((item) => item.disabled === false)
            .map((item) => (
                <div
                    key={`${item.title}-${item.href ?? "no-link"}`}
                    className={cn(depth > 0 && "pl-4 border-l border-muted")}
                >
                    {item.href ? (
                        <MobileLink
                            to={item.href}
                            onOpenChange={setOpen}
                            className={cn(
                                "text-muted-foreground",
                                depth === 0 && "text-sm",
                                depth > 0 && "text-xs"
                            )}
                        >
                            {item.title}
                            {item.label && (
                                <span className="ml-2 rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs leading-none text-[#000000] no-underline group-hover:no-underline">
                                    {item.label}
                                </span>
                            )}
                        </MobileLink>
                    ) : (
                        <span
                            className={cn(
                                "text-muted-foreground",
                                depth === 0 && "text-sm",
                                depth > 0 && "text-xs"
                            )}
                        >
                            {item.title}
                        </span>
                    )}
                    {item.items?.length ? (
                        <div className="mt-2 flex flex-col space-y-2">
                            {renderSidebarItems(item.items, depth + 1)}
                        </div>
                    ) : null}
                </div>
            ))
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    className={
                        cn(
                            "mr-2 text-base focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 flex gap-2 bg-black text-white px-2 py-1 rounded-md hover:bg-black/20 hover:text-black",
                            buttonTrigger?.classNameButton
                        )
                    }
                >
                    {/* <svg
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                    >
                        <path
                            d="M3 5H11"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        ></path>
                        <path
                            d="M3 12H16"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        ></path>
                        <path
                            d="M3 19H21"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        ></path>
                    </svg> */}
                    <AlignLeftIcon className="h-5 w-5" color={buttonTrigger?.colorIcon} />
                    <span className={
                        cn(
                            "hidden font-semibold md:block ",
                            buttonTrigger?.classNameLabel
                        )
                    }>
                        {buttonTrigger?.label ?? "Menu de Navegação"}
                    </span>
                </Button>

            </SheetTrigger>
            <SheetContent side="left" className="pr-0 ">
                <MobileLink
                    to={homeLink.to}
                    className="flex items-center"
                    onOpenChange={setOpen}
                >
                    <span className="font-bold">{homeLink.label ?? "Iniçio"}</span>
                </MobileLink>
                <ScrollArea className="my-4 h-screen md:h-[calc(100vh-10rem)]">
                    {preMenuContent}
                    <Separator className="my-3" />
                    <div className="flex flex-col space-y-3">
                        {navigationLinks?.mainNav && navigationLinks.mainNav?.map(
                            (item) =>
                                item.href && (
                                    <MobileLink
                                        key={item.href}
                                        to={item.href}
                                        onOpenChange={setOpen}
                                        className={cn(cnLink)}
                                    >
                                        {item.title}
                                    </MobileLink>
                                )
                        )}
                    </div>
                    <div className="flex flex-col space-y-2 mb-12">
                        {navigationLinks?.sidebarNav && navigationLinks.sidebarNav.map((item, index) => (
                            <div key={index} className="flex flex-col space-y-3 pt-6">
                                <h4 className="font-semibold">{item.title}</h4>
                                {item?.items?.length ? renderSidebarItems(item.items) : null}
                            </div>
                        ))}
                    </div>
                    {children}
                </ScrollArea>

            </SheetContent>
        </Sheet>
    )
}
