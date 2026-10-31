"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function App() {
  useColorScheme();

  return (
    <main className="h-dvh overflow-hidden bg-slate-100 dark:bg-slate-950">
      <ChatPanel />
    </main>
  );
}
