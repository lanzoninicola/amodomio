export interface BrandColors {
  brand: {
    blue: string;
  };
  muted: {
    yellow: string;
  };
  accent: {
    // Use for main CTAs (e.g., "Order Now") to grab attention with a warm, inviting tone.
    coral: string;
    // Use for promotions or highlighting important deals to evoke urgency.
    yellow: string;
    // Use for secondary actions or interactive elements to maintain a calm, modern feel.
    teal: string;
    // Use for standout elements like buttons and icons to make them highly noticeable.
    orange: string;
    // Use for success messages or confirmation states to convey positivity and completion.
    green: string;
    // Use sparingly for alerts or important notifications to signify urgency or warnings.
    warmRed: string;
  };
}

export default function useBrandColors(): BrandColors {
  return {
    brand: {
      blue: "#3d5f76",
    },
    muted: {
      yellow: "#fffaea",
    },
    accent: {
      coral: "#ff6b6b",
      yellow: "#ffc107",
      teal: "#20c997",
      orange: "#ff8c42",
      green: "#22c55e",
      warmRed: "#e74c3c",
    },
  };
}
