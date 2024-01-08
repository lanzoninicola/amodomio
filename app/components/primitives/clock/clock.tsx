import dayjs from "dayjs";
import { useState, useEffect } from "react";

const Clock = () => {
    const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm:ss'));

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(dayjs().format('HH:mm:ss'));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <p className="text-3xl font-mono">{currentTime}</p>
        </div>
    );
};

export default Clock;