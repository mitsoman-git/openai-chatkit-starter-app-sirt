import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// 👇 Update this section
export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "Show me the menu",
    prompt: "What dishes are on your menu?",
    icon: "utensils-crossed",
  },
  {
    label: "Book a table",
    prompt: "I’d like to make a reservation.",
    icon: "calendar-days",
  },
  {
    label: "Opening hours",
    prompt: "When are you open?",
    icon: "clock",
  },
  {
    label: "Location & contact",
    prompt: "Where is the restaurant and how can I contact you?",
    icon: "map-pin",
  },
  {
    label: "Sirtaki Meze",
    prompt: "I like to pre-order the Meze",
    icon: "sparkles",
  },
  {
    label: "Allergies or dietary options",
    prompt: "Do you have vegan, gluten-free, or nut-free dishes?",
    icon: "heart-pulse",
  },
];

export const PLACEHOLDER_INPUT = "Ask about reservations, menu, or more…";

export const GREETING = "👋 Welcome to Sirtaki — your Greek dining assistant!";

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: {
      hue: 220,
      tint: 6,
      shade: theme === "dark" ? -1 : -4,
    },
    accent: {
      primary: theme === "dark" ? "#f1f5f9" : "#0f172a",
      level: 1,
    },
  },
  radius: "round",
});
