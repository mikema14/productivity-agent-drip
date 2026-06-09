/* Drip — Focus Panel (Pomodoro Redesign)
   Apple-native aesthetic. Shared frame for Ready + Running states. */

const { useState, useEffect, useRef, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "state": "ready",
  "duration": 25,
  "elapsed": 3,
  "completedSessions": 3,
  "totalSessions": 8,
  "accentHue": 70,
  "intention": "",
  "hasPreviousSession": true,
  "hasTaskSelected": true,
  "primaryLabel": "Begin Focus"
}/*EDITMODE-END*/;

/* ───────── Icons ───────── */
const I = {
  target: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><path d="M8 .8v2.5M8 12.7v2.5M.8 8h2.5M12.7 8h2.5"/>
    </svg>
  ),
  resume: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" {...p} style={{width:18,height:18,...p?.style}}>
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5"/><path d="M13.5 2.5v3h-3"/>
    </svg>
  ),
  chev: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="m4 6 4 4 4-4"/>
    </svg>
  ),
  search: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>
    </svg>
  ),
  play: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="currentColor" {...p} style={{width:12,height:12,...p?.style}}>
      <path d="M4 3.2v9.6a.4.4 0 0 0 .6.34l7.8-4.8a.4.4 0 0 0 0-.68l-7.8-4.8A.4.4 0 0 0 4 3.2Z"/>
    </svg>
  ),
  pause: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="currentColor" {...p} style={{width:12,height:12,...p?.style}}>
      <rect x="4" y="3" width="3" height="10" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/>
    </svg>
  ),
  check: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p} style={{width:12,height:12,...p?.style}}>
      <path d="m3.5 8.5 3 3 6-7"/>
    </svg>
  ),
  x: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p} style={{width:12,height:12,...p?.style}}>
      <path d="M4 4l8 8M12 4l-8 8"/>
    </svg>
  ),
  note: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5L13 5.5v7A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-9Z"/>
      <path d="M9 2v3.5h4"/>
    </svg>
  ),
  arrowRight: (p) => (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p} style={{width:14,height:14,...p?.style}}>
      <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/>
    </svg>
  ),
};

/* ───────── Ticks ───────── */
function Ticks({ count = 60 }) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const isMajor = i % 5 === 0;
    ticks.push(<i key={i} className={isMajor ? "major" : ""} style={{ transform: `rotate(${(i / count) * 360}deg)` }} />);
  }
  return <div className="ticks">{ticks}</div>;
}

