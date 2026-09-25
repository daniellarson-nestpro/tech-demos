import type { Vault } from "./vault";
import type { PipelineResult } from "./pipeline";

export const liveAvailable = () => !!process.env.ANTHROPIC_API_KEY;

interface LiveResponse {
  claims: string[];
  notes: { title: string; folder: string; markdown: string }[];
  links: { from: string; to: string; reason: string }[];
}

/**
 * Optional live mode: uses the Anthropic Messages API to run the same
 * extract-claims / propose-notes / link / file pipeline with a real model.
 * Only invoked when ANTHROPIC_API_KEY is set; throws on failure so the
 * caller can fall back to the offline pipeline.
 */
export async function runLivePipeline(text: string, sourceTitle: string, vault: Vault): Promise<PipelineResult> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const existing = vault.titles().join(", ");

  const prompt = `You are a librarian agent maintaining an Obsidian-style Markdown vault (the "LLM Wiki" pattern).
Existing note titles: ${existing}

A new source titled "${sourceTitle}" arrived:
---
${text}
---

Respond with ONLY a JSON object:
{
  "claims": [3-5 atomic factual claims from the source],
  "notes": [
    {"title": "${sourceTitle}", "folder": "sources", "markdown": "full markdown for the source note with a Summary, Claims (as bullets containing [[wikilinks]]), and Related section"},
    ... 1-3 new concept notes (folder "concepts") for concepts not already in the vault, each with [[wikilinks]] back to the source and to related existing notes
  ],
  "links": [{"from": "note title", "to": "note title", "reason": "short reason"}]
}
Only wikilink to titles that exist in the vault or that you are creating. Keep markdown concise.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const raw = data.content.find((c) => c.type === "text")?.text ?? "";
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonText) as LiveResponse;

  const filedNotes = parsed.notes.map((n) => {
    const isNew = !vault.get(n.title);
    const note = vault.addNote(n.title, n.folder === "sources" ? "sources" : "concepts", n.markdown);
    return { path: note.path, title: note.title, isNew };
  });

  return {
    mode: "live",
    sourceTitle,
    claims: parsed.claims,
    proposedNotes: parsed.notes.map((n) => ({ title: n.title, folder: n.folder, reason: "proposed by Claude" })),
    links: parsed.links,
    filedNotes,
  };
}
