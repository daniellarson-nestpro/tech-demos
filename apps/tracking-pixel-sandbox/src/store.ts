/**
 * In-memory state: one sandbox session at a time, plus the beacon log and the
 * SSE fan-out that keeps the UI live. Nothing is persisted — closing the
 * process is the same as shredding the evidence, which is the point.
 */

import type { PixelShape, Verdict } from "./classify.ts";

export type BeaconState = "armed" | "blocked" | "click-armed";

export interface Beacon {
  id: string;
  seq: number;
  sessionId: string;
  url: string;
  host: string;
  origin: string;
  attr: string;
  shape: PixelShape;
  verdict: Verdict;
  state: BeaconState;
  /** When the payload was found to contain it. */
  foundAt: number;
  /** When the rendering browser actually tried to fetch it. */
  firedAt?: number;
  /**
   * The headers the sandboxed browser attached to the blocked request. This is
   * the other half of what a tracking pixel harvests: the identifier says who
   * you are, these say what you read it on.
   */
  requestHeaders?: Record<string, string>;
  hits: number;
}

export interface Session {
  id: string;
  label: string;
  createdAt: number;
  sealedHtml: string;
  sourceBytes: number;
  strips: { what: string; detail: string }[];
  beacons: Map<string, Beacon>;
}

export type Event =
  | { type: "session"; session: SessionSummary }
  | { type: "beacon"; beacon: Beacon }
  | { type: "beacon-update"; beacon: Beacon };

export interface SessionSummary {
  id: string;
  label: string;
  createdAt: number;
  sourceBytes: number;
  strips: { what: string; detail: string }[];
  beacons: Beacon[];
  stats: Stats;
}

export interface Stats {
  total: number;
  fired: number;
  pixels: number;
  hosts: number;
  vendors: number;
  leaks: number;
  worst: "critical" | "high" | "medium" | "low" | "none";
}

const MAX_SESSIONS = 12;

const sessions = new Map<string, Session>();
const subscribers = new Set<(e: Event) => void>();
/** Flat index so `/trap/:id` is a single lookup. */
const beaconIndex = new Map<string, Beacon>();

let seq = 0;

export function subscribe(fn: (e: Event) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function emit(e: Event): void {
  for (const fn of subscribers) {
    try {
      fn(e);
    } catch {
      /* a dead SSE client must not break the collector */
    }
  }
}

export function createSession(label: string, sourceBytes: number): Session {
  const session: Session = {
    id: crypto.randomUUID().slice(0, 8),
    label,
    createdAt: Date.now(),
    sealedHtml: "",
    sourceBytes,
    strips: [],
    beacons: new Map(),
  };
  sessions.set(session.id, session);

  // Evict oldest sessions, dropping their trap ids with them.
  while (sessions.size > MAX_SESSIONS) {
    const oldest = sessions.keys().next().value as string | undefined;
    if (!oldest) break;
    const dead = sessions.get(oldest);
    if (dead) for (const id of dead.beacons.keys()) beaconIndex.delete(id);
    sessions.delete(oldest);
  }
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function addBeacon(
  session: Session,
  input: { url: string; origin: string; attr: string; shape: PixelShape; verdict: Verdict; state: BeaconState },
): Beacon {
  let host: string;
  try {
    host = new URL(input.url).hostname;
  } catch {
    host = "(unparseable)";
  }
  const beacon: Beacon = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    seq: ++seq,
    sessionId: session.id,
    url: input.url,
    host,
    origin: input.origin,
    attr: input.attr,
    shape: input.shape,
    verdict: input.verdict,
    state: input.state,
    foundAt: Date.now(),
    hits: 0,
  };
  session.beacons.set(beacon.id, beacon);
  beaconIndex.set(beacon.id, beacon);
  return beacon;
}

/** Called from `/trap/:id` when the sandboxed browser actually fires. */
export function recordHit(id: string, headers: Headers): Beacon | undefined {
  const beacon = beaconIndex.get(id);
  if (!beacon) return undefined;
  beacon.hits += 1;
  beacon.state = "blocked";
  beacon.firedAt ??= Date.now();
  const interesting = ["user-agent", "accept", "accept-language", "accept-encoding", "referer", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "dnt", "sec-ch-ua", "sec-ch-ua-platform", "sec-ch-ua-mobile"];
  const captured: Record<string, string> = {};
  for (const name of interesting) {
    const value = headers.get(name);
    if (value) captured[name] = value;
  }
  beacon.requestHeaders = captured;
  emit({ type: "beacon-update", beacon });
  return beacon;
}

export function statsFor(session: Session): Stats {
  const beacons = [...session.beacons.values()];
  const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  let worst: Stats["worst"] = "none";
  for (const b of beacons) {
    if (worst === "none" || rank[b.verdict.severity] > rank[worst as keyof typeof rank]) worst = b.verdict.severity;
  }
  return {
    total: beacons.length,
    fired: beacons.filter((b) => b.state === "blocked").length,
    pixels: beacons.filter((b) => b.shape.isPixel).length,
    hosts: new Set(beacons.map((b) => b.host)).size,
    vendors: new Set(beacons.map((b) => b.verdict.vendor?.name).filter(Boolean)).size,
    leaks: beacons.reduce((n, b) => n + b.verdict.leaks.length, 0),
    worst,
  };
}

export function summarize(session: Session): SessionSummary {
  return {
    id: session.id,
    label: session.label,
    createdAt: session.createdAt,
    sourceBytes: session.sourceBytes,
    strips: session.strips,
    beacons: [...session.beacons.values()].sort((a, b) => a.seq - b.seq),
    stats: statsFor(session),
  };
}

export function announce(session: Session): void {
  emit({ type: "session", session: summarize(session) });
}
