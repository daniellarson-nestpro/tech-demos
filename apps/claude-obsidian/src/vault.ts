export interface Note {
  path: string; // e.g. "concepts/Knowledge Graph.md"
  title: string;
  folder: string; // "concepts" | "sources" | ""
  content: string;
  seed: boolean;
  createdAt: number;
}

export interface VaultLink {
  from: string; // note title
  to: string; // note title
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;

function extractLinks(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(WIKILINK_RE)) out.push(m[1].trim());
  return out;
}

export class Vault {
  notes = new Map<string, Note>(); // keyed by lowercase title

  constructor() {
    this.reset();
  }

  reset() {
    this.notes.clear();
    for (const n of seedNotes()) this.addNote(n.title, n.folder, n.content, true);
  }

  addNote(title: string, folder: string, content: string, seed = false): Note {
    const note: Note = {
      path: folder ? `${folder}/${title}.md` : `${title}.md`,
      title,
      folder,
      content,
      seed,
      createdAt: Date.now(),
    };
    this.notes.set(title.toLowerCase(), note);
    return note;
  }

  appendToNote(title: string, extra: string) {
    const note = this.notes.get(title.toLowerCase());
    if (note) note.content = note.content.trimEnd() + "\n" + extra;
  }

  get(title: string): Note | undefined {
    return this.notes.get(title.toLowerCase());
  }

  titles(): string[] {
    return [...this.notes.values()].map((n) => n.title);
  }

  /** Links derived from wikilinks that resolve to existing notes. */
  links(): VaultLink[] {
    const out: VaultLink[] = [];
    const seen = new Set<string>();
    for (const note of this.notes.values()) {
      for (const target of extractLinks(note.content)) {
        const t = this.get(target);
        if (!t || t.title === note.title) continue;
        const key = [note.title, t.title].sort().join("\u0000");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from: note.title, to: t.title });
      }
    }
    return out;
  }

  toJSON() {
    const files = [...this.notes.values()].sort((a, b) => a.path.localeCompare(b.path));
    return { files, links: this.links() };
  }
}

function seedNotes(): { title: string; folder: string; content: string }[] {
  return [
    {
      title: "Home",
      folder: "",
      content: `# Home

This vault is maintained by an agent following the **LLM Wiki** pattern: drop a source in the inbox and the agent extracts claims, proposes notes, and links everything together.

## Entry points
- [[Second Brain]]
- [[Knowledge Graph]]
- [[Large Language Models]]
- [[Atomic Notes]]
`,
    },
    {
      title: "Second Brain",
      folder: "concepts",
      content: `# Second Brain

A **second brain** is an external, trusted system for storing and connecting what you learn, so your biological memory can focus on thinking rather than retention.

- Implemented here as an [[Obsidian]]-style vault of Markdown files
- Structure emerges from links — see [[Knowledge Graph]]
- Best populated with [[Atomic Notes]] rather than long documents
`,
    },
    {
      title: "Knowledge Graph",
      folder: "concepts",
      content: `# Knowledge Graph

A **knowledge graph** represents knowledge as nodes (concepts, sources, claims) and edges (typed relationships).

- In a Markdown vault, edges are \`[[wikilinks]]\`
- Both humans and [[Large Language Models]] can traverse it
- The graph view surfaces clusters and orphaned notes
`,
    },
    {
      title: "Large Language Models",
      folder: "concepts",
      content: `# Large Language Models

**Large language models (LLMs)** are neural networks trained on next-token prediction over large text corpora.

- Capable of reading and writing the same Markdown a human edits
- Act as the librarian in the LLM Wiki pattern — reading sources, extracting claims, filing notes
- See [[Knowledge Graph]] for how their output is organized
`,
    },
    {
      title: "Atomic Notes",
      folder: "concepts",
      content: `# Atomic Notes

An **atomic note** holds exactly one idea, stated in your own words, with links to related ideas.

- The unit of account in a [[Second Brain]]
- Small notes make links precise, which makes the [[Knowledge Graph]] useful
- Contrast with long documents, where ideas are buried and unlinkable
`,
    },
    {
      title: "Obsidian",
      folder: "concepts",
      content: `# Obsidian

**Obsidian** is a note-taking app where the vault is a plain folder of Markdown files on disk.

- No database: agents and scripts can operate on the files directly
- Supports \`[[wikilinks]]\`, backlinks, and a graph view
- The substrate for this demo's [[Second Brain]]
`,
    },
  ];
}
