import { useMemo, useState } from "react";
import {
  ACCESS_LABELS,
  ENDPOINTS,
  MODALITY_LABELS,
  type Access,
  type Endpoint,
  type Modality,
} from "./data";
import { DetailPanel, EndpointCard, FilterGroup } from "./components";

export function App() {
  const [query, setQuery] = useState("");
  const [providers, setProviders] = useState<Set<string>>(new Set());
  const [modalities, setModalities] = useState<Set<Modality>>(new Set());
  const [accesses, setAccesses] = useState<Set<Access>>(new Set());
  const [selected, setSelected] = useState<Endpoint | null>(null);

  const allProviders = useMemo(
    () => [...new Set(ENDPOINTS.map((e) => e.provider))].sort(),
    [],
  );
  const allModalities = useMemo(
    () => [...new Set(ENDPOINTS.map((e) => e.modality))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ENDPOINTS.filter((e) => {
      if (providers.size > 0 && !providers.has(e.provider)) return false;
      if (modalities.size > 0 && !modalities.has(e.modality)) return false;
      if (accesses.size > 0 && !accesses.has(e.access)) return false;
      if (!q) return true;
      const haystack = [e.name, e.provider, e.notes, e.limits, ...e.models]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, providers, modalities, accesses]);

  const modelCount = useMemo(
    () => new Set(ENDPOINTS.flatMap((e) => e.models)).size,
    [],
  );

  function toggle<T>(set: Set<T>, value: T, update: (next: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    update(next);
  }

  const hasFilters =
    query !== "" || providers.size > 0 || modalities.size > 0 || accesses.size > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◍</span>
          <div>
            <h1>freeLLM Catalog</h1>
            <p className="tagline">
              One living index of free AI methods that still work
            </p>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <strong>{modelCount}</strong>
            <span>models</span>
          </div>
          <div className="stat">
            <strong>{allProviders.length}</strong>
            <span>providers</span>
          </div>
          <div className="stat">
            <strong>{ENDPOINTS.length}</strong>
            <span>routes</span>
          </div>
        </div>
      </header>

      <div className="sample-banner">
        Sample data — a realistic invented snapshot inspired by{" "}
        <a href="https://freellm.sh" target="_blank" rel="noreferrer">
          freellm.sh
        </a>
        , not live-scraped.
      </div>

      <div className="layout">
        <aside className="sidebar">
          <input
            className="search"
            type="search"
            placeholder="Search models, providers, limits…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <FilterGroup
            title="Access"
            options={(Object.keys(ACCESS_LABELS) as Access[]).map((a) => ({
              value: a,
              label: ACCESS_LABELS[a],
              count: ENDPOINTS.filter((e) => e.access === a).length,
            }))}
            selected={accesses}
            onToggle={(v) => toggle(accesses, v, setAccesses)}
          />

          <FilterGroup
            title="Modality"
            options={allModalities.map((m) => ({
              value: m,
              label: MODALITY_LABELS[m],
              count: ENDPOINTS.filter((e) => e.modality === m).length,
            }))}
            selected={modalities}
            onToggle={(v) => toggle(modalities, v, setModalities)}
          />

          <FilterGroup
            title="Provider"
            options={allProviders.map((p) => ({
              value: p,
              label: p,
              count: ENDPOINTS.filter((e) => e.provider === p).length,
            }))}
            selected={providers}
            onToggle={(v) => toggle(providers, v, setProviders)}
          />

          {hasFilters && (
            <button
              className="clear-btn"
              onClick={() => {
                setQuery("");
                setProviders(new Set());
                setModalities(new Set());
                setAccesses(new Set());
              }}
            >
              Clear all filters
            </button>
          )}
        </aside>

        <main className="results">
          <div className="results-header">
            <span>
              {filtered.length} route{filtered.length === 1 ? "" : "s"}
              {hasFilters ? " matching" : ""}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="empty">
              <p>No routes match. Try clearing a filter.</p>
            </div>
          ) : (
            <div className="grid">
              {filtered.map((e) => (
                <EndpointCard
                  key={e.id}
                  endpoint={e}
                  active={selected?.id === e.id}
                  onClick={() => setSelected(e)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {selected && (
        <DetailPanel endpoint={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
