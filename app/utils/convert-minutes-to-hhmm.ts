/**
 * Convert minutes in number to format HH:MM
 */
export default function convertMinutesToHHMM(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours.toString().padStart(2, "0")}h:${remainingMinutes
    .toString()
    .padStart(2, "0")}m`;
}
