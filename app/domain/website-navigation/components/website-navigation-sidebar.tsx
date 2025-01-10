import { Link, LinkProps } from "@remix-run/react"
import React, { Children } from "react"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet"
import { cn } from "~/lib/utils"
import { WebsiteNavigationLinks } from "../website-navigation.type"
import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { AlignLeft, AlignLeftIcon } from "lucide-react"


interface WebsiteNavigationSidebarProps {
    buttonTrigger?: {
        label: string
        classNameLabel?: string
        classNameButton?: string
        colorIcon?: string
    },
    homeLink: {
        label: string
        to: string
    }
    cnLink?: string
    navigationLinks: Partial<WebsiteNavigationLinks>
    children?: React.ReactNode
}

export function WebsiteNavigationSidebar({
    buttonTrigger,
    homeLink,
    navigationLinks,
    children,
    cnLink
}: WebsiteNavigationSidebarProps) {
    const [open, setOpen] = React.useState(false)

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
                <ScrollArea className="my-4 h-[calc(100vh-10rem)] pl-6">
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
                    <div className="flex flex-col space-y-2">
                        {navigationLinks?.sidebarNav && navigationLinks.sidebarNav.map((item, index) => (
                            <div key={index} className="flex flex-col space-y-3 pt-6">
                                <h4 className="font-semibold">{item.title}</h4>
                                {item?.items?.length &&
                                    item.items.map((item) => (
                                        <React.Fragment key={item.href}>
                                            {!item.disabled &&
                                                (item.href ? (
                                                    <MobileLink
                                                        to={item.href}
                                                        onOpenChange={setOpen}
                                                        className="text-muted-foreground"
                                                    >
                                                        {item.title}
                                                        {item.label && (
                                                            <span className="ml-2 rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs leading-none text-[#000000] no-underline group-hover:no-underline">
                                                                {item.label}
                                                            </span>
                                                        )}
                                                    </MobileLink>
                                                ) : (
                                                    item.title
                                                ))}
                                        </React.Fragment>
                                    ))}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                {children}
            </SheetContent>
        </Sheet>
    )
}

interface MobileLinkProps extends LinkProps {
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
    className?: string
}

function MobileLink({
    to,
    onOpenChange,
    className,
    children,
    ...props
}: MobileLinkProps) {
    return (
        <Link
            to={to}
            onClick={() => {
                onOpenChange?.(false)
            }}
            className={cn(className)}
            {...props}
        >
            {children}
        </Link>
    )
}