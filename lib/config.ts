export type StarterPrompt = { label: string; prompt: string };

export const STARTER_PROMPTS: StarterPrompt[] = [
  { label: "What can you help me with?", prompt: "What can you do?" },
  { label: "How can I reserve?", prompt: "I would like to reserve a table" },
  { label: "How can I get there?", prompt: "where is sirtaki tavern?" },
  { label: "Tell me more about a dish", prompt: "i like to ask for a dish you have" },
  { label: "Can you recommend a wine?", prompt: "I’d like a wine recommendation with my meal" },
];

export const PLACEHOLDER_INPUT = "Ask anything about Sirtaki...";

export const GREETING = "👋 Hi! How can I help you today?";

export const ERROR_REPLY =
  "I'm sorry, something went wrong on my end — please try again or reach us on WhatsApp.";
