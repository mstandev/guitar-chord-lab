# Chord Atlas

The first interactive slice of a guitar chord visualizer.

## Included

- Standard E tuning and a six-string, 24-fret editing surface with horizontal scrolling
- 180 starter voicings: all 12 roots across Major, Minor, Dominant 7, Major 7, and Minor 7, rooted from the 6th, 5th, or 4th string
- Familiar open-position shapes for E, A, and D, plus movable E-, A-, and D-shape voicings
- Live naming for the five starter chord families, including slash-chord bass notes
- Three-state string editing: note, muted, and empty; click the same fret to cycle through them
- Separate Chord Library and Progression Builder tabs
- Empty progression building, common progression templates, reorder/duplicate/remove controls, and Play All at a selectable BPM
- Note-by-note and strummed playback using the browser Web Audio API
- Chord diagram and interval anatomy view

## Run it

```bash
npm install
npm run dev
```

The library is currently defined at the top of `src/main.jsx`. `SHAPE_TEMPLATES`
contains the three root-string systems and `QUALITIES` contains the chord
formulas. `PROGRESSION_TEMPLATES` contains the starter progression presets.
Keeping those separate makes it straightforward to add alternate tunings,
additional qualities, or user persistence next.
