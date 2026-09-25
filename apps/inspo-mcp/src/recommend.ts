import { SCREENS, type Screen } from "./data";

export interface Match {
  screen: Screen;
  score: number;
  matched: string[];
}

// Maps brief vocabulary to dataset vocabulary so briefs like
// "calm fintech dashboard" hit tags/keywords they don't literally contain.
const SYNONYMS: Record<string, string[]> = {
  fintech: ["finance", "banking", "money", "fintech"],
  finance: ["fintech", "banking", "money"],
  banking: ["fintech", "finance"],
  crypto: ["web3", "defi", "wallet"],
  dashboard: ["dashboard", "analytics", "charts", "console", "data"],
  analytics: ["dashboard", "charts", "data"],
  calm: ["calm", "soft", "gentle", "airy", "minimal"],
  cozy: ["calm", "warm", "soft"],
  peaceful: ["calm", "gentle", "soft"],
  brutalist: ["brutalist", "loud", "borders", "flat", "high-contrast"],
  brutal: ["brutalist", "loud", "high-contrast"],
  dev: ["developer", "technical", "api"],
  developer: ["developer", "technical", "api"],
  devtool: ["developer", "technical"],
  landing: ["marquee-hero", "startup", "product"],
  hero: ["marquee-hero"],
  dark: ["dark"],
  light: ["light", "airy"],
  playful: ["playful", "fun", "joyful", "colorful", "friendly"],
  fun: ["playful", "joyful", "colorful"],
  whimsical: ["playful", "quirky", "whimsical"],
  elegant: ["elegant", "premium", "serif", "editorial"],
  premium: ["elegant", "premium", "trust"],
  luxury: ["elegant", "premium", "serif"],
  editorial: ["editorial", "serif", "typography", "magazine"],
  magazine: ["editorial", "media", "publishing"],
  blog: ["blog", "publishing", "writers", "editorial"],
  newsletter: ["newsletter", "email", "publishing"],
  ai: ["ai", "futuristic", "data"],
  startup: ["startup", "saas", "product"],
  saas: ["saas", "b2b", "product"],
  b2b: ["b2b", "saas", "enterprise"],
  enterprise: ["enterprise", "b2b", "serious", "trust"],
  security: ["security", "trust", "serious"],
  consumer: ["consumer", "friendly", "mobile", "app"],
  mobile: ["mobile", "app", "consumer"],
  app: ["app", "product", "consumer"],
  minimal: ["minimal", "monochrome", "clean", "sleek"],
  clean: ["minimal", "clean", "airy"],
  bold: ["bold", "high contrast", "loud"],
  colorful: ["colorful", "playful", "gradient"],
  gradient: ["gradient", "glow"],
  neon: ["neon", "glow", "gradient"],
  serif: ["serif", "editorial", "elegant"],
  retro: ["print-inspired", "classic", "editorial"],
  ecommerce: ["commerce", "shop", "sell"],
  shop: ["commerce", "sell", "creator"],
  store: ["commerce", "shop", "sell"],
  productivity: ["productivity", "calendar", "todo"],
  calendar: ["calendar", "planning", "productivity"],
  wellness: ["wellness", "calm", "soft", "organic"],
  health: ["wellness", "calm", "trust"],
};

const STOPWORDS = new Set([
  "a", "an", "the", "for", "with", "and", "or", "of", "in", "on", "to",
  "site", "website", "page", "web", "design", "style", "look", "vibe",
  "vibes", "like", "something", "kind", "feel", "feels", "i", "want",
]);

function tokenize(brief: string): string[] {
  return brief
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function expand(tokens: string[]): Map<string, string> {
  // expanded term -> original brief token that produced it
  const terms = new Map<string, string>();
  for (const t of tokens) {
    if (!terms.has(t)) terms.set(t, t);
    for (const syn of SYNONYMS[t] ?? []) {
      if (!terms.has(syn)) terms.set(syn, t);
    }
  }
  return terms;
}

function haystack(s: Screen): string[] {
  return [
    ...s.tags,
    ...s.keywords,
    s.category,
    s.layout,
    s.name.toLowerCase(),
    s.fonts.display.toLowerCase(),
  ];
}

export function recommend(brief: string, limit = 6): Match[] {
  const tokens = tokenize(brief);
  if (tokens.length === 0) return editorsPicks(limit);

  const terms = expand(tokens);
  const matches: Match[] = [];

  for (const screen of SCREENS) {
    const hay = haystack(screen);
    let score = 0;
    const matched = new Set<string>();
    for (const [term, origin] of terms) {
      const direct = term === origin;
      for (const h of hay) {
        if (h === term || h.includes(term)) {
          // direct token hits count more than synonym hits;
          // tag hits count more than keyword hits
          const tagHit = screen.tags.includes(h) || screen.category === h;
          score += (direct ? 3 : 2) + (tagHit ? 1 : 0);
          matched.add(origin);
          break;
        }
      }
    }
    if (score > 0) matches.push({ screen, score, matched: [...matched] });
  }

  matches.sort((a, b) => b.score - a.score || a.screen.name.localeCompare(b.screen.name));
  return matches.length > 0 ? matches.slice(0, limit) : editorsPicks(limit);
}

function editorsPicks(limit: number): Match[] {
  return SCREENS.slice(0, limit).map((screen) => ({ screen, score: 0, matched: [] }));
}
