import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];
const MAX_FRET = 24;
const STRING_NAMES = ["E", "A", "D", "G", "B", "E"];
const ROOTS = [
  { name: "C", pc: 0 }, { name: "C♯", alias: "D♭", pc: 1 }, { name: "D", pc: 2 },
  { name: "E♭", alias: "D♯", pc: 3 }, { name: "E", pc: 4 }, { name: "F", pc: 5 },
  { name: "F♯", alias: "G♭", pc: 6 }, { name: "G", pc: 7 }, { name: "A♭", alias: "G♯", pc: 8 },
  { name: "A", pc: 9 }, { name: "B♭", alias: "A♯", pc: 10 }, { name: "B", pc: 11 },
];

const QUALITIES = [
  { id: "major", label: "Major", suffix: "", intervals: [0, 4, 7], color: "#f3b35a" },
  { id: "minor", label: "Minor", suffix: "m", intervals: [0, 3, 7], color: "#ee7e72" },
  { id: "dominant7", label: "Dominant 7", suffix: "7", intervals: [0, 4, 7, 10], color: "#a0d47c" },
  { id: "major7", label: "Major 7", suffix: "maj7", intervals: [0, 4, 7, 11], color: "#75c8da" },
  { id: "minor7", label: "Minor 7", suffix: "m7", intervals: [0, 3, 7, 10], color: "#b394e9" },
];

const STARTING_STRINGS = [
  { id: "6", label: "6th", detail: "LOW E", basePc: 4, shapeLabel: "E-shape" },
  { id: "5", label: "5th", detail: "A STRING", basePc: 9, shapeLabel: "A-shape" },
  { id: "4", label: "4th", detail: "D STRING", basePc: 2, shapeLabel: "D-shape" },
];

const SHAPE_TEMPLATES = {
  "6": {
    major: [0, 2, 2, 1, 0, 0], minor: [0, 2, 2, 0, 0, 0],
    dominant7: [0, 2, 0, 1, 0, 0], major7: [0, 2, 1, 1, 0, 0], minor7: [0, 2, 0, 0, 0, 0],
  },
  "5": {
    major: [null, 0, 2, 2, 2, 0], minor: [null, 0, 2, 2, 1, 0],
    dominant7: [null, 0, 2, 0, 2, 0], major7: [null, 0, 2, 1, 2, 0], minor7: [null, 0, 2, 0, 1, 0],
  },
  "4": {
    major: [null, null, 0, 2, 3, 2], minor: [null, null, 0, 2, 3, 1],
    dominant7: [null, null, 0, 2, 1, 2], major7: [null, null, 0, 2, 2, 2], minor7: [null, null, 0, 2, 1, 1],
  },
};

function fretForRoot(rootPc, basePc) {
  return (rootPc - basePc + 12) % 12;
}

function makeLibrary() {
  return ROOTS.flatMap((root) => STARTING_STRINGS.flatMap((startingString) => QUALITIES.map((quality) => {
    const rootFret = fretForRoot(root.pc, startingString.basePc);
    const template = SHAPE_TEMPLATES[startingString.id][quality.id];
    const frets = template.map((fret) => fret === null ? "muted" : fret + rootFret);
    const isOpen = rootFret === 0;
    return {
      id: `${root.name}-${startingString.id}-${quality.id}`,
      root: root.name, rootPc: root.pc, startingString: startingString.id,
      startingStringLabel: startingString.label, quality: quality.id,
      qualityLabel: quality.label, suffix: quality.suffix, color: quality.color,
      shapeName: isOpen ? "Open position" : `${startingString.shapeLabel} barre`,
      frets, openPattern: isOpen ? frets.map((fret) => fret === "muted" ? "x" : fret).join("") : null,
      source: isOpen ? "Common open-position voicing" : `Movable ${startingString.shapeLabel} voicing`,
      intervals: quality.intervals,
    };
  })));
}

const LIBRARY = makeLibrary();

function chordLabel(root, quality) {
  const qualityMatch = QUALITIES.find((item) => item.id === quality);
  return `${root}${qualityMatch?.suffix ?? ""}`;
}

function noteName(midi) {
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  return names[((midi % 12) + 12) % 12];
}

function activeNotes(frets) {
  return frets.flatMap((fret, index) => fret === null || fret === "muted" ? [] : [{ midi: STANDARD_TUNING[index] + fret, index }]);
}

