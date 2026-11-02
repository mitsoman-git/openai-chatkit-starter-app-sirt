import type { Metadata } from "next";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sirtaki chat log · Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 text-stone-900">
      <form action={loginAction} className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Sirtaki · Chat conversations</h1>
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="mb-1 block text-sm text-stone-600" htmlFor="username">Username</label>
        <input id="username" name="username" type="text" defaultValue="admin" autoComplete="username"
          className="mb-3 w-full rounded-md border border-stone-300 px-3 py-2 text-base" />
        <label className="mb-1 block text-sm text-stone-600" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoFocus autoComplete="current-password"
          className="mb-3 w-full rounded-md border border-stone-300 px-3 py-2 text-base" />
        {error ? <p className="mb-3 text-sm text-red-600">Wrong password.</p> : null}
        <button type="submit" className="w-full rounded-md bg-stone-900 px-3 py-2 text-base font-medium text-white">Sign in</button>
      </form>
    </div>
  );
}
