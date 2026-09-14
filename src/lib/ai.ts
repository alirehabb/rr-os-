// Provider-agnostic Intelligence layer. Every call site imports `askAI`
// from here, never a provider SDK directly, so swapping Groq for Gemini or
// anything else later means changing this one file, not every call site.
// Currently backed by Groq (OpenAI-compatible chat completions) — cheap/
// fast open-weight models, no vendor lock-in to a single expensive stack.

const GROQ_MODEL = "openai/gpt-oss-120b";

export class AIUnavailableError extends Error {}

// Never throws on a missing key or a failed request in a way that could
// take down a page — every call site is expected to degrade gracefully
// (skip the AI section, keep the real data) rather than show an error.
export async function askAI(prompt: string, opts: { system?: string; maxTokens?: number } = {}): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          ...(opts.system ? [{ role: "system", content: opts.system }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: opts.maxTokens ?? 500,
        reasoning_effort: "low",
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    // Models ignore "no em dashes" often enough that it needs enforcing,
    // not just requesting — this is a hard product writing-style rule.
    return content.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, "-");
  } catch {
    return null;
  }
}