function detectChord(frets) {
  const notes = activeNotes(frets).map(({ midi }) => midi);
  const uniquePcs = [...new Set(notes.map((note) => note % 12))];
  if (!uniquePcs.length) return { label: "No notes", detail: "Add notes on the fretboard" };
  const candidates = [];
  ROOTS.forEach((root) => QUALITIES.forEach((quality) => {
    const expected = quality.intervals.map((interval) => (root.pc + interval) % 12);
    if (expected.every((pc) => uniquePcs.includes(pc)) && uniquePcs.every((pc) => expected.includes(pc))) {
      const bass = Math.min(...notes) % 12;
      candidates.push({
        label: chordLabel(root.name, quality.id) + (bass !== root.pc ? `/${noteName(Math.min(...notes))}` : ""),
        detail: `${quality.label} · ${uniquePcs.length} tones`,
        score: expected.length * 10 + (bass === root.pc ? 3 : 0),
      });
    }
  }));
  if (candidates.length) return candidates.sort((a, b) => b.score - a.score)[0];
  return { label: "Custom voicing", detail: `${noteName(Math.min(...notes))} bass · ${uniquePcs.length} unique tones` };
}

function scheduleNote(context, midi, start, volume) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  oscillator.type = "triangle";
  oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, start);
  filter.frequency.exponentialRampToValueAtTime(700, start + 1.4);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.55);
  oscillator.connect(filter).connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 1.6);
}

function createAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return AudioContext ? new AudioContext() : null;
}

function playVoicing(frets, mode = "strum") {
  const context = createAudioContext();
  if (!context) return;
  const notes = activeNotes(frets);
  const now = context.currentTime;
  notes.forEach(({ midi, index }, noteIndex) => scheduleNote(context, midi, now + (mode === "individual" ? noteIndex * 0.29 : index * 0.045), 0.22 / Math.sqrt(notes.length || 1)));
  window.setTimeout(() => context.close(), mode === "individual" ? 2500 : 1900);
}

function playProgression(chords, bpm = 160) {
  const context = createAudioContext();
  if (!context || !chords.length) return;
  const beat = 60 / bpm;
  const chordDuration = beat * 4;
  const now = context.currentTime;
  chords.forEach((chord, chordIndex) => activeNotes(chord.frets).forEach(({ midi, index }) => {
    scheduleNote(context, midi, now + chordIndex * chordDuration + index * 0.045, 0.22 / Math.sqrt(activeNotes(chord.frets).length || 1));
  }));
  window.setTimeout(() => context.close(), chords.length * chordDuration * 1000 + 1900);
}

function makeProgressionChord(entry) {
  return { ...entry, instanceId: `${entry.id}-${Date.now()}-${Math.random()}`, frets: [...entry.frets] };
}

function makeEmptyChord() {
  return {
    ...LIBRARY.find((entry) => entry.id === "E-6-minor"),
    instanceId: `empty-${Date.now()}-${Math.random()}`,
    frets: [null, null, null, null, null, null],
    root: "—", suffix: "", qualityLabel: "Empty slot", shapeName: "Build from scratch", source: "User-created voicing",
  };
}

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function Header({ page, onNavigate, themeMode, onThemeChange }) {
  return <header className="topbar">
    <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>CHORD ATLAS</span></div>
    <nav className="header-nav" aria-label="Primary navigation">
      <button className={`header-tab ${page === "library" ? "active" : ""}`} onClick={() => onNavigate("library")}>Chord library</button>
      <button className={`header-tab ${page === "composer" ? "active" : ""}`} onClick={() => onNavigate("composer")}>Composer</button>
    </nav>
    <div className="header-tools"><label className="theme-control"><span className="sr-only">Color theme</span><select aria-label="Color theme" value={themeMode} onChange={(event) => onThemeChange(event.target.value)}><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label><div className="header-status">E STANDARD</div></div>
  </header>;
}

function intervalName(interval) {
  if (interval === 0) return "ROOT";
  if (interval === 3) return "MIN 3RD";
  if (interval === 4) return "MAJ 3RD";
  if (interval === 7) return "5TH";
  if (interval === 10) return "♭7TH";
  if (interval === 11) return "MAJ 7TH";
  return `INTERVAL ${interval}`;
}

