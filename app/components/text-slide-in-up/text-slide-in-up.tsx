import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface TextSlideInUpProps {
    items: any[],
    slideCondition?: boolean
    cnHeight?: string
    cnText?: string
}

export default function TextSlideInUp({ items, slideCondition = true, cnHeight = "h-10", cnText }: TextSlideInUpProps) {

    const [currentItemIndex, setCurrentItemIndex] = useState(0);

    useEffect(() => {
        let interval: any;
        if (!slideCondition) {
            interval = setInterval(() => {
                setCurrentItemIndex((prevIndex) => (prevIndex + 1) % items.length);
            }, 3000); // Change label every 3 seconds
        } else {
            setCurrentItemIndex(0); // Reset to first label when store opens
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [slideCondition]);


    return (
        <div className={
            cn(
                "relative h-10 w-full",
                cnHeight
            )
        }>
            <div
                className={
                    cn(
                        "h-10 absolute top-0 left-0 right-0 transition-transform duration-500 ease-in-out overflow-hidden",
                        cnHeight
                    )
                }

            >
                {items.map((item, index) => {

                    if (index !== currentItemIndex) return null
                    return (
                        <div
                            key={index}
                            className={cn(
                                "h-10 w-full text-md font-semibold text-black grid place-items-center animate-slide-in-up",
                                cnHeight,
                                cnText
                            )}
                        >
                            {item}
                        </div>
                    )

                })}
            </div>
        </div>
    );
}