/* ───────── Session dots ───────── */
function SessionDots({ completed, total, running }) {
  return (
    <div className="sessions" aria-label={`${completed} of ${total} sessions`}>
      {Array.from({ length: total }).map((_, i) => {
        let cls = "s";
        if (i < completed) cls += " done";
        else if (i === completed && running) cls += " current";
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}

/* ───────── Clock ───────── */
function Clock({ mmss, running, progress, addMin, window: win }) {
  return (
    <div className="clock-wrap">
      <div className={"clock" + (running ? " is-running" : "")} style={{ "--progress": progress }}>
        <div className="ring" />
        <Ticks />
        <div className="face">
          {running && win && (
            <>
              <button className="addmin" onClick={addMin}>+5 min</button>
              <div className="window">
                <span>{win.start}</span>
                <span className="arrow">→</span>
                <span>{win.end}</span>
              </div>
            </>
          )}
          <div className="time">
            <span>{mmss.m}</span>
            <span className="colon">:</span>
            <span>{mmss.s}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Empty-state task picker ───────── */
const RECENT_TASKS = [
  { id: "667776", title: "ER to Raynet integration", client: "TopGis", ago: "2h" },
  { id: "673129", title: "Michal Halás — Consulting", client: "EON", ago: "Yesterday" },
  { id: "672014", title: "Pipeline cleanup + reporting", client: "E8 Priorities", ago: "2d" },
  { id: "671902", title: "VARS onboarding kickoff", client: "VARS", ago: "3d" },
];

function TaskPicker({ query, setQuery, onPick }) {
  const filtered = query
    ? RECENT_TASKS.filter(
        (r) => r.id.includes(query) || r.title.toLowerCase().includes(query.toLowerCase())
      )
    : RECENT_TASKS;
  return (
    <div className="picker">
      <div className="search">
        <I.search style={{ color: "var(--text-3)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search task ID or title…"
          autoFocus
        />
        <kbd>⌘K</kbd>
      </div>
      <div>
        <div className="section">Recent tasks</div>
        {filtered.slice(0, 4).map((r) => (
          <div key={r.id} className="row" onClick={() => onPick(r)}>
            <span className="tid">#{r.id}</span>
            <span className="title">{r.title}</span>
            <span className="client">&lt;{r.client}&gt;</span>
            <span className="ago">{r.ago}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "14px 8px", fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>
            No matching tasks. Press Enter to create <span style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>#{query}</span>.
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Main panel ───────── */
function FocusPanel() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const running = t.state === "running";
  const paused = t.state === "paused";
  const isActive = running || paused;

  // Selected task state (local — task is "real" in active/ready when hasTaskSelected)
  const [task, setTask] = useState({
    id: "667776",
    title: "ER to Raynet integration",
    client: "TopGis",
  });
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [activeNote, setActiveNote] = useState("Field analysis for 2. part wf release");

  // Visual tick
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const totalSec = t.duration * 60;
  const elapsedSec = Math.min(totalSec, Math.round(t.elapsed * 60) + (running ? tick : 0));
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  const mmss = { m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
  const progress = running ? elapsedSec / totalSec : 0;

  const window = useMemo(() => {
    if (!running) return null;
    const now = new Date();
    const start = new Date(now.getTime() - elapsedSec * 1000);
    const end = new Date(start.getTime() + totalSec * 1000);
    const fmt = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { start: fmt(start), end: fmt(end) };
  }, [running, elapsedSec, totalSec]);

  const addMin = () => setTweak("duration", (t.duration || 25) + 5);

  const begin = () => {
    if (!t.hasTaskSelected) return;
    setTweak("state", "running");
    if (note.trim()) setActiveNote(note.trim());
  };
  const pause = () => setTweak("state", "paused");
  const resume = () => setTweak("state", "running");
  const finish = () => {
    setTweak("state", "ready");
    setTweak("elapsed", 0);
    setTweak("completedSessions", Math.min(t.totalSessions, (t.completedSessions || 0) + 1));
  };
  const cancel = () => {
    setTweak("state", "ready");
    setTweak("elapsed", 0);
  };

  const resumePrevious = () => {
    setTask({ id: "667776", title: "ER to Raynet integration", client: "TopGis" });
    setActiveNote("Field analysis for 2. part wf release");
    setTweak("hasTaskSelected", true);
    setTweak("state", "running");
    setTweak("elapsed", 0);
  };

  const pickTask = (row) => {
    setTask({ id: row.id, title: row.title, client: row.client });
    setTweak("hasTaskSelected", true);
  };

  // Apply accent hue
  useEffect(() => {
    const hue = t.accentHue ?? 70;
    document.documentElement.style.setProperty("--accent", `oklch(0.78 0.14 ${hue})`);
    document.documentElement.style.setProperty("--accent-soft", `oklch(0.78 0.14 ${hue} / 0.18)`);
    document.documentElement.style.setProperty("--accent-dim", `oklch(0.78 0.14 ${hue} / 0.42)`);
  }, [t.accentHue]);

  const hasIntention = !!(t.intention && t.intention.trim());

  return (
    <div className="panel">
      {/* Header */}
      <div className="header">
        <div>
          <h1>{isActive ? "Deep work" : "Focus"}</h1>
          <div className="sub">
            {isActive
              ? `Session ${(t.completedSessions || 0) + 1} of ${t.totalSessions}`
              : "Start your session"}
          </div>
        </div>
        <div className={"state-pill" + (running ? " is-running" : "")}>
          <span className="led" />
          <span>{running ? "Focusing" : paused ? "Paused" : "Ready"}</span>
        </div>
      </div>

      {/* Intention — only when set */}
      {hasIntention && (
        <div className="intention">
          <div className="label">
            <I.target />
            <span>Today's intention · <span style={{ color: "var(--text)" }}>{t.intention}</span></span>
          </div>
          <button>Edit</button>
        </div>
      )}

      {/* Resume previous session — prominent CTA, Ready state only */}
      {!isActive && t.hasPreviousSession && (
        <button className="resume" onClick={resumePrevious}>
          <I.resume />
          <div className="meta">
            <div className="top">
              <span>Continue previous</span>
              <span className="tid">#667776</span>
            </div>
            <div className="task">Field analysis for 2. part wf release</div>
          </div>
          <span className="go">
            Continue <I.arrowRight />
          </span>
        </button>
      )}

      {/* Clock */}
      <Clock mmss={mmss} running={running} progress={progress} addMin={addMin} window={window} />

      {/* Session dots */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <SessionDots completed={t.completedSessions || 0} total={t.totalSessions || 8} running={running} />
      </div>

      {/* Duration segments — ready state only */}
      {!isActive && (
        <div className="segments" role="tablist" aria-label="Duration">
          {[15, 25, 50, 90].map((d) => (
            <button
              key={d}
              className={"seg" + (t.duration === d ? " active" : "")}
              onClick={() => setTweak("duration", d)}
            >
              {d}m
            </button>
          ))}
        </div>
      )}

      {/* Task area — three variants: empty picker, selected card, running card */}
      {!isActive && !t.hasTaskSelected && (
        <TaskPicker query={query} setQuery={setQuery} onPick={pickTask} />
      )}

      {!isActive && t.hasTaskSelected && (
        <div className="task-card">
          <div className="id-field">
            <span className="hash">#</span>
            <input
              className="tc-input"
              value={task.id}
              onChange={(e) => setTask({ ...task, id: e.target.value })}
              placeholder="Task ID"
            />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{task.title}</span>
            <span
              className="chev"
              onClick={() => setTweak("hasTaskSelected", false)}
              style={{ cursor: "default" }}
              title="Change task"
            >
              <I.chev />
            </span>
          </div>
          <div className="tc-note-row">
            <I.note className="ico" style={{ color: "var(--text-3)" }} />
            <input
              className="tc-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Session note (optional)"
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="meta-foot">
            <span>Client <span style={{ color: "var(--text-2)" }}>&lt;{task.client}&gt;</span></span>
            <span>
              Today <span className="sep">·</span> <span>{t.completedSessions}/{t.totalSessions} sessions</span>
            </span>
          </div>
        </div>
      )}

      {isActive && (
        <div className="task-card readonly">
          <div className="tc-row1">
            <span className="tc-tid">#{task.id}</span>
            <span className="tc-title">
              {task.title}{" "}
              <span style={{ color: "var(--text-3)", fontFamily: "var(--mono)", fontSize: 11.5 }}>
                &lt;{task.client}&gt;
              </span>
            </span>
          </div>
          <div className="tc-divider" />
          <div className="tc-note-row">
            <I.note className="ico" />
            <span className="tc-readonly">{activeNote || "No note"}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        {!isActive ? (
          <button
            className="btn btn-primary"
            onClick={begin}
            disabled={!t.hasTaskSelected}
          >
            <I.play /> {t.primaryLabel || "Begin Focus"}
          </button>
        ) : (
          <>
            {running ? (
              <button className="btn btn-secondary" onClick={pause}>
                <I.pause /> Pause
              </button>
            ) : (
              <button className="btn btn-primary" onClick={resume}>
                <I.play /> Resume
              </button>
            )}
            <button className="btn btn-secondary" onClick={finish}>
              <I.check /> Finish
            </button>
            <button className="btn btn-danger" onClick={cancel}>
              <I.x /> Cancel
            </button>
          </>
        )}
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="State" />
        <TweakRadio
          label="Timer state"
          value={t.state}
          options={["ready", "running", "paused"]}
          onChange={(v) => setTweak("state", v)}
        />
        <TweakToggle
          label="Task selected"
          value={t.hasTaskSelected}
          onChange={(v) => setTweak("hasTaskSelected", v)}
        />
        <TweakToggle
          label="Has previous session"
          value={t.hasPreviousSession}
          onChange={(v) => setTweak("hasPreviousSession", v)}
        />

        <TweakSection label="Intention" />
        <TweakText
          label="Today's intention"
          value={t.intention}
          placeholder="(empty — panel hidden)"
          onChange={(v) => setTweak("intention", v)}
        />

        <TweakSection label="Session" />
        <TweakSlider
          label="Duration"
          value={t.duration}
          min={5}
          max={120}
          step={5}
          unit="m"
          onChange={(v) => setTweak("duration", v)}
        />
        <TweakSlider
          label="Elapsed (demo)"
          value={t.elapsed}
          min={0}
          max={t.duration}
          step={1}
          unit="m"
          onChange={(v) => setTweak("elapsed", v)}
        />
        <TweakSlider
          label="Completed sessions"
          value={t.completedSessions}
          min={0}
          max={t.totalSessions}
          step={1}
          onChange={(v) => setTweak("completedSessions", v)}
        />
        <TweakSlider
          label="Total sessions"
          value={t.totalSessions}
          min={4}
          max={12}
          step={1}
          onChange={(v) => setTweak("totalSessions", v)}
        />

        <TweakSection label="Appearance" />
        <TweakSlider
          label="Accent hue"
          value={t.accentHue}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={(v) => setTweak("accentHue", v)}
        />

        <TweakSection label="Copy" />
        <TweakText
          label="Primary button"
          value={t.primaryLabel}
          onChange={(v) => setTweak("primaryLabel", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<FocusPanel />);
