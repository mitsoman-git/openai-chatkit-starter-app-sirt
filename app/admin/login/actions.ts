"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordMatches, createSessionToken, safeNext, SESSION_COOKIE, SESSION_MAX_AGE } from "../../../lib/adminSession";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || !passwordMatches(password, secret)) {
    await new Promise((r) => setTimeout(r, 800));
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}

export async function logoutAction() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
  redirect("/admin/login");
}
