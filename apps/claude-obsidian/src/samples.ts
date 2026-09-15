export interface Sample {
  id: string;
  label: string;
  title: string;
  text: string;
}

export const samples: Sample[] = [
  {
    id: "llm-wiki",
    label: "Karpathy's LLM Wiki idea",
    title: "The LLM Wiki pattern",
    text: `Andrej Karpathy described a pattern where a personal wiki is maintained not by hand but by a large language model acting as a librarian. Instead of manually filing notes, you drop raw sources into an inbox and the agent reads each one, extracts the atomic claims, and files them into interlinked Markdown pages.

The key insight is that Markdown files with wikilinks form a knowledge graph that both humans and LLMs can read and write. Each concept gets exactly one page, and every claim links back to the source it came from. Over time the vault becomes a self-organizing second brain: the agent notices when two pages discuss the same concept and merges or cross-links them.

Tools like Obsidian make this practical because the vault is just a folder of plain text files. Claude Code can operate directly on that folder, which means the agent needs no plugin or API — it reads and writes the same files the human edits. Proponents argue this beats classical note-taking systems because the maintenance cost of linking and refactoring drops to nearly zero.`,
  },
  {
    id: "zettelkasten",
    label: "Zettelkasten excerpt",
    title: "How the Zettelkasten works",
    text: `The Zettelkasten method was developed by sociologist Niklas Luhmann, who credited it for his extraordinary output of more than 70 books and 400 scholarly articles. A Zettelkasten is a collection of atomic notes, each holding exactly one idea, connected to other notes through explicit links.

Luhmann insisted that the value of the system comes from the links, not the notes themselves. When a new note enters the box, the crucial work is deciding which existing notes it should connect to. This forced confrontation with prior knowledge is what turns a pile of notes into a thinking partner.

Modern digital tools replicate this with backlinks and graph views. Research on note-taking suggests that elaborative encoding — rephrasing an idea in your own words and relating it to what you already know — is the mechanism that makes linked notes more useful than folders of documents.`,
  },
  {
    id: "attention",
    label: "Transformer attention excerpt",
    title: "Attention is all you need",
    text: `The transformer architecture, introduced in 2017, replaced recurrence entirely with self-attention. Each token computes attention scores against every other token in the sequence, producing a weighted mixture of value vectors. This gives the model a global receptive field in a single layer, whereas convolutional or recurrent networks need many layers to relate distant positions.

Multi-head attention runs several attention functions in parallel, letting different heads specialize: some track syntax, others track long-range coreference. The quadratic cost of attention in sequence length remains the main scaling bottleneck, motivating sparse and linear attention variants.

Large language models are essentially deep stacks of these transformer blocks trained on next-token prediction. Their in-context learning ability — adapting to a task from examples in the prompt alone — emerges without any explicit training objective for it.`,
  },
  {
    id: "spaced-repetition",
    label: "Spaced repetition note",
    title: "Why spaced repetition works",
    text: `Spaced repetition exploits the spacing effect, one of the most replicated findings in cognitive psychology: memory is strengthened more by reviews spread over time than by massed repetition. Hermann Ebbinghaus first documented the forgetting curve in 1885, showing that retention decays roughly exponentially without review.

Each successful recall at the edge of forgetting flattens the curve, so optimal schedules expand the interval after every success. Algorithms like SM-2 and FSRS estimate per-card memory stability and schedule the next review just before predicted forgetting.

There is a deep connection to note-taking systems: a knowledge graph tells you what you know, while spaced repetition determines whether you can still recall it. Some practitioners generate flashcards directly from their atomic notes, closing the loop between capturing an idea and retaining it.`,
  },
];