function VoicingDetails({ selected, frets }) {
  const detected = useMemo(() => detectChord(frets), [frets]);
  const isEdited = selected.frets.some((fret, index) => fret !== frets[index]);
  const rootLabel = isEdited ? (detected.label === "Custom voicing" ? "—" : detected.label.split("/")[0].replace(/(maj7|m7|7|m)$/, "")) : selected.root;
  const shapeLabel = isEdited ? "Edited shape" : selected.shapeName;
  return <section className="voicing-details"><div className="details-heading"><div><p className="kicker">VOICING DETAILS</p><h2>{isEdited ? detected.label : `${selected.root}${selected.suffix}`} anatomy</h2></div></div><div className="details-summary"><div><span>ROOT</span><strong>{rootLabel}</strong></div><div><span>SHAPE</span><strong>{shapeLabel}</strong></div></div><div className="details-intervals">{selected.intervals.map((interval) => <div className="details-interval-row" key={interval}><span>{intervalName(interval)}</span><strong>{interval === 0 ? "1" : interval === 3 ? "♭3" : interval === 4 ? "3" : interval === 7 ? "5" : interval === 10 ? "♭7" : interval === 11 ? "7" : interval}</strong></div>)}</div><p className="details-copy">{isEdited ? "Live analysis of the notes currently placed on the fretboard." : `Common ${selected.shapeName.toLowerCase()} in standard tuning.`}</p></section>;
}

