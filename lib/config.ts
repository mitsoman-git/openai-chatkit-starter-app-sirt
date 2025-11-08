import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What can you do for me?",
    prompt: "What can you do?",
    icon: "circle-question",
  },
  {
    label: "Tell me about a dish",
    prompt: "i like to ask for a dish you have",
    icon: "sparkle",
  },
   {
    label: "How can i reserve?",
    prompt: "reserve table",
    icon: "notebook-pencil",
  },
  {
    label: "How can i get there?",
    prompt: "where is sirtaki tavern?",
    icon: "map-pin",
  },
];

export const PLACEHOLDER_INPUT = "Ask anything about Sirtaki...";

export const GREETING = "👋 Hi! How can I help you today?";

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
  // Add other theme options here
  // chatkit.studio/playground to explore config options
});
