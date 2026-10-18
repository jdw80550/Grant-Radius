// Server-only helper: streams a Responses call through Lovable AI Gateway and
// returns the parsed JSON output that matches the given strict schema.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export async function structuredAI<T>(opts: {
  system: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: opts.system,
      input: opts.prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: {
        format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error(`AI gateway error [${res.status}]: ${body}`);
    if (res.status === 429) throw new Error("Too many searches right now — please wait a moment and try again.");
    if (res.status === 402) throw new Error("AI credits are used up. Add credits to keep searching.");
    throw new Error(`AI request failed [${res.status}].`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let refusal = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
          else if (evt.type === "response.refusal.delta") refusal += evt.delta ?? "";
          else if (evt.type === "error" || evt.type === "response.failed") {
            console.error("AI stream error", data);
            throw new Error("The AI search failed. Please try again.");
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("The AI")) throw e;
        }
      }
    }
  }
  if (refusal && !text) throw new Error("The AI declined this request.");
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("Unparseable AI output", text.slice(0, 500));
    throw new Error("Couldn't read the AI results. Please try again.");
  }
}
