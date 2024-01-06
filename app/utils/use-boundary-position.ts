import { useState, useEffect, useRef } from "react";

type Boundary = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

const useBoundaryPosition = (): {
  boundary: Boundary | null;
  elementRef: React.MutableRefObject<HTMLDivElement | null>;
} => {
  const [boundary, setBoundary] = useState<Boundary | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const calculateBoundary = () => {
    if (elementRef.current) {
      const elementRect = elementRef.current.getBoundingClientRect();
      const boundaryPosition: Boundary = {
        top: elementRect.top,
        bottom: elementRect.bottom,
        left: elementRect.left,
        right: elementRect.right,
        width: elementRect.width,
        height: elementRect.height,
      };
      setBoundary(boundaryPosition);
    }
  };

  useEffect(() => {
    calculateBoundary();
    const handleResize = () => {
      calculateBoundary();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return { boundary, elementRef };
};

export default useBoundaryPosition;
