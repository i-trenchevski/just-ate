// just-ate — AI food lookup (Supabase Edge Function).
//
// Turns one food-diary line item, in any language and with any phrasing
// ("pola banana", "три јајца", "a handfull of almnods"), into structured
// food items with grams and per-100g values. The browser never sees the
// Anthropic API key: it lives here as a function secret, callers must be
// signed-in Supabase users, and each user gets DAILY_LIMIT lookups per day
// (tracked in the ai_usage table — see schema.sql).
//
// Deploy:  supabase functions deploy parse-food --project-ref <ref>
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>

import Anthropic from "npm:@anthropic-ai/sdk@0.110.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const DAILY_LIMIT = 50;
const ALLOWED_ORIGINS = new Set([
  "https://just-ate.com",
  "https://www.just-ate.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          food_name_en: { type: "string" },
          grams: { type: "number" },
          piece_grams: { type: ["number", "null"] },
          per100: {
            type: "object",
            properties: {
              kcal: { type: "number" },
              p: { type: "number" },
              c: { type: "number" },
              f: { type: "number" },
            },
            required: ["kcal", "p", "c", "f"],
            additionalProperties: false,
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: { type: ["string", "null"] },
        },
        required: ["food_name_en", "grams", "piece_grams", "per100", "confidence", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const SYSTEM = `You are the food-recognition engine of a personal calorie-tracking app.
The user typed one food-diary line, in any language (often English or Macedonian),
possibly with typos or colloquial portions. Identify the food(s) and amounts.

Rules:
- food_name_en: a short, generic, lowercase English name ("banana", "whey protein",
  "ajvar"). Keep a brand or regional name only when nutrition depends on it.
- grams: your best estimate of the edible weight THIS text describes. Understand
  quantity words in any language ("pola banana" = half a banana ≈ 60 g,
  "три јајца" = three eggs ≈ 165 g, "a handful of almonds" ≈ 30 g).
- piece_grams: the typical weight of ONE piece if the food is countable
  (banana ≈ 118, egg ≈ 55), else null.
- per100: typical kcal / protein g / carbs g / fat g per 100 g. For foods usually
  weighed before cooking (rice, pasta, oats, legumes, raw meat) give RAW values
  unless the text says cooked — and say which you assumed in note.
- If the phrase contains several foods, return one item per food.
- If the text is not food at all, return an empty items array.
- Set confidence to "low" whenever the food identity or the amount is a real guess;
  use note (in English) for anything the user should know. Otherwise note is null.`;

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://just-ate.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, headers);

  // ---- who is asking? (anon key alone is not enough — a signed-in user is)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "Sign in to use AI lookups." }, 401, headers);

  // ---- input
  let text = "";
  try {
    const body = await req.json();
    text = String(body.text ?? "").trim();
  } catch (_e) {
    return json({ error: "Body must be JSON: {\"text\": \"...\"}" }, 400, headers);
  }
  if (!text) return json({ error: "Nothing to parse." }, 400, headers);
  if (text.length > 200) return json({ error: "Text too long." }, 400, headers);

  // ---- daily cap: ATOMIC increment-then-check (a select-then-upsert would
  // let parallel requests all read the same count and sail past the limit)
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const day = new Date().toISOString().slice(0, 10);
  const { data: used, error: usageErr } = await admin
    .rpc("bump_ai_usage", { uid: user.id, d: day, delta: 1 });
  if (usageErr) {
    return json({ error: "AI usage table missing — run the ai_usage section of schema.sql." }, 500, headers);
  }
  if (used > DAILY_LIMIT) {
    return json({ error: `Daily AI limit reached (${DAILY_LIMIT}/day). Resets at midnight UTC.` }, 429, headers);
  }
  const refund = () =>
    admin.rpc("bump_ai_usage", { uid: user.id, d: day, delta: -1 }).then(() => {}, () => {});

  // ---- ask Claude (structured output guarantees the JSON shape)
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) { await refund(); return json({ error: "ANTHROPIC_API_KEY secret is not set." }, 500, headers); }
  const anthropic = new Anthropic({ apiKey });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: text }],
    });
    if (msg.stop_reason === "refusal") {
      await refund();
      return json({ error: "The AI declined this request." }, 422, headers);
    }
    if (msg.stop_reason === "max_tokens") {
      await refund();
      return json({ error: "Too many foods in one line — split it up and try again." }, 422, headers);
    }
    const textBlock = msg.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) { await refund(); return json({ error: "Empty AI response — try again." }, 502, headers); }
    const parsed = JSON.parse((textBlock as { text: string }).text);
    return json({ items: parsed.items ?? [], remaining: Math.max(0, DAILY_LIMIT - used) }, 200, headers);
  } catch (e) {
    console.error("[parse-food]", e);
    await refund();
    return json({ error: "AI lookup failed — try again in a moment." }, 502, headers);
  }
});
