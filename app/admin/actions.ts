"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDay } from "../../lib/adminCalendar";
import { createDb } from "../../lib/db";

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

export async function deleteSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  if (SESSION_ID.test(sessionId)) await createDb().deleteSession(sessionId);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteDayAction(formData: FormData) {
  const day = String(formData.get("day") ?? "");
  if (isDay(day)) await createDb().deleteDay(day);
  revalidatePath("/admin");
  redirect(isDay(day) ? `/admin?month=${day.slice(0, 7)}` : "/admin");
}
