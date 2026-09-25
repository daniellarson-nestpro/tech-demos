import {
  ACCESS_LABELS,
  MODALITY_LABELS,
  type Endpoint,
} from "./data";

const STATUS_LABELS: Record<Endpoint["status"], string> = {
  operational: "Operational",
  degraded: "Degraded",
  unverified: "Unverified",
};

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count: number;
}

export function FilterGroup<T extends string>(props: {
  title: string;
  options: FilterOption<T>[];
  selected: Set<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <section className="filter-group">
      <h3>{props.title}</h3>
      <ul>
        {props.options.map((o) => (
          <li key={o.value}>
            <label className={props.selected.has(o.value) ? "checked" : ""}>
              <input
                type="checkbox"
                checked={props.selected.has(o.value)}
                onChange={() => props.onToggle(o.value)}
              />
              <span className="filter-label">{o.label}</span>
              <span className="filter-count">{o.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EndpointCard(props: {
  endpoint: Endpoint;
  active: boolean;
  onClick: () => void;
}) {
  const e = props.endpoint;
  return (
    <button
      className={`card ${props.active ? "card-active" : ""}`}
      onClick={props.onClick}
    >
      <div className="card-top">
        <span className={`status status-${e.status}`} title={STATUS_LABELS[e.status]} />
        <span className="card-provider">{e.provider}</span>
        <span className={`badge badge-${e.access}`}>{ACCESS_LABELS[e.access]}</span>
      </div>
      <h2 className="card-name">{e.name}</h2>
      <p className="card-limits">{e.limits}</p>
      <div className="card-models">
        {e.models.slice(0, 3).map((m) => (
          <code key={m}>{m}</code>
        ))}
        {e.models.length > 3 && (
          <span className="more">+{e.models.length - 3}</span>
        )}
      </div>
      <div className="card-foot">
        <span className="pill">{MODALITY_LABELS[e.modality]}</span>
        {e.openaiCompatible && <span className="pill pill-oai">OpenAI-compatible</span>}
      </div>
    </button>
  );
}

export function DetailPanel(props: { endpoint: Endpoint; onClose: () => void }) {
  const e = props.endpoint;
  return (
    <>
      <div className="overlay" onClick={props.onClose} />
      <aside className="detail">
        <div className="detail-head">
          <div>
            <span className="card-provider">{e.provider}</span>
            <h2>{e.name}</h2>
          </div>
          <button className="close-btn" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="detail-badges">
          <span className={`badge badge-${e.access}`}>{ACCESS_LABELS[e.access]}</span>
          <span className="pill">{MODALITY_LABELS[e.modality]}</span>
          <span className={`pill status-pill status-pill-${e.status}`}>
            {STATUS_LABELS[e.status]}
          </span>
          {e.openaiCompatible && <span className="pill pill-oai">OpenAI-compatible</span>}
        </div>

        <dl className="detail-fields">
          <dt>Limits</dt>
          <dd>{e.limits}</dd>

          <dt>Base URL</dt>
          <dd>
            <code className="url">{e.baseUrl}</code>
          </dd>

          <dt>Models ({e.models.length})</dt>
          <dd className="model-list">
            {e.models.map((m) => (
              <code key={m}>{m}</code>
            ))}
          </dd>

          <dt>License</dt>
          <dd>{e.license}</dd>

          <dt>Notes</dt>
          <dd>{e.notes}</dd>

          <dt>Last verified</dt>
          <dd>{e.lastVerified} (sample data)</dd>
        </dl>
      </aside>
    </>
  );
}
