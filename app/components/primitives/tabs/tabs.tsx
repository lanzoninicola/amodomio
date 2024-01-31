import { Link, useSearchParams } from "@remix-run/react"
import { cn } from "~/lib/utils"

export interface TabItem {
    id: string
    name: string
    linkTo?: string
    default?: boolean
    disabled?: boolean
}

export interface TabsProps {
    tabs: TabItem[]
    bgStyle?: string
    activeTabStyle?: string
    inactiveTabStyle?: string
    className?: string
}


export default function Tabs({ tabs, bgStyle, activeTabStyle, inactiveTabStyle, className }: TabsProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    let currentActiveTab = searchParams.get("tab")

    let baseActiveTabStyle = "rounded-md py-1"
    activeTabStyle = activeTabStyle ? `${baseActiveTabStyle} ${activeTabStyle}` : `${baseActiveTabStyle} bg-white text-black font-semibold`
    const backgroundStyle = bgStyle ? bgStyle : "bg-muted"


    return (
        <div className={
            cn(
                `relative flex flex-wrap justify-center min-w-fit items-center p-1 rounded-md text-muted-foreground mb-6 ${backgroundStyle}`,
                backgroundStyle,
                className
            )
        }>

            {tabs.map((tab, idx) => {

                if (!currentActiveTab) {
                    if (tab.default === true) {
                        currentActiveTab = tab.id
                    }
                }

                const children = (
                    <div className={
                        cn(
                            `m-1`,
                            currentActiveTab === tab.id ? activeTabStyle : inactiveTabStyle,
                            currentActiveTab === tab.id ? "cursor-default" : "cursor-pointer"
                        )
                    }>
                        <span>{tab.name}</span>
                    </div>
                )

                if (tab.linkTo && tab.disabled === false) return (
                    <Link key={idx} to={tab.linkTo} className="w-1/2 md:w-1/4 lg:w-1/6 text-center">
                        {children}
                    </Link >
                )


                return (
                    <div key={idx} className="w-1/2 md:w-1/4 lg:w-1/6 text-center" onClick={() => setSearchParams({ tab: tab.id })}>
                        {children}
                    </div>
                )


            })}

        </div >
    )
}