import { describe, expect, it, vi } from "vitest";
import { buildDigest, type DayMessage } from "../lib/digest";
import { createDigestHandler, digestDay } from "../lib/digestHandler";

const msg = (o: Partial<DayMessage>): DayMessage => ({
  sessionId: "s1",
  role: "user",
  text: "hi",
  category: null,
  createdAt: "2026-10-31T10:05:00Z", // 12:05 Athens (UTC+2)
  starred: false,
  ...o,
});

describe("buildDigest", () => {
  const fallback = "I'm sorry, I don't have that information right now. Please check our website.";

  it("has the day and counts in the subject", () => {
    const d = buildDigest("2026-10-31", [
      msg({}),
      msg({ role: "assistant", text: "hello", category: "greeting" }),
      msg({ sessionId: "s2", starred: true }),
    ]);
    expect(d.subject).toBe("Sirtaki chat · 2026-10-31 · 2 conversations (1 starred)");
  });

  it("opens with a summary: totals by category", () => {
    const d = buildDigest("2026-10-31", [
      msg({ sessionId: "a" }),
      msg({ sessionId: "a", role: "assistant", category: "reserve" }),
      msg({ sessionId: "b" }),
      msg({ sessionId: "b", role: "assistant", category: "reserve" }),
      msg({ sessionId: "c" }),
      msg({ sessionId: "c", role: "assistant", category: "meze" }),
    ]);
    expect(d.text.split("\n").slice(0, 6).join("\n")).toContain("3 conversations");
    expect(d.text).toMatch(/Reservation: 2/);
    expect(d.text).toMatch(/Meze: 1/);
    expect(d.html).toContain("Reservation");
  });

  it("lists starred, error and 'I don't have' conversations under needs-attention, and not the others", () => {
    const d = buildDigest("2026-10-31", [
      msg({ sessionId: "ok", text: "fine question" }),
      msg({ sessionId: "ok", role: "assistant", category: "meze", text: "fine answer" }),
      msg({ sessionId: "unans", text: "stella island" }),
      msg({ sessionId: "unans", role: "assistant", category: "get_information", text: fallback }),
      msg({ sessionId: "star", text: "interesting", starred: true }),
      msg({ sessionId: "star", role: "assistant", category: "get_information", text: "ok" }),
      msg({ sessionId: "err", text: "boom" }),
      msg({ sessionId: "err", role: "assistant", category: "error", text: "sorry" }),
    ]);
    const att = d.text.split("NEEDS YOUR ATTENTION")[1].split("ALL CONVERSATIONS")[0];
    expect(att).toContain("stella island");
    expect(att).toContain("interesting");
    expect(att).toContain("boom");
    expect(att).not.toContain("fine question");
    expect(att).toContain(fallback.slice(0, 30));
  });

  it("lists every conversation briefly with its first guest message, time and a link to it", () => {
    const d = buildDigest("2026-10-31", [msg({ sessionId: "abc-12345678", text: "Table for 2?" })]);
    expect(d.text).toContain("12:05");
    expect(d.text).toContain("Table for 2?");
    expect(d.text).toContain("/admin?session=abc-12345678");
    expect(d.html).toContain("/admin?session=abc-12345678");
  });

  it("escapes guest text in the html", () => {
    const d = buildDigest("2026-10-31", [msg({ text: '<script>alert(1)</script> & "x"' })]);
    expect(d.html).not.toContain("<script>");
    expect(d.html).toContain("&lt;script&gt;");
  });

  it("cuts very long messages", () => {
    const d = buildDigest("2026-10-31", [msg({ text: "x".repeat(5000) })]);
    expect(d.text.length).toBeLessThan(2500);
    expect(d.html.length).toBeLessThan(6000);
  });
});

describe("digestDay", () => {
  it("is the Athens day three hours before the run, so a late cron run still gets that evening", () => {
    expect(digestDay(new Date("2026-10-31T21:10:00Z"))).toBe("2026-10-31"); // 23:10 Athens
    expect(digestDay(new Date("2026-06-30T21:40:00Z"))).toBe("2026-06-30"); // 00:40 Athens next day (summer)
  });
});

