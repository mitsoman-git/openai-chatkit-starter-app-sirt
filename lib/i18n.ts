import { ERROR_REPLY, GREETING, PLACEHOLDER_INPUT, STARTER_PROMPTS, type StarterPrompt } from "./config";

export type Lang = "en" | "el" | "de" | "fr";

export type UiText = {
  greeting: string;
  placeholder: string;
  send: string;
  newChat: string;
  error: string;
  starters: StarterPrompt[];
};

export const UI: Record<Lang, UiText> = {
  en: {
    greeting: GREETING,
    placeholder: PLACEHOLDER_INPUT,
    send: "Send",
    newChat: "New chat",
    error: ERROR_REPLY,
    starters: STARTER_PROMPTS,
  },
  el: {
    greeting: "👋 Γεια σας, εδώ ο Sirtaki! Πώς μπορώ να σας βοηθήσω σήμερα;",
    placeholder: "Ρωτήστε ό,τι θέλετε για το Sirtaki...",
    send: "Αποστολή",
    newChat: "Νέα συνομιλία",
    error: "Λυπάμαι, κάτι πήγε στραβά — δοκιμάστε ξανά ή επικοινωνήστε μαζί μας στο WhatsApp.",
    starters: [
      { label: "Σε τι μπορείτε να με βοηθήσετε;", prompt: "Τι μπορείτε να κάνετε για μένα;" },
      { label: "Πώς κάνω κράτηση;", prompt: "Θα ήθελα να κλείσω ένα τραπέζι" },
      { label: "Πώς θα έρθω σε εσάς;", prompt: "Πού βρίσκεται το Sirtaki Tavern;" },
      { label: "Πείτε μου για ένα πιάτο", prompt: "Θα ήθελα να ρωτήσω για ένα πιάτο που έχετε" },
      { label: "Μπορείτε να προτείνετε ένα κρασί;", prompt: "Θα ήθελα μια πρόταση για κρασί με το γεύμα μου" },
    ],
  },
  de: {
    greeting: "👋 Hallo, hier ist Sirtaki! Wie kann ich Ihnen heute helfen?",
    placeholder: "Fragen Sie alles über Sirtaki...",
    send: "Senden",
    newChat: "Neuer Chat",
    error: "Es tut mir leid, etwas ist schiefgelaufen – bitte versuchen Sie es erneut oder schreiben Sie uns per WhatsApp.",
    starters: [
      { label: "Wobei können Sie mir helfen?", prompt: "Was können Sie für mich tun?" },
      { label: "Wie kann ich reservieren?", prompt: "Ich möchte einen Tisch reservieren" },
      { label: "Wie komme ich zu Ihnen?", prompt: "Wo befindet sich die Taverne Sirtaki?" },
      { label: "Erzählen Sie mir von einem Gericht", prompt: "Ich möchte nach einem Gericht von Ihrer Karte fragen" },
      { label: "Können Sie einen Wein empfehlen?", prompt: "Ich hätte gern eine Weinempfehlung zu meinem Essen" },
    ],
  },
  fr: {
    greeting: "👋 Bonjour, ici Sirtaki ! Comment puis-je vous aider aujourd’hui ?",
    placeholder: "Posez vos questions sur Sirtaki...",
    send: "Envoyer",
    newChat: "Nouveau chat",
    error: "Je suis désolé, un problème est survenu – veuillez réessayer ou nous écrire sur WhatsApp.",
    starters: [
      { label: "En quoi pouvez-vous m’aider ?", prompt: "Que pouvez-vous faire pour moi ?" },
      { label: "Comment réserver ?", prompt: "Je voudrais réserver une table" },
      { label: "Comment venir chez vous ?", prompt: "Où se trouve la taverne Sirtaki ?" },
      { label: "Parlez-moi d’un plat", prompt: "J’aimerais poser une question sur un plat de votre carte" },
      { label: "Pouvez-vous recommander un vin ?", prompt: "J’aimerais une recommandation de vin pour mon repas" },
    ],
  },
};

/** Language from the ?lang=xx query of the chat page; anything else falls back to English. */
export function langFromSearch(search: string): Lang {
  const v = new URLSearchParams(search).get("lang");
  return v === "el" || v === "de" || v === "fr" ? v : "en";
}
