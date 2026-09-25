# transitions-dev gallery

A single-page gallery of 10 copy-paste UI micro-transitions inspired by [transitions.dev](https://transitions.dev). Every demo runs live and its CSS can be copied with one click. Zero dependencies — static HTML/CSS/JS served by `Bun.serve`.

## Run

```bash
bun install && bun run dev
```

Then open http://localhost:3000.

## The transitions

Toast open/close · Tabs sliding pill · Skeleton loader and reveal · Number flip · Error state shake · Success check · Spinner to check morph · Like button · Notification badge · Shimmer text

Each section in `public/transitions.css` is self-contained and marker-delimited; the Copy CSS buttons slice the file by those markers, so the copied snippet is exactly what runs in the preview.