function Library({ selectedId, selected, frets, onSelect }) {
  const [root, setRoot] = useState("E");
  const [quality, setQuality] = useState("minor");
  const [startingString, setStartingString] = useState("6");
  const rootLibrary = LIBRARY.filter((entry) => entry.root === root && entry.startingString === startingString);
  const selectStartingString = (stringId) => {
    setStartingString(stringId);
    const matchingShape = LIBRARY.find((entry) => entry.root === root && entry.quality === quality && entry.startingString === stringId);
    if (matchingShape) onSelect(matchingShape);
  };
  return <aside className="library-panel">
    <div className="panel-heading"><div><h2>Chord library</h2></div></div>
    <p className="panel-copy">A focused set of dependable guitar voicings. Pick a root, then explore its five essential families.</p>
    <div className="filter-label">ROOT NOTE</div>
    <div className="root-grid">{ROOTS.map((item) => <button key={item.name} className={`root-button ${root === item.name ? "active" : ""}`} onClick={() => setRoot(item.name)}>{item.name}</button>)}</div>
    <div className="filter-label starting-string-label">ROOT STARTS ON</div>
    <div className="starting-string-list">{STARTING_STRINGS.map((item) => <button key={item.id} className={`starting-string-button ${startingString === item.id ? "active" : ""}`} onClick={() => selectStartingString(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>
    <div className="filter-label quality-label">CHORD FAMILY</div>
    <div className="quality-list">{QUALITIES.map((item) => <button key={item.id} className={`quality-button ${quality === item.id ? "active" : ""}`} onClick={() => setQuality(item.id)}><span className="quality-swatch" style={{ background: item.color }} /><span>{item.label}</span><span className="quality-suffix">{item.suffix || "maj"}</span></button>)}</div>
    <div className="library-results">{rootLibrary.filter((entry) => entry.quality === quality).map((entry) => <button key={entry.id} className={`shape-card ${selectedId === entry.id ? "selected" : ""}`} onClick={() => onSelect(entry)}><span className="shape-card-dot" style={{ background: entry.color }} /><span><strong>{entry.root}{entry.suffix}</strong><small>{entry.shapeName}</small></span><Icon>↗</Icon></button>)}</div>
    {selected && frets && <VoicingDetails selected={selected} frets={frets} />}
  </aside>;
}

function Fretboard({ frets, onChange }) {
  const fretCount = MAX_FRET;
  const markers = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);
  const fretboardRef = useRef(null);
  const previousFrets = useRef(frets);
  const [mutedFrom, setMutedFrom] = useState({});
  useEffect(() => {
    const changed = frets.some((fret, index) => fret !== previousFrets.current[index]);
    if (changed && fretboardRef.current) {
      const activeFrets = frets.filter((fret) => typeof fret === "number");
      const furthestFret = activeFrets.length ? Math.max(...activeFrets) : 0;
      const firstCell = fretboardRef.current.querySelector(".fret-cell");
      const fretWidth = firstCell?.getBoundingClientRect().width ?? 42;
      const targetLeft = furthestFret > 12 ? Math.max(0, (furthestFret - 9) * fretWidth) : 0;
      fretboardRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
    previousFrets.current = frets;
  }, [frets]);
  const updateString = (stringIndex, fret) => {
    const next = [...frets];
    const current = frets[stringIndex];
    if (typeof current === "number" && current === fret) {
      next[stringIndex] = "muted";
      setMutedFrom((previous) => ({ ...previous, [stringIndex]: fret }));
    } else if (current === "muted" && mutedFrom[stringIndex] === fret) {
      next[stringIndex] = null;
      setMutedFrom((previous) => { const updated = { ...previous }; delete updated[stringIndex]; return updated; });
    } else {
      next[stringIndex] = fret;
      setMutedFrom((previous) => { const updated = { ...previous }; delete updated[stringIndex]; return updated; });
    }
    onChange(next);
  };
  return <div className="fretboard-wrap" ref={fretboardRef}>
    <div className="fret-numbers"><span />{Array.from({ length: fretCount + 1 }, (_, fret) => <span key={fret} className={fret === 0 ? "open-number" : markers.has(fret) ? "marker-number" : ""}>{fret}</span>)}</div>
    <div className="fretboard">{STRING_NAMES.map((name, stringIndex) => ({ name, stringIndex })).reverse().map(({ name, stringIndex }) => <div className="string-row" key={`${name}-${stringIndex}`}>
      <div className="string-label"><strong>{name}</strong><small>{6 - stringIndex}</small></div>
      {Array.from({ length: fretCount + 1 }, (_, fret) => {
        const isSelected = frets[stringIndex] === fret;
        const isOpen = fret === 0;
        const isMuted = isOpen && frets[stringIndex] === "muted";
        return <button key={fret} aria-label={`${name} string, ${isOpen ? "open" : `fret ${fret}`}`} className={`fret-cell ${isOpen ? "open-cell" : ""} ${isSelected ? "selected" : ""}`} onClick={() => updateString(stringIndex, fret)}>
          {isSelected && <span className="fret-dot">{isOpen ? "O" : fret}</span>}
          {isMuted && <span className="fret-dot muted-dot">×</span>}
          {!isSelected && markers.has(fret) && stringIndex === 2 && <span className="fret-marker" />}
        </button>;
      })}
      <button className={`mute-button ${frets[stringIndex] === "muted" ? "muted" : ""}`} aria-label={`${frets[stringIndex] === "muted" ? "Unmute" : "Mute"} ${name} string`} onClick={() => { const next = [...frets]; next[stringIndex] = next[stringIndex] === "muted" ? null : "muted"; onChange(next); }}>{frets[stringIndex] === "muted" ? "×" : "·"}</button>
    </div>)}</div>
    <div className="fret-caption"><span>OPEN</span><span>24TH FRET</span></div>
  </div>;
}

function ShapeEditor({ selected, frets, setFrets, onAddToProgression, embedded = false }) {
  const detected = useMemo(() => detectChord(frets), [frets]);
  const isEdited = selected.frets.some((fret, index) => fret !== frets[index]);
  const canMove = (amount) => { const activeFrets = frets.filter((fret) => typeof fret === "number"); return activeFrets.length > 0 && activeFrets.every((fret) => fret + amount >= 0 && fret + amount <= MAX_FRET); };
  const moveShape = (amount) => { if (canMove(amount)) setFrets(frets.map((fret) => typeof fret === "number" ? fret + amount : fret)); };
  return <div className={`${embedded ? "shape-editor" : "workspace shape-editor"}`}>
    <section className="analysis-card"><div className="analysis-main"><div className="analysis-title"><span className="eyebrow-dot" style={{ background: selected.color }} /><span>DETECTED VOICING</span>{isEdited && <span className="edited-pill">EDITED</span>}</div><div className="chord-name">{isEdited ? detected.label : `${selected.root}${selected.suffix}`}</div><div className="chord-meta"><span>{isEdited ? detected.detail : selected.qualityLabel}</span><span className="metadata-separator">•</span><span>{isEdited ? "Live analysis" : selected.shapeName}</span></div></div><div className="analysis-side"><div className="analysis-note"><span>ROOT</span><strong>{isEdited ? detected.label.split("/")[0].replace(/m(aj7|7)?$/, "") : selected.root}</strong></div><div className="analysis-note"><span>STRINGS</span><strong>{frets.filter((fret) => fret !== null && fret !== "muted").length}<small> / 6</small></strong></div></div></section>
    <section className="editor-card"><div className="editor-heading"><div><p className="kicker">INTERACTIVE FRETBOARD</p><h2>Standard tuning <span>E A D G B E</span></h2></div><div className="editor-actions"><div className="move-actions" aria-label="Move chord shape"><button className="move-button" aria-label="Move chord shape left one fret" disabled={!canMove(-1)} onClick={() => moveShape(-1)}>←</button><button className="move-button" aria-label="Move chord shape right one fret" disabled={!canMove(1)} onClick={() => moveShape(1)}>→</button></div><button className="ghost-button" onClick={() => setFrets(selected.frets)}><Icon>↺</Icon> Reset</button><button className="play-button" onClick={() => playVoicing(frets, "individual")}><Icon>▶</Icon> Play notes</button><button className="play-button primary" onClick={() => playVoicing(frets, "strum")}><Icon>♬</Icon> Strum chord</button><button className="ghost-button add-progress-button" onClick={onAddToProgression}><Icon>＋</Icon> Add to progression</button></div></div><Fretboard key={selected.instanceId ?? selected.id} frets={frets} onChange={setFrets} /><div className="editor-footer"><span><i className="legend-dot" /> Click: add · click again: mute · click again: clear</span><span><i className="legend-open" /> Open string</span><span><i className="legend-mute">×</i> Mute shortcut</span></div></section>
  </div>;
}

function LibraryPage({ selected, frets, setFrets, setSelected, addToProgression }) {
  return <div className="app-grid"><Library selectedId={selected.id} selected={selected} frets={frets} onSelect={(entry) => { setSelected(entry); setFrets(entry.frets); }} /><ShapeEditor selected={selected} frets={frets} setFrets={setFrets} onAddToProgression={() => addToProgression({ ...selected, frets: [...frets] })} /></div>;
}

const PROGRESSION_TEMPLATES = [
  { id: "pop", name: "I – V – vi – IV", key: "C major", description: "Familiar pop progression.", ids: ["C-6-major", "G-6-major", "A-6-minor", "F-6-major"] },
  { id: "one-four-five", name: "I – IV – V", key: "E major", description: "A classic blues and rock foundation.", ids: ["E-6-major", "A-6-major", "B-6-major"] },
  { id: "jazz", name: "ii – V – I", key: "C major", description: "A foundational jazz cadence.", ids: ["D-6-minor", "G-6-dominant7", "C-6-major"] },
  { id: "blues", name: "12-bar blues", key: "E major", description: "Three dominant chords, twelve bars.", ids: ["E-6-dominant7", "A-6-dominant7", "E-6-dominant7", "E-6-dominant7", "A-6-dominant7", "A-6-dominant7", "E-6-dominant7", "E-6-dominant7", "B-6-dominant7", "A-6-dominant7", "E-6-dominant7", "B-6-dominant7"] },
  { id: "doo-wop", name: "I – vi – IV – V", key: "C major", description: "50s doo-wop and classic pop.", ids: ["C-6-major", "A-6-minor", "F-6-major", "G-6-major"] },
  { id: "minor-first-pop", name: "vi – IV – I – V", key: "C major", description: "Minor-first modern pop loop.", ids: ["A-6-minor", "F-6-major", "C-6-major", "G-6-major"] },
  { id: "canon", name: "I – V – vi – iii – IV – I – IV – V", key: "C major", description: "Pachelbel / Canon progression.", ids: ["C-6-major", "G-6-major", "A-6-minor", "E-6-minor", "F-6-major", "C-6-major", "F-6-major", "G-6-major"] },
  { id: "turnaround", name: "I – vi – ii – V", key: "C major", description: "Classic jazz and pop turnaround.", ids: ["C-6-major", "A-6-minor", "D-6-minor", "G-6-major"] },
  { id: "minor-rock", name: "i – VII – VI – VII", key: "A minor", description: "Minor-key rock and pop loop.", ids: ["A-6-minor", "G-6-major", "F-6-major", "G-6-major"] },
  { id: "minor-pop", name: "i – VI – III – VII", key: "A minor", description: "A staple minor-key pop progression.", ids: ["A-6-minor", "F-6-major", "C-6-major", "G-6-major"] },
  { id: "rock-country", name: "I – V – IV", key: "E major", description: "Straight-ahead rock and country.", ids: ["E-6-major", "B-6-major", "A-6-major"] },
  { id: "andalusian", name: "i – VII – VI – V", key: "A minor", description: "Andalusian / flamenco cadence.", ids: ["A-6-minor", "G-6-major", "F-6-major", "E-6-major"] },
];

function ProgressionCard({ chord, index, onChange, onPlay, onRemove, onDuplicate, onMove }) {
  const detected = useMemo(() => detectChord(chord.frets), [chord.frets]);
  const hasNotes = activeNotes(chord.frets).length > 0;
  return <article className="progression-chord-card"><div className="progression-card-head"><div className="step-number">{String(index + 1).padStart(2, "0")}</div><div className="progression-card-title"><p className="kicker">CHORD {String(index + 1).padStart(2, "0")}</p><h2>{detected.label === "No notes" ? "Empty chord" : detected.label}</h2><span>{detected.label === "No notes" ? "Start placing notes on the fretboard" : detected.detail}</span></div><div className="card-actions"><button className="card-icon-button" aria-label="Move chord up" disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button><button className="card-icon-button" aria-label="Move chord down" disabled={false} onClick={() => onMove(index, 1)}>↓</button><button className="card-text-button" onClick={onDuplicate}>Duplicate</button><button className="card-text-button danger" onClick={onRemove}>Remove</button><button className="play-button primary card-play" disabled={!hasNotes} onClick={onPlay}><Icon>▶</Icon> Play chord</button></div></div><Fretboard key={chord.instanceId} frets={chord.frets} onChange={(next) => onChange({ ...chord, frets: next })} /></article>;
}

function ProgressionPage({ progression, setProgression, onOpenLibrary }) {
  const [bpm, setBpm] = useState(160);
  const hasPlayableChords = progression.some((chord) => activeNotes(chord.frets).length > 0);
  const addEmpty = () => setProgression((current) => [...current, makeEmptyChord()]);
  const updateChord = (index, next) => setProgression((current) => current.map((chord, chordIndex) => chordIndex === index ? next : chord));
  const removeChord = (index) => setProgression((current) => current.filter((_, chordIndex) => chordIndex !== index));
  const duplicateChord = (index) => setProgression((current) => { const copy = makeProgressionChord(current[index]); return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]; });
  const moveChord = (index, amount) => setProgression((current) => { const target = index + amount; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const loadTemplate = (template) => setProgression(template.ids.map((id) => makeProgressionChord(LIBRARY.find((entry) => entry.id === id))));
  return <main className="progression-page"><div className="progression-hero"><div><p className="kicker">02 / COMPOSE</p><h1>Build a progression.</h1><p>Stack chord shapes, edit each voicing, and hear the movement as a single musical idea.</p></div><div className="progression-hero-mark">{[0, 1, 2, 3].map((item) => <span key={item} style={{ height: `${28 + item * 16}px` }} />)}</div></div>
    <section className="template-section"><div className="section-heading"><div><p className="kicker">START WITH A TEMPLATE</p><h2>Common progressions</h2></div><span>LOAD A PRESET, THEN MAKE IT YOURS</span></div><div className="template-grid">{PROGRESSION_TEMPLATES.map((template) => <button className="template-card" key={template.id} onClick={() => loadTemplate(template)}><span className="template-key">{template.key}</span><strong>{template.name}</strong><small>{template.description}</small><Icon>↗</Icon></button>)}</div></section>
    <section className="builder-section"><div className="builder-toolbar"><div><p className="kicker">YOUR PROGRESSION</p><h2>{progression.length ? `${progression.length} chord${progression.length === 1 ? "" : "s"}` : "An empty canvas"}</h2></div><div className="builder-controls"><label className="tempo-control"><span>BPM</span><input type="number" min="40" max="180" value={bpm} onChange={(event) => setBpm(Number(event.target.value) || 72)} /></label><button className="ghost-button" onClick={addEmpty}><Icon>＋</Icon> Add empty chord</button><button className="play-button primary" disabled={!hasPlayableChords} onClick={() => playProgression(progression, bpm)}><Icon>♬</Icon> Play all</button></div></div>
      {!progression.length ? <div className="empty-progression"><div className="empty-orbit">＋</div><h3>Start from silence.</h3><p>Add an empty chord to build from the fretboard, or load a common progression above.</p><div><button className="play-button primary" onClick={addEmpty}>＋ Add first chord</button><button className="ghost-button" onClick={onOpenLibrary}>Browse chord library</button></div></div> : <div className="progression-list">{progression.map((chord, index) => <ProgressionCard key={chord.instanceId} chord={chord} index={index} onChange={(next) => updateChord(index, next)} onPlay={() => playVoicing(chord.frets, "strum")} onRemove={() => removeChord(index)} onDuplicate={() => duplicateChord(index)} onMove={moveChord} />)}<button className="add-row-button" onClick={addEmpty}><span>＋</span> Add another chord row</button></div>}
    </section>
  </main>;
}

function ProgressionStripLegacy({ progression, activeSlotId, onSelect, onRemove }) {
  return <div className="composer-strip"><div className="strip-label"><span className="kicker">YOUR PROGRESSION</span><span>{progression.length ? `${progression.length} STEP${progression.length === 1 ? "" : "S"}` : "EMPTY"}</span></div><div className="strip-steps">{progression.length ? progression.map((chord, index) => { const analysis = detectChord(chord.frets); return <div className={`strip-step-shell ${activeSlotId === chord.instanceId ? "active" : ""}`} key={chord.instanceId}><button className="strip-step" onClick={() => onSelect(chord)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{analysis.label === "No notes" ? "Empty" : analysis.label}</strong></button><button className="strip-remove" aria-label={`Remove chord ${index + 1}`} onClick={() => onRemove(chord.instanceId)}>×</button></div>; }) : <div className="strip-empty"><span>＋</span> Add a chord below to start building</div>}<button className="strip-add" onClick={() => onSelect(null)}>＋</button></div></div>;
}

function ProgressionStrip({ progression, activeSlotId, onSelect, onRemove }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dropChord = (targetId) => {
    if (!draggingId || draggingId === targetId) return;
    const fromIndex = progression.findIndex((chord) => chord.instanceId === draggingId);
    const toIndex = progression.findIndex((chord) => chord.instanceId === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...progression];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onSelect({ reorder: next });
  };
  return <div className="composer-strip"><div className="strip-label"><span className="kicker">YOUR PROGRESSION</span><span>{progression.length ? progression.length + " STEP" + (progression.length === 1 ? "" : "S") : "EMPTY"}</span></div><div className="strip-steps">{progression.length ? progression.map((chord, index) => { const analysis = detectChord(chord.frets); const isDragging = draggingId === chord.instanceId; const isOver = overId === chord.instanceId && draggingId !== chord.instanceId; return <div className={"strip-step-shell " + (activeSlotId === chord.instanceId ? "active " : "") + (isDragging ? "dragging " : "") + (isOver ? "drop-target" : "")} key={chord.instanceId} draggable onDragStart={() => { setDraggingId(chord.instanceId); setOverId(null); }} onDragOver={(event) => { event.preventDefault(); if (draggingId !== chord.instanceId) setOverId(chord.instanceId); }} onDrop={(event) => { event.preventDefault(); dropChord(chord.instanceId); setDraggingId(null); setOverId(null); }} onDragEnd={() => { setDraggingId(null); setOverId(null); }}><button className="strip-step" onClick={() => onSelect(chord)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{analysis.label === "No notes" ? "Empty" : analysis.label}</strong></button><button className="strip-remove" aria-label={"Remove chord " + (index + 1)} onClick={() => onRemove(chord.instanceId)}>×</button></div>; }) : <div className="strip-empty"><span>＋</span> Add a chord below to start building</div>}<button className="strip-add" onClick={() => onSelect(null)}>＋</button></div></div>;
}

function ComposerPage({ selected, frets, setFrets, setSelected, progression, setProgression, activeSlotId, setActiveSlotId, onOpenLibrary }) {
  const [bpm, setBpm] = useState(160);
  const hasPlayableChords = progression.some((chord) => activeNotes(chord.frets).length > 0);
  const activeIndex = progression.findIndex((chord) => chord.instanceId === activeSlotId);
  const selectLibraryShape = (entry) => { setActiveSlotId(null); setSelected(entry); setFrets([...entry.frets]); };
  const selectSlot = (slot) => { if (slot?.reorder) { setProgression(slot.reorder); return; } if (!slot) { addEmpty(); return; } setActiveSlotId(slot.instanceId); setSelected(slot); setFrets([...slot.frets]); };
  const updateActiveFrets = (next) => { setFrets(next); if (activeSlotId) setProgression((current) => current.map((chord) => chord.instanceId === activeSlotId ? { ...chord, frets: [...next] } : chord)); };
  const addEmpty = () => { const empty = makeEmptyChord(); setProgression((current) => [...current, empty]); setActiveSlotId(empty.instanceId); setSelected(empty); setFrets([...empty.frets]); };
  const addCurrent = () => { const slot = makeProgressionChord({ ...selected, frets: [...frets] }); setProgression((current) => { if (activeIndex < 0) return [...current, slot]; return [...current.slice(0, activeIndex + 1), slot, ...current.slice(activeIndex + 1)]; }); setActiveSlotId(slot.instanceId); setSelected(slot); setFrets([...slot.frets]); };
  const removeSlot = (slotId) => { const remaining = progression.filter((chord) => chord.instanceId !== slotId); setProgression(remaining); if (slotId === activeSlotId) { const next = remaining[Math.max(0, activeIndex - 1)]; if (next) selectSlot(next); else { setActiveSlotId(null); setSelected(LIBRARY.find((entry) => entry.id === "E-6-minor")); setFrets(LIBRARY.find((entry) => entry.id === "E-6-minor").frets); } } };
  const duplicateSlot = () => { if (activeIndex < 0) return; const copy = makeProgressionChord(progression[activeIndex]); setProgression((current) => [...current.slice(0, activeIndex + 1), copy, ...current.slice(activeIndex + 1)]); setActiveSlotId(copy.instanceId); setSelected(copy); setFrets([...copy.frets]); };
  const moveActive = (amount) => { if (activeIndex < 0) return; const target = activeIndex + amount; if (target < 0 || target >= progression.length) return; const next = [...progression]; [next[activeIndex], next[target]] = [next[target], next[activeIndex]]; setProgression(next); };
  const loadTemplate = (template) => { const chords = template.ids.map((id) => makeProgressionChord(LIBRARY.find((entry) => entry.id === id))); setProgression(chords); setActiveSlotId(chords[0].instanceId); setSelected(chords[0]); setFrets([...chords[0].frets]); };
  return <div className="app-grid composer-grid"><Library selectedId={selected.id} selected={selected} frets={frets} onSelect={selectLibraryShape} /><main className="composer-workspace"><div className="composer-heading"><div><h1>One fretboard.<br /><em>Many possibilities.</em></h1></div><p>Build your progression one chord at a time. Select a step to edit it, or add a new shape from the library.</p></div><ProgressionStrip progression={progression} activeSlotId={activeSlotId} onSelect={selectSlot} onRemove={removeSlot} /><div className="composer-toolbar"><div><p className="kicker">COMMON STARTING POINTS</p><span>Load a template, then make it yours.</span></div><label className="template-select"><span>CHOOSE PROGRESSION</span><select aria-label="Choose a common chord progression" value="" onChange={(event) => { const template = PROGRESSION_TEMPLATES.find((item) => item.id === event.target.value); if (template) loadTemplate(template); }}><option value="">Select a progression…</option>{PROGRESSION_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.description}</option>)}</select></label></div><div className="composer-builder-controls"><label className="tempo-control"><span>BPM</span><input type="number" min="40" max="180" value={bpm} onChange={(event) => setBpm(Number(event.target.value) || 72)} /></label><button className="play-button primary" disabled={!hasPlayableChords} onClick={() => playProgression(progression, bpm)}><Icon>♬</Icon> Play all</button></div><ShapeEditor embedded selected={selected} frets={frets} setFrets={updateActiveFrets} onAddToProgression={addCurrent} /><p className="composer-hint">Tip: the library on the left stays available while you compose. Selecting a library shape edits the shared fretboard; use “Add to progression” to save it as a new step.</p></main></div>;
}

function getInitialThemeMode() {
  if (typeof window === "undefined") return "system";
  try {
    const saved = window.localStorage.getItem("chord-atlas-theme");
    return ["system", "light", "dark"].includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function App() {
  const [page, setPage] = useState("composer");
  const [selected, setSelected] = useState(LIBRARY.find((entry) => entry.id === "E-6-minor"));
  const [frets, setFrets] = useState(selected.frets);
  const [progression, setProgression] = useState([]);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [systemTheme, setSystemTheme] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const activeTheme = themeMode === "system" ? systemTheme : themeMode;
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemTheme(media.matches ? "light" : "dark");
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    try {
      if (themeMode === "system") window.localStorage.removeItem("chord-atlas-theme");
      else window.localStorage.setItem("chord-atlas-theme", themeMode);
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }, [activeTheme, themeMode]);
  const addToProgression = (entry) => { const slot = makeProgressionChord(entry); setProgression((current) => [...current, slot]); setActiveSlotId(slot.instanceId); setSelected(slot); setFrets([...slot.frets]); setPage("composer"); };
  return <div className="app-shell"><Header page={page} onNavigate={setPage} themeMode={themeMode} onThemeChange={setThemeMode} />{page === "library" ? <LibraryPage selected={selected} frets={frets} setFrets={setFrets} setSelected={setSelected} addToProgression={addToProgression} /> : <ComposerPage selected={selected} frets={frets} setFrets={setFrets} setSelected={setSelected} progression={progression} setProgression={setProgression} activeSlotId={activeSlotId} setActiveSlotId={setActiveSlotId} onOpenLibrary={() => setPage("library")} />}</div>;
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
