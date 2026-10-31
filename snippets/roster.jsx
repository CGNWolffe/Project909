export const Roster = ({ agency = "chp" }) => {
  // CSV feeds for each tab of the "Victorville Master Roster" Google Sheet.
  // The sheet's General access must stay on "Anyone with the link" (Viewer) for these to load.
  const SHEET = "https://docs.google.com/spreadsheets/d/1fLdv6x4C2Q_ry7iynJqD-aTxltUJ2-QmpXElfvm-Vm4/gviz/tq?tqx=out:csv&headers=1&sheet=";
  const SOURCES = {
    chp: SHEET + "CHP",
    sbcsd: SHEET + "SBCSD"
  };

  const AGENCIES = {
    chp: {
      label: "CHP",
      title: "CHP Inland Division",
      sub: "Victorville Area",
      rule: "3 digits",
      example: "104",
      pattern: /^\d{3}$/,
      ranks: ["Chief", "Assistant Chief", "Captain", "Lieutenant", "Sergeant", "Officer", "Cadet"]
    },
    sbcsd: {
      label: "SBCSD",
      title: "SBCSD Victorville Station",
      sub: "San Bernardino County",
      rule: "2 digits + 1 letter",
      example: "12A",
      pattern: /^\d{2}[A-Z]$/,
      ranks: ["Sheriff", "Undersheriff", "Assistant Sheriff", "Deputy Chief", "Captain", "Lieutenant", "Sergeant", "Corporal", "Detective", "Deputy Sheriff", "Deputy Sheriff Trainee"]
    }
  };

  const STATUS_CLASS = { active: "ok", probationary: "warn", probation: "warn", loa: "info", suspended: "bad", inactive: "off" };

  const [current, setCurrent] = useState(AGENCIES[agency] ? agency : "chp");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [updated, setUpdated] = useState(null);

  const parseCsv = (text) => {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const [header = [], ...body] = rows.filter(r => r.some(v => v.trim() !== ""));
    const keys = header.map(h => h.trim().toLowerCase());
    return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])));
  };

  const load = async () => {
    setLoading(true); setError("");
    const next = {};
    try {
      for (const key of Object.keys(SOURCES)) {
        if (!SOURCES[key]) continue;
        const res = await fetch(SOURCES[key], { cache: "no-store" });
        if (!res.ok) throw new Error(`${AGENCIES[key].label} sheet returned ${res.status}`);
        next[key] = parseCsv(await res.text());
      }
      setData(next);
      setUpdated(new Date());
    } catch (e) {
      setError("Couldn't load the roster sheet. Check that it's still published to the web.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const A = AGENCIES[current];
  const configured = Boolean(SOURCES[current]);
  const members = (data[current] || [])
    .map(m => ({ ...m, callsign: (m.callsign || "").toUpperCase().replace(/[^0-9A-Z]/g, "") }))
    .filter(m => m.name || m.callsign);

  const counts = {};
  members.forEach(m => { counts[m.callsign] = (counts[m.callsign] || 0) + 1; });

  const q = query.trim().toLowerCase();
  const visible = members.filter(m => !q || [m.callsign, m.name, m.rank, m.assignment, m.status, m.notes].join(" ").toLowerCase().includes(q));

  const rankOrder = (r) => { const i = A.ranks.findIndex(x => x.toLowerCase() === (r || "").toLowerCase()); return i < 0 ? 999 : i; };
  const sorted = [...visible].sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank) || (a.rank || "").localeCompare(b.rank || "") || a.callsign.localeCompare(b.callsign, undefined, { numeric: true }));
  const groups = [];
  sorted.forEach(m => {
    const rank = m.rank || "Unassigned";
    if (!groups.length || groups[groups.length - 1].rank !== rank) groups.push({ rank, items: [] });
    groups[groups.length - 1].items.push(m);
  });

  const statusOf = (s) => STATUS_CLASS[(s || "").toLowerCase()] || "off";
  const tally = (s) => members.filter(m => statusOf(m.status) === s).length;
  const stats = [["On roster", members.length], ["Active", tally("ok")], ["Probationary", tally("warn")], ["LOA / out", tally("info") + tally("bad") + tally("off")]];

  return (
    <div className={`p909r not-prose a-${current}`}>
      <style>{`
        .p909r { --bg: #ffffff; --soft: #f6f5f1; --fg: #1c1a14; --muted: #6b6656; --line: #e4e0d4;
          --ok: #23804a; --warn: #a76a07; --info: #2a63a8; --bad: #b3362b; --off: #737a84;
          font-size: 14px; color: var(--fg); display: grid; gap: 16px; }
        .p909r.a-chp { --acc: #1d4f91; --acc2: #c8a24a; --tint: #e8eef8; --b1: #0b2147; --b2: #1d4f91; }
        .p909r.a-sbcsd { --acc: #2b5a3a; --acc2: #c8a24a; --tint: #e6efe8; --b1: #16301f; --b2: #33613f; }
        .dark .p909r { --bg: #1a1813; --soft: #15130f; --fg: #ece8dc; --muted: #a39d8b; --line: #2f2b22;
          --ok: #5fc07f; --warn: #e3a33a; --info: #75a8e8; --bad: #ef7a6f; --off: #8b939c; }
        .dark .p909r.a-chp { --acc: #7eaaea; --tint: #1a2638; --b1: #081733; --b2: #163d72; }
        .dark .p909r.a-sbcsd { --acc: #7cc08f; --tint: #18261c; --b1: #0f2016; --b2: #26492f; }
        .p909r .band { background: linear-gradient(135deg, var(--b1), var(--b2)); color: #f4f2ea; border-radius: 14px; padding: 20px; display: grid; gap: 18px; border-bottom: 4px solid var(--acc2); }
        .p909r .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .p909r .eyebrow { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; opacity: .7; }
        .p909r .switch { display: inline-flex; background: rgba(0,0,0,.28); border-radius: 999px; padding: 4px; gap: 2px; }
        .p909r .switch button { border: 0; background: none; color: rgba(255,255,255,.7); font-weight: 700; letter-spacing: .08em; padding: 7px 16px; border-radius: 999px; cursor: pointer; }
        .p909r .switch button[aria-pressed="true"] { background: #f4f2ea; color: var(--b1); }
        .p909r h2.title { margin: 0; font-size: clamp(26px, 5vw, 38px); font-weight: 800; line-height: 1; text-transform: uppercase; letter-spacing: .01em; color: #fff; }
        .p909r .sub { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; opacity: .85; margin-top: 6px; }
        .p909r .pill { font-family: ui-monospace, Consolas, monospace; font-size: 12px; border: 1px solid rgba(255,255,255,.3); border-radius: 999px; padding: 2px 10px; }
        .p909r .pill b { color: var(--acc2); }
        .p909r .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .p909r .stat { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 10px; padding: 10px 12px; }
        .p909r .stat .n { font-size: 26px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
        .p909r .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; opacity: .7; margin-top: 4px; }
        @media (max-width: 560px) { .p909r .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .p909r .tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .p909r .tools input { flex: 1 1 220px; min-width: 0; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: inherit; }
        .p909r .tools button { padding: 9px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
        .p909r .tools .meta { font-size: 12px; color: var(--muted); }
        .p909r .group { display: grid; gap: 8px; }
        .p909r .group h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--acc); }
        .p909r .group h3 span { font-size: 12px; color: var(--muted); letter-spacing: 0; }
        .p909r .group h3::after { content: ""; flex: 1; height: 1px; background: var(--line); }
        .p909r .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
        .p909r .card { background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; min-width: 0; }
        .p909r .cs { grid-row: span 2; font-family: ui-monospace, Consolas, monospace; font-weight: 700; font-size: 16px; letter-spacing: .05em; background: var(--tint); color: var(--acc); border: 1.5px solid var(--acc); border-radius: 8px; padding: 7px 9px; min-width: 50px; text-align: center; align-self: start; }
        .p909r .cs.badcs { border-style: dashed; color: var(--bad); border-color: var(--bad); }
        .p909r .name { font-weight: 600; font-size: 15px; overflow-wrap: anywhere; }
        .p909r .line2 { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 12px; color: var(--muted); }
        .p909r .notes { grid-column: 2; font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; }
        .p909r .warnline { grid-column: 2; font-size: 12px; color: var(--bad); }
        .p909r .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
        .p909r .chip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
        .p909r .ok { color: var(--ok); } .p909r .warn { color: var(--warn); } .p909r .info { color: var(--info); } .p909r .bad { color: var(--bad); } .p909r .off { color: var(--off); }
        .p909r .empty { padding: 36px 16px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; background: var(--soft); }
        .p909r .empty strong { display: block; color: var(--fg); font-size: 18px; margin-bottom: 4px; }
      `}</style>

      <div className="band">
        <div className="top">
          <div className="eyebrow">Victorville · Master roster</div>
          <div className="switch">
            {Object.keys(AGENCIES).map(key => (
              <button key={key} type="button" aria-pressed={current === key} onClick={() => setCurrent(key)}>{AGENCIES[key].label}</button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="title">{A.title}</h2>
          <div className="sub"><span>{A.sub}</span><span className="pill">Callsigns: <b>{A.rule}</b> · e.g. {A.example}</span></div>
        </div>
        <div className="stats">
          {stats.map(([label, n]) => <div className="stat" key={label}><div className="n">{n}</div><div className="l">{label}</div></div>)}
        </div>
      </div>

      <div className="tools">
        <input type="search" placeholder="Search name, callsign, assignment…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search roster" />
        <button type="button" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        {updated && <span className="meta">Updated {updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
      </div>

      {!configured ? (
        <div className="empty"><strong>Roster sheet not connected yet</strong>The {A.label} roster will appear here once its Google Sheet tab is published and linked.</div>
      ) : error ? (
        <div className="empty"><strong>Roster unavailable</strong>{error}</div>
      ) : loading && !members.length ? (
        <div className="empty"><strong>Loading roster…</strong>Members appear here grouped by rank.</div>
      ) : !members.length ? (
        <div className="empty"><strong>No {A.label} members yet</strong>Add rows to the {A.label} tab of the roster sheet.</div>
      ) : !groups.length ? (
        <div className="empty"><strong>No matches</strong>Nobody fits that search.</div>
      ) : groups.map(g => (
        <section className="group" key={g.rank}>
          <h3>{g.rank}<span>{g.items.length}</span></h3>
          <div className="cards">
            {g.items.map((m, i) => {
              const bad = !A.pattern.test(m.callsign);
              const dup = counts[m.callsign] > 1;
              return (
                <article className="card" key={m.callsign + i}>
                  <div className={`cs${bad || dup ? " badcs" : ""}`}>{m.callsign || "—"}</div>
                  <div className="name">{m.name}</div>
                  <div className="line2">
                    {m.assignment && <span>{m.assignment}</span>}
                    {m.status && <span className={`chip ${statusOf(m.status)}`}>{m.status}</span>}
                    {m.joined && <span>Joined {m.joined}</span>}
                  </div>
                  {m.notes && <div className="notes">{m.notes}</div>}
                  {bad && <div className="warnline">Callsign should be {A.rule} (e.g. {A.example}).</div>}
                  {!bad && dup && <div className="warnline">Callsign {m.callsign} is used more than once.</div>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
