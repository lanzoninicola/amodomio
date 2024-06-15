import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";

interface ClockProps {
    showSeconds?: boolean
    highContrast?: boolean
    minutesToAdd?: number
}

const Clock = ({
    showSeconds = true,
    highContrast = false,
    minutesToAdd = 0
}: ClockProps) => {

    const timeFormat = showSeconds ? 'HH:mm:ss' : 'HH:mm';

    const [currentTime, setCurrentTime] = useState(dayjs().format(timeFormat));



    useEffect(() => {
        const interval = setInterval(() => {
            const currentDate = minutesToAdd > 0 ? dayjs().add(minutesToAdd, 'minute') : dayjs()
            const formattedDate = currentDate.format(timeFormat);
            setCurrentTime(formattedDate);
        }, 1000);

        return () => clearInterval(interval);
    }, [showSeconds, minutesToAdd]);

    return (
        <div className={
            cn(
                highContrast && "bg-brand-blue py-1 px-4 rounded-md text-white"
            )
        }>
            <p className="text-5xl font-semibold">{currentTime}</p>
        </div>
    );
};

export default Clock;