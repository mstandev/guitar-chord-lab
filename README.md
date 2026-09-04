# Chord Atlas

Chord Atlas is a composer-first guitar chord visualizer. It combines a chord
library, an interactive fretboard, chord analysis, and progression building in
one workspace.

## Current application

- Composer is the only application screen; the chord library stays embedded in
  the left column for quick access while composing.
- Standard E tuning with a six-string, 24-fret fretboard. Open strings are fret
  0, the high E is shown at the top, and the low E at the bottom.
- Horizontal fretboard scrolling is available for higher positions, with the
  scrollbar hidden for a cleaner interface. The library panel also scrolls
  vertically when its content exceeds the viewport.
- 324 generated library voicings: 12 roots across Major, Minor, Dominant 7,
  Major 7, and Minor 7, rooted from the 6th, 5th, or 4th string, with compact
  shell alternatives where distinct.
- Common open-position and movable E-, A-, and D-shape voicings.
- Live chord naming for recognized shapes, including slash-chord bass notes,
  plus custom-voicing feedback when edited notes do not match a known formula.
- Voicing details show the selected chord tones, including the actual root,
  3rd, 5th, and seventh when present.
- Fretboard editing cycles a string through note, muted, and empty states when
  the same fret is clicked repeatedly. A mute shortcut is also available.
- Move the current shape left or right by one fret, reset it, play notes one at
  a time, strum the chord, or add it to the progression.
- Shared-fretboard progression workflow with a progression strip, drag-to-
  reorder, remove, duplicate, and add controls.
- Common progression templates include I–V–vi–IV, I–IV–V, ii–V–I, 12-bar
  blues, doo-wop, minor-key pop and rock, Pachelbel/Canon, jazz turnarounds,
  and Andalusian/flamenco progressions.
- Play the progression at a selectable BPM. The default BPM is 160.
- System, light, and dark themes with manual theme selection.
- Browser Web Audio playback for individual notes, strummed chords, and full
  progressions.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Project structure

The main chord and interaction model is in `src/main.jsx`:

- `QUALITIES` defines the five supported chord families and their intervals.
- `SHAPE_TEMPLATES` defines the primary 6th-, 5th-, and 4th-string voicings.
- `SHELL_SHAPES` defines the compact alternate voicings.
- `PROGRESSION_TEMPLATES` defines the common starting progressions.

Visual styling and theme overrides are in `src/styles.css`. The favicon is in
`public/favicon.png`.

## Hosted version

The public GitHub Pages build is available at:

<https://mstandev.github.io/guitar-chord-lab/>
