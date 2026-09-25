import type { Vault } from "./vault";

export interface ProposedNote {
  title: string;
  folder: string;
  reason: string;
}

export interface SuggestedLink {
  from: string;
  to: string;
  reason: string;
}

export interface FiledNote {
  path: string;
  title: string;
  isNew: boolean;
}

export interface PipelineResult {
  mode: "offline" | "live";
  sourceTitle: string;
  claims: string[];
  proposedNotes: ProposedNote[];
  links: SuggestedLink[];
  filedNotes: FiledNote[];
}

const STOPWORDS = new Set(
  `a an and are as at be been but by can could did do does for from had has have he her here his how i if in into is it its just like me more most my no not of on one only or other our out over she so some such than that the their them then there these they this those to too two very was we were what when where which while who will with without would you your`.split(
    " ",
  ),
);

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z\u201C"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w, i) => (STOPWORDS.has(w.toLowerCase()) && i > 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Pick the most claim-like sentences: declarative, specific, information-dense. */
function extractClaims(sents: string[]): string[] {
  const scored = sents.map((s, i) => {
    let score = 0;
    if (/\b(is|are|was|were|means|shows|showed|suggests|argues|found|remains|becomes?|gives?|makes?)\b/i.test(s)) score += 2;
    if (/\d/.test(s)) score += 2;
    if (/[A-Z][a-z]+ [A-Z][a-z]+/.test(s.slice(1))) score += 1; // named entities
    if (/\b(because|whereas|instead of|rather than|which means|so that)\b/i.test(s)) score += 1;
    const n = words(s).length;
    if (n >= 12 && n <= 40) score += 1;
    if (s.endsWith("?")) score -= 2;
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

/** Candidate concepts: capitalized phrases mid-sentence + repeated meaningful terms. */
function extractConcepts(text: string, sents: string[]): Map<string, number> {
  const scores = new Map<string, number>();
  const bump = (phrase: string, by: number) => {
    const key = titleCase(phrase.trim().replace(/[-–—'\s]+$/, ""));
    if (key.length < 3 || key.length > 40) return;
    if (words(key).every((w) => STOPWORDS.has(w))) return;
    scores.set(key, (scores.get(key) ?? 0) + by);
  };

  // Capitalized runs that are not at sentence start (likely proper nouns / named concepts)
  for (const s of sents) {
    const re = /(?<!^)(?<=\s)((?:[A-Z][A-Za-z'-]+)(?:\s+[A-Z][A-Za-z'-]+)*)/g;
    for (const m of s.matchAll(re)) bump(m[1], 3);
  }

  // Repeated bigrams and unigrams
  const toks = words(text).filter((w) => !STOPWORDS.has(w));
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  const raw = words(text);
  for (const t of toks) uni.set(t, (uni.get(t) ?? 0) + 1);
  for (let i = 0; i < raw.length - 1; i++) {
    if (STOPWORDS.has(raw[i]) || STOPWORDS.has(raw[i + 1])) continue;
    const b = `${raw[i]} ${raw[i + 1]}`;
    bi.set(b, (bi.get(b) ?? 0) + 1);
  }
  for (const [b, n] of bi) if (n >= 2) bump(b, n * 2);
  for (const [u, n] of uni) if (n >= 3 && u.length >= 5) bump(u, n);

  // Drop unigrams fully contained in a scored bigram/phrase
  for (const key of [...scores.keys()]) {
    if (!key.includes(" ")) {
      for (const other of scores.keys()) {
        if (other !== key && other.toLowerCase().includes(key.toLowerCase())) {
          scores.delete(key);
          break;
        }
      }
    }
  }
  return scores;
}

/** Replace mentions of note titles with [[wikilinks]] (longest titles first, once per title). */
function wikilinkify(text: string, titles: string[]): string {
  let out = text;
  const sorted = [...titles].sort((a, b) => b.length - a.length);
  for (const title of sorted) {
    if (out.includes(`[[${title}]]`)) continue;
    const re = new RegExp(`(?<!\\[)\\b(${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})s?\\b`, "i");
    out = out.replace(re, (m) => (m.toLowerCase().startsWith(title.toLowerCase()) ? `[[${title}]]${m.endsWith("s") && m.length > title.length ? "s" : ""}` : m));
  }
  return out;
}

export function runOfflinePipeline(text: string, sourceTitle: string, vault: Vault): PipelineResult {
  const sents = sentences(text);
  const claims = extractClaims(sents);
  const concepts = extractConcepts(text, sents);

  const existingTitles = vault.titles();
  const lcText = text.toLowerCase();

  // Existing notes mentioned in the source
  const mentioned = existingTitles.filter((t) => {
    if (t === "Home") return false;
    const lct = t.toLowerCase();
    if (lcText.includes(lct)) return true;
    const ws = words(t).filter((w) => !STOPWORDS.has(w));
    return ws.length > 1 && ws.every((w) => lcText.includes(w));
  });

  // New concept notes: top-scoring concepts that don't already exist
  const existsLc = new Set(existingTitles.map((t) => t.toLowerCase()));
  const GENERIC = new Set(
    "note notes idea ideas thing things people person word words link links page pages file files time times way ways part parts value work review reviews research system systems tool tools model models source sources".split(" "),
  );
  const candidates = [...concepts.entries()]
    .filter(([title]) => !existsLc.has(title.toLowerCase()))
    .filter(([title]) => !(GENERIC.has(title.toLowerCase()) || words(title).every((w) => GENERIC.has(w) || STOPWORDS.has(w))))
    .filter(([title]) => !existingTitles.some((t) => t.toLowerCase().split(/\s+/).includes(title.toLowerCase())))
    .filter(([title]) => !title.toLowerCase().includes(sourceTitle.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([title]) => title);

  const proposedNotes: ProposedNote[] = [
    { title: sourceTitle, folder: "sources", reason: "source note for the ingested text" },
    ...candidates.map((title) => ({
      title,
      folder: "concepts",
      reason: `recurring concept (${concepts.get(title)} signal${(concepts.get(title) ?? 0) > 1 ? "s" : ""}) with no existing note`,
    })),
  ];

  const allLinkTargets = [...mentioned, ...candidates];
  const links: SuggestedLink[] = [
    ...mentioned.map((t) => ({ from: sourceTitle, to: t, reason: "mentioned in source" })),
    ...candidates.map((t) => ({ from: sourceTitle, to: t, reason: "new concept extracted from source" })),
  ];

  // File the notes into the vault
  const filedNotes: FiledNote[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const summary = sents.slice(0, 2).join(" ");
  const claimLines = claims.map((c) => `- ${wikilinkify(c, allLinkTargets)}`).join("\n");
  const relatedLines = allLinkTargets.map((t) => `- [[${t}]]`).join("\n");
  const sourceMd = `# ${sourceTitle}

> [!info] Filed by agent on ${today} · offline heuristic mode

## Summary
${wikilinkify(summary, allLinkTargets)}

## Claims
${claimLines}

## Related
${relatedLines}
`;
  const wasNew = !vault.get(sourceTitle);
  const srcNote = vault.addNote(sourceTitle, "sources", sourceMd);
  filedNotes.push({ path: srcNote.path, title: srcNote.title, isNew: wasNew });

  for (const title of candidates) {
    const defSent = sents.find((s) => s.toLowerCase().includes(title.toLowerCase())) ?? claims[0] ?? summary;
    const others = allLinkTargets.filter((t) => t !== title).slice(0, 3);
    const md = `# ${title}

**${title}** — extracted from [[${sourceTitle}]].

${wikilinkify(defSent, others)}

## Related
- [[${sourceTitle}]]
${others.map((t) => `- [[${t}]]`).join("\n")}
`;
    const note = vault.addNote(title, "concepts", md);
    filedNotes.push({ path: note.path, title: note.title, isNew: true });
  }

  return { mode: "offline", sourceTitle, claims, proposedNotes, links, filedNotes };
}