describe("digest handler", () => {
  const env = { CRON_SECRET: "s3cret-value", DIGEST_URL: "https://site.example/api/chat-digest.php" };
  const rows = [msg({ text: "hello" })];
  function setup(over: { secret?: string | undefined; sendOk?: boolean } = {}) {
    const db = { messagesOfDay: vi.fn(async () => rows) };
    const fetchMock = vi.fn(async () => new Response("ok", { status: over.sendOk === false ? 500 : 200 }));
    const handler = createDigestHandler({
      db,
      fetch: fetchMock as unknown as typeof fetch,
      env: { ...env, ...(over.secret === undefined && "secret" in over ? { CRON_SECRET: undefined } : {}) } as Record<string, string | undefined>,
      now: () => new Date("2026-10-31T21:05:00Z"),
    });
    return { db, fetchMock, handler };
  }
  const req = (headers: Record<string, string> = {}, qs = "") =>
    new Request(`http://x/api/cron/digest${qs}`, { headers });

  it("rejects a missing or wrong secret", async () => {
    const { handler, db, fetchMock } = setup();
    expect((await handler(req())).status).toBe(401);
    expect((await handler(req({ authorization: "Bearer nope" }))).status).toBe(401);
    expect(db.messagesOfDay).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to run when no secret is configured", async () => {
    const { handler } = setup({ secret: undefined });
    expect((await handler(req({ authorization: "Bearer undefined" }))).status).toBe(401);
  });

  it("sends the digest of the computed day to the site mail endpoint with the token", async () => {
    const { handler, db, fetchMock } = setup();
    const res = await handler(req({ authorization: "Bearer s3cret-value" }));
    expect(res.status).toBe(200);
    expect(db.messagesOfDay).toHaveBeenCalledWith("2026-10-31");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(env.DIGEST_URL);
    expect((init.headers as Record<string, string>)["X-Digest-Token"]).toBe("s3cret-value");
    const body = JSON.parse(String(init.body));
    expect(body.subject).toContain("2026-10-31");
    expect(body.text).toContain("hello");
    expect(body.html).toContain("hello");
  });

  it("accepts ?day= for a manual run and rejects a malformed day", async () => {
    const { handler, db } = setup();
    await handler(req({ authorization: "Bearer s3cret-value" }, "?day=2026-10-30"));
    expect(db.messagesOfDay).toHaveBeenCalledWith("2026-10-30");
    expect((await handler(req({ authorization: "Bearer s3cret-value" }, "?day=garbage"))).status).toBe(400);
  });

  it("sends no email when there were no conversations that day", async () => {
    const db = { messagesOfDay: vi.fn(async () => []) };
    const fetchMock = vi.fn(async () => new Response("ok"));
    const handler = createDigestHandler({
      db,
      fetch: fetchMock as unknown as typeof fetch,
      env: { CRON_SECRET: "s3cret-value" },
      now: () => new Date("2026-10-31T21:05:00Z"),
    });
    const res = await handler(req({ authorization: "Bearer s3cret-value" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, day: "2026-10-31", sent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults to the mail endpoint in the site's wifi folder", async () => {
    const db = { messagesOfDay: vi.fn(async () => rows) };
    const fetchMock = vi.fn(async () => new Response("ok"));
    const handler = createDigestHandler({
      db,
      fetch: fetchMock as unknown as typeof fetch,
      env: { CRON_SECRET: "s3cret-value" },
      now: () => new Date("2026-10-31T21:05:00Z"),
    });
    await handler(req({ authorization: "Bearer s3cret-value" }));
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://www.sirtaki-tavern.gr/wifi/chat-digest.php");
  });

  it("reports failure when the mail endpoint refuses", async () => {
    const { handler } = setup({ sendOk: false });
    expect((await handler(req({ authorization: "Bearer s3cret-value" }))).status).toBe(502);
  });
});
