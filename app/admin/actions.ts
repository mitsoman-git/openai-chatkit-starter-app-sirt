"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDb } from "../../lib/db";

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

export async function deleteSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  if (SESSION_ID.test(sessionId)) await createDb().deleteSession(sessionId);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteTodayAction() {
  await createDb().deleteToday();
  revalidatePath("/admin");
  redirect("/admin");
}
