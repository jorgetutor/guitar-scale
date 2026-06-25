export const NOTE_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
export const NOTE_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'] as const;

const FLAT_KEY_PCS = new Set([5,10,3,8,1,6]); // F Bb Eb Ab Db Gb

export function noteName(pc: number, rootPc: number): string {
  const list = FLAT_KEY_PCS.has(rootPc) ? NOTE_FLAT : NOTE_SHARP;
  return list[((pc % 12) + 12) % 12];
}

export function noteNamesFromRoot(root: number): string[] {
  return Array.from({length: 12}, (_, i) => noteName((root + i) % 12, root));
}

export const KEY_NAMES = Array.from({length: 12}, (_, i) =>
  FLAT_KEY_PCS.has(i) ? NOTE_FLAT[i] : NOTE_SHARP[i]
);

export const SCALES: Record<string, readonly number[]> = {
  'Major':              [0,2,4,5,7,9,11],
  'Natural Minor':      [0,2,3,5,7,8,10],
  'Harmonic Minor':     [0,2,3,5,7,8,11],
  'Melodic Minor':      [0,2,3,5,7,9,11],
  'Dorian':             [0,2,3,5,7,9,10],
  'Phrygian':           [0,1,3,5,7,8,10],
  'Lydian':             [0,2,4,6,7,9,11],
  'Mixolydian':         [0,2,4,5,7,9,10],
  'Locrian':            [0,1,3,5,6,8,10],
  'Major Pentatonic':   [0,2,4,7,9],
  'Minor Pentatonic':   [0,3,5,7,10],
  'Blues':              [0,3,5,6,7,10],
  'Chromatic':          [0,1,2,3,4,5,6,7,8,9,10,11],
  'Whole Tone':         [0,2,4,6,8,10],
  'Diminished (H-W)':   [0,1,3,4,6,7,9,10],
  'Diminished (W-H)':   [0,2,3,5,6,8,9,11],
};

export const INTERVAL_NAMES = [
  'R','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7',
] as const;

export function intervalName(semitones: number): string {
  return INTERVAL_NAMES[((semitones % 12) + 12) % 12];
}

const SCALE_FINGERPRINTS = new Map(
  Object.entries(SCALES).map(([name, iv]) => [
    [...iv].sort((a, b) => a - b).join(','),
    name,
  ])
);

export function matchScale(intervals: readonly number[]): string {
  const key = [...intervals].sort((a, b) => a - b).join(',');
  return SCALE_FINGERPRINTS.get(key) ?? 'Custom';
}

export type Step = { label: string; semitones: number };

export function consecutiveSteps(intervals: readonly number[]): Step[] {
  if (intervals.length < 2) return [];
  const s = [...intervals].sort((a, b) => a - b);
  return s.map((cur, i) => {
    const next = s[(i + 1) % s.length];
    const st = i < s.length - 1 ? next - cur : (12 - cur) + next;
    const label = st === 1 ? 'H' : st === 2 ? 'W' : st === 3 ? 'W+H' : `${st}`;
    return { label, semitones: st };
  });
}

export function fretPC(openPC: number, fret: number): number {
  return (openPC + fret) % 12;
}

export function defaultTuning(n: number): number[] {
  // Standard 6-string base [E A D G B e], extend lower by P4 for more strings
  const base = [4, 9, 2, 7, 11, 4];
  if (n <= 6) return base.slice(base.length - n);
  const result = [...base];
  while (result.length < n) result.unshift((result[0] - 5 + 12) % 12);
  return result;
}

// ── Chord Theory ─────────────────────────────────────────────────────────────

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'sus2' | 'sus4';

export interface Chord {
  degree: number;
  rootPc: number;
  notes: number[];
  relIntervals: number[];
  quality: ChordQuality;
  roman: string;
}

export function chordQuality(relIntervals: readonly number[]): ChordQuality | null {
  const a = relIntervals[1], b = relIntervals[2];
  if (a === 4 && b === 7) return 'major';
  if (a === 3 && b === 7) return 'minor';
  if (a === 3 && b === 6) return 'diminished';
  if (a === 4 && b === 8) return 'augmented';
  if (a === 2 && b === 7) return 'sus2';
  if (a === 5 && b === 7) return 'sus4';
  return null;
}

const ROMAN_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function deriveScaleChords(root: number, intervals: readonly number[]): Chord[] {
  const sorted = [...intervals].sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 3 || n > 11) return [];

  const chords: Chord[] = [];
  for (let i = 0; i < n; i++) {
    const absI  = (root + sorted[i])           % 12;
    const absI2 = (root + sorted[(i + 2) % n]) % 12;
    const absI4 = (root + sorted[(i + 4) % n]) % 12;

    if (new Set([absI, absI2, absI4]).size < 3) continue;

    const relI2 = ((absI2 - absI) + 12) % 12;
    const relI4 = ((absI4 - absI) + 12) % 12;
    const relIntervals = [0, relI2, relI4].sort((a, b) => a - b);

    const quality = chordQuality(relIntervals);
    if (quality === null) continue;

    const base = ROMAN_UPPER[i] ?? `${i + 1}`;
    let roman: string;
    switch (quality) {
      case 'major':      roman = base; break;
      case 'augmented':  roman = `${base}+`; break;
      case 'minor':      roman = base.toLowerCase(); break;
      case 'diminished': roman = `${base.toLowerCase()}°`; break;
      default:           roman = base;
    }

    chords.push({ degree: i, rootPc: absI, notes: [absI, absI2, absI4], relIntervals, quality, roman });
  }
  return chords;
}
