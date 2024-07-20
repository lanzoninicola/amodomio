import { useEffect } from "react";

function useSaveShortcut({ callback }: { callback: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) && // Check if Ctrl or Cmd is pressed
        event.key === "s" // Check if the key is 's'
      ) {
        event.preventDefault(); // Prevent the default save action
        callback(); // Execute the callback function
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [callback]);
}

export default useSaveShortcut;
