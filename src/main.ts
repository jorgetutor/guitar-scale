import './style.css';
import {
  noteName, noteNamesFromRoot, KEY_NAMES, SCALES, INTERVAL_NAMES,
  matchScale, consecutiveSteps, fretPC, defaultTuning,
} from './theory';

// ── State ────────────────────────────────────────────────────────────────────

interface AppState {
  root: number;
  intervals: number[];
  frets: number;
  strings: number;
  tuning: number[];
}

const STORAGE_KEY = 'guitar-scales-state';

function defaultState(): AppState {
  return { root: 0, intervals: [...SCALES['Major']], frets: 24, strings: 6, tuning: defaultTuning(6) };
}

function saveState(s: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw) as Partial<AppState>;
    const strings = typeof p.strings === 'number' && Number.isInteger(p.strings) ? clamp(p.strings, 4, 8) : 6;
    const intervals = Array.isArray(p.intervals)
      ? (p.intervals as number[]).filter(n => Number.isInteger(n) && n >= 0 && n < 12)
      : [...SCALES['Major']];
    if (!intervals.includes(0)) intervals.unshift(0);
    const base = defaultTuning(strings);
    const tuning = base.map((def, i) => {
      const v = Array.isArray(p.tuning) ? (p.tuning as number[])[i] : undefined;
      return typeof v === 'number' && Number.isInteger(v) ? ((v + 12) % 12) : def;
    });
    return {
      root:      typeof p.root === 'number' && Number.isInteger(p.root) ? ((p.root % 12) + 12) % 12 : 0,
      intervals: intervals.sort((a, b) => a - b),
      frets:     typeof p.frets === 'number' && Number.isInteger(p.frets) ? clamp(p.frets, 1, 36) : 24,
      strings,
      tuning,
    };
  } catch {
    return defaultState();
  }
}

let state: AppState = loadState();

// ── UI state (not persisted) ─────────────────────────────────────────────────

let fretboardZoomed = false;

// ── Render ───────────────────────────────────────────────────────────────────

function render(): void {
  saveState(state);
  document.getElementById('app')!.innerHTML = buildApp(state);
  bindEvents();
}

function buildApp(s: AppState): string {
  return `
    <div class="app-container">
      <div class="app-header">
        <img src="favicon.svg" class="app-icon" alt="" width="48" height="48"/>
        <h1>Guitar Scale Visualizer</h1>
      </div>
      ${buildFretboardSection(s)}
      ${buildScaleNotes(s)}
      <footer class="app-footer">
        ${buildLegend()}
        ${buildScaleSimilarityTable(s)}
        <div class="footer-credit">By <a href="https://jorgetutor.net" target="_blank" rel="noopener">jorgetutor.net</a></div>
      </footer>
    </div>
  `;
}

// ── Scale Notes ───────────────────────────────────────────────────────────────

function buildScaleNotes(s: AppState): string {
  const scaleName = matchScale(s.intervals);
  const active = new Set(s.intervals);
  const names = noteNamesFromRoot(s.root);

  const sorted = [...s.intervals].sort((a, b) => a - b);
  const steps = consecutiveSteps(s.intervals);
  const stepBefore = new Map<number, string>();
  for (let i = 1; i < sorted.length; i++) {
    stepBefore.set(sorted[i], steps[i - 1].label);
  }

  const keyOpts = KEY_NAMES.map((n, i) =>
    `<option value="${i}"${i === s.root ? ' selected' : ''}>${n}</option>`
  ).join('');

  const scaleOpts = [
    scaleName === 'Custom' ? '<option value="Custom" selected>Custom</option>' : '',
    ...Object.keys(SCALES).map(name =>
      `<option value="${name}"${name === scaleName ? ' selected' : ''}>${name}</option>`
    ),
  ].join('');

  const boxes = Array.from({length: 12}, (_, i) => {
    const isActive = active.has(i);
    const stepLabel = isActive && i !== 0 ? stepBefore.get(i) : undefined;
    return `
      <div class="note-check${i === 0 ? ' root' : ''}">
        <input type="checkbox" id="n${i}" data-iv="${i}"${isActive ? ' checked' : ''}${i === 0 ? ' disabled' : ''}/>
        <label for="n${i}">
          <span class="note-name">${names[i]}</span>
          <span class="interval-label">${INTERVAL_NAMES[i]}</span>
        </label>
        ${stepLabel !== undefined ? `<span class="step-size">${stepLabel}</span>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section class="scale-notes">
      <div class="scale-notes-row">
        <div class="control-group">
          <label for="key-sel">Key</label>
          <div class="ctrl-stepper">
            <button id="key-dec" class="ctrl-btn">−</button>
            <select id="key-sel">${keyOpts}</select>
            <button id="key-inc" class="ctrl-btn">+</button>
          </div>
        </div>
        <div class="control-group">
          <label for="scale-sel">Scale</label>
          <select id="scale-sel">${scaleOpts}</select>
        </div>
        <div class="scale-notes-sep"></div>
        <div class="scale-notes-checks">
          <h2>Scale Notes</h2>
          <div class="note-checkboxes">${boxes}</div>
        </div>
      </div>
    </section>
  `;
}

// ── Fretboard SVG ─────────────────────────────────────────────────────────────

const FRET_W_MAX = 60; // first fret width (widest, near nut)
const FRET_W_MIN = 30; // last fret width (narrowest, near body)
const STR_SP   = 26;
const L_PAD    = 68;
const NUT_W    = 6;
const TOP_PAD  = 36;
const BOT_PAD  = 36;
const NOTE_R   = 10;

const ICON_EXPAND  = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 1 1 1 1 5"/><polyline points="11 1 15 1 15 5"/><polyline points="1 11 1 15 5 15"/><polyline points="15 11 15 15 11 15"/></svg>`;
const ICON_COMPRESS = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 5 5 5 5 1"/><polyline points="15 5 11 5 11 1"/><polyline points="5 15 5 11 1 11"/><polyline points="11 15 11 11 15 11"/></svg>`;

function buildFretboardSection(s: AppState): string {
  const zoomed = fretboardZoomed;
  return `
    <section class="fretboard-section${zoomed ? ' fretboard-zoomed' : ''}">
      ${zoomed ? '' : buildTuning(s)}
      <div class="fretboard-header">
        <h2>Fretboard</h2>
        <button id="fretboard-zoom" class="zoom-btn" title="${zoomed ? 'Exit fullscreen' : 'Fullscreen'}"><span>Zoom</span>${zoomed ? ICON_COMPRESS : ICON_EXPAND}</button>
      </div>
      <div class="fretboard-scroll">${buildSVG(s)}</div>
    </section>
  `;
}

function buildSVG(s: AppState): string {
  const {root, intervals, frets, strings, tuning} = s;
  const active = new Set(intervals);

  // Precompute cumulative fret bar positions from the nut.
  // Fret widths taper linearly from FRET_W_MAX (near nut) to FRET_W_MIN (near body).
  const cumX: number[] = [0];
  for (let f = 1; f <= frets; f++) {
    const t = frets > 1 ? (f - 1) / (frets - 1) : 0;
    cumX.push(cumX[f - 1] + FRET_W_MAX - (FRET_W_MAX - FRET_W_MIN) * t);
  }

  const W = L_PAD + NUT_W + cumX[frets] + 10;
  const H = TOP_PAD + (strings - 1) * STR_SP + BOT_PAD;

  const sY   = (di: number) => TOP_PAD + di * STR_SP;
  const fX   = (f: number)  => f === 0
    ? L_PAD / 2
    : L_PAD + NUT_W + (cumX[f - 1] + cumX[f]) / 2;
  const barX = (f: number)  => L_PAD + NUT_W + cumX[f];

  const p: string[] = [];

  // Board body
  p.push(`<rect x="${L_PAD+NUT_W}" y="${TOP_PAD-4}" width="${cumX[frets]}" height="${(strings-1)*STR_SP+8}" fill="#3d1c02" rx="2"/>`);

  // Fret bars
  for (let f = 1; f <= frets; f++) {
    p.push(`<line x1="${barX(f)}" y1="${TOP_PAD-4}" x2="${barX(f)}" y2="${TOP_PAD+(strings-1)*STR_SP+4}" stroke="#6b6b6b" stroke-width="1.5"/>`);
  }

  // Nut
  p.push(`<rect x="${L_PAD}" y="${TOP_PAD-5}" width="${NUT_W}" height="${(strings-1)*STR_SP+10}" fill="#ede0c4" rx="1"/>`);

  // Inlay dots
  const midY = TOP_PAD + (strings - 1) * STR_SP / 2;
  const dotOff = Math.max(STR_SP, (strings - 1) * STR_SP / 4);
  for (const f of [3,5,7,9,15,17,19,21]) {
    if (f <= frets) p.push(`<circle cx="${fX(f)}" cy="${midY}" r="3.5" fill="#5c2d0a" opacity="0.55"/>`);
  }
  for (const f of [12,24]) {
    if (f <= frets) {
      p.push(`<circle cx="${fX(f)}" cy="${midY-dotOff}" r="3.5" fill="#5c2d0a" opacity="0.55"/>`);
      p.push(`<circle cx="${fX(f)}" cy="${midY+dotOff}" r="3.5" fill="#5c2d0a" opacity="0.55"/>`);
    }
  }

  // Strings
  for (let di = 0; di < strings; di++) {
    const y  = sY(di);
    const sw = 0.7 + (di / Math.max(strings - 1, 1)) * 1.8;
    p.push(`<line x1="${L_PAD+NUT_W}" y1="${y}" x2="${L_PAD+NUT_W+cumX[frets]}" y2="${y}" stroke="#aaa" stroke-width="${sw}"/>`);
    p.push(`<line x1="${L_PAD/2+6}" y1="${y}" x2="${L_PAD}" y2="${y}" stroke="#aaa" stroke-width="${sw}" stroke-dasharray="3 2"/>`);
  }

  // Note dots
  for (let di = 0; di < strings; di++) {
    const openPC = tuning[strings - 1 - di] ?? 0;
    for (let fret = 0; fret <= frets; fret++) {
      const pc       = fretPC(openPC, fret);
      const interval = ((pc - root) % 12 + 12) % 12;
      if (!active.has(interval)) continue;

      const x      = fX(fret);
      const y      = sY(di);
      const isRoot = interval === 0;
      const fill   = isRoot ? '#fbbf24' : '#22d3ee';
      const tFill  = isRoot ? '#1a1000' : '#002828';
      const nn     = noteName(pc, root);
      const fs     = nn.length > 1 ? 7 : 9;

      p.push(`<circle cx="${x}" cy="${y}" r="${NOTE_R}" fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="1.2"/>`);
      p.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="bold" fill="${tFill}" font-family="monospace">${nn}</text>`);
    }
  }

  // String number + tuning labels left of nut
  for (let di = 0; di < strings; di++) {
    const openPC   = tuning[strings - 1 - di] ?? 0;
    const interval = ((openPC - root) % 12 + 12) % 12;
    const strNum   = di + 1;
    p.push(`<text x="12" y="${sY(di)}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="600" fill="#666" font-family="monospace">${strNum}</text>`);
    if (active.has(interval)) continue;
    const nn = noteName(openPC, root);
    p.push(`<text x="${L_PAD/2}" y="${sY(di)}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#c8c8c8" font-family="monospace">${nn}</text>`);
  }

  // Fret number labels (top and bottom)
  for (const f of [3,5,7,9,12,15,17,19,21,24]) {
    if (f <= frets) {
      p.push(`<text x="${fX(f)}" y="${TOP_PAD-16}" text-anchor="middle" font-size="11" font-weight="600" fill="#999" font-family="monospace">${f}</text>`);
      p.push(`<text x="${fX(f)}" y="${TOP_PAD+(strings-1)*STR_SP+22}" text-anchor="middle" font-size="11" font-weight="600" fill="#999" font-family="monospace">${f}</text>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto">${p.join('')}</svg>`;
}

// ── Tuning Presets ───────────────────────────────────────────────────────────

const TUNING_PRESETS: Record<string, number[]> = {
  'Standard':   [4, 9, 2, 7, 11, 4],   // E  A  D  G  B  e
  'Standard D': [2, 7, 0, 5,  9, 2],   // D  G  C  F  A  d
  'Drop D':     [2, 9, 2, 7, 11, 4],   // D  A  D  G  B  e
  'Drop C':     [0, 7, 0, 5,  9, 2],   // C  G  C  F  A  d
  'Drop B':     [11, 6, 11, 4, 8, 1],  // B  F# B  E  G# C#
  'Drop A':     [9, 4,  9, 2,  6, 11], // A  E  A  D  F# B
};

function matchesPreset(tuning: number[], strings: number, preset: number[]): boolean {
  if (strings < preset.length) return false;
  const overlap = Math.min(strings, preset.length);
  for (let i = 0; i < overlap; i++) {
    if (tuning[strings - 1 - i] !== preset[preset.length - 1 - i]) return false;
  }
  return true;
}

function applyPreset(tuning: number[], strings: number, preset: number[]): number[] {
  const result = [...tuning];
  const overlap = Math.min(strings, preset.length);
  for (let i = 0; i < overlap; i++) {
    result[strings - 1 - i] = preset[preset.length - 1 - i];
  }
  return result;
}

// ── Tuning Controls ──────────────────────────────────────────────────────────

function buildTuning(s: AppState): string {
  const rows = Array.from({length: s.strings}, (_, di) => {
    const tidx = s.strings - 1 - di;
    const pc   = s.tuning[tidx] ?? 4;
    const lbl  = `String ${di + 1}`;
    const opts = KEY_NAMES.map((n, i) =>
      `<option value="${i}"${i === pc ? ' selected' : ''}>${n}</option>`
    ).join('');
    return `
      <div class="tuning-string">
        <label>${lbl}</label>
        <select data-tidx="${tidx}">${opts}</select>
      </div>`;
  }).join('');

  return `
    <div class="tuning-section">
      <div class="tuning-row">
        <div class="tuning-global">
          <span class="tuning-label">Tuning</span>
          <div class="tuning-global-btns">
            <button id="tune-down" title="All strings −1 semitone">↓</button>
            <button id="tune-up"   title="All strings +1 semitone">↑</button>
          </div>
        </div>
        ${rows}
        <div class="tuning-presets">
          ${[['Standard', 'Standard D'], ['Drop D', 'Drop C', 'Drop B', 'Drop A']].map(group => `
            <div class="preset-row">
              ${group.map(name => {
                const active = matchesPreset(s.tuning, s.strings, TUNING_PRESETS[name]);
                return `<button class="preset-btn${active ? ' active' : ''}" data-preset="${name}">${name}</button>`;
              }).join('')}
            </div>`).join('')}
        </div>
        <div class="tuning-fretboard-opts">
          <div class="control-group">
            <label for="frets-in">Frets</label>
            <div class="ctrl-stepper">
              <button id="frets-dec" class="ctrl-btn">−</button>
              <input type="number" id="frets-in" value="${s.frets}" min="1" max="36"/>
              <button id="frets-inc" class="ctrl-btn">+</button>
            </div>
          </div>
          <div class="control-group">
            <label for="strings-in">Strings</label>
            <div class="ctrl-stepper">
              <button id="strings-dec" class="ctrl-btn">−</button>
              <input type="number" id="strings-in" value="${s.strings}" min="4" max="8"/>
              <button id="strings-inc" class="ctrl-btn">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Scale Similarity Table ────────────────────────────────────────────────────

function buildScaleSimilarityTable(s: AppState): string {
  const activeSet = new Set(s.intervals);
  const currentScale = matchScale(s.intervals);

  const headerCells = INTERVAL_NAMES.map((name, i) => {
    const cls = i === 0 ? ' col-root' : activeSet.has(i) ? ' col-active' : '';
    return `<th class="sct-ih${cls}">${name}</th>`;
  }).join('');

  const rows = Object.entries(SCALES).map(([name, intervals]) => {
    const ivSet = new Set(intervals);
    const isCurrent = name === currentScale;

    const cells = Array.from({length: 12}, (_, i) => {
      const present = ivSet.has(i);
      if (!present) return `<td class="sct-cell"></td>`;
      const cls = i === 0 ? 'sct-root' : activeSet.has(i) ? 'sct-match' : 'sct-present';
      return `<td class="sct-cell ${cls}">●</td>`;
    }).join('');

    return `<tr class="sct-row${isCurrent ? ' sct-current' : ''}">
      <th class="sct-sh">${name}</th>${cells}
    </tr>`;
  }).join('');

  return `
    <div class="scale-compare">
      <h3>Scale Similarities</h3>
      <div class="sct-wrap">
        <table class="sct">
          <thead><tr><th class="sct-corner"></th>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Interval Legend ───────────────────────────────────────────────────────────

const LEGEND_ENTRIES: readonly [string, string][] = [
  ['R',  'Root'],
  ['m2', 'minor 2nd'],
  ['M2', 'Major 2nd'],
  ['m3', 'minor 3rd'],
  ['M3', 'Major 3rd'],
  ['P4', 'Perfect 4th'],
  ['TT', 'Tritone'],
  ['P5', 'Perfect 5th'],
  ['m6', 'minor 6th'],
  ['M6', 'Major 6th'],
  ['m7', 'minor 7th'],
  ['M7', 'Major 7th'],
];

function buildLegend(): string {
  const items = LEGEND_ENTRIES.map(([abbr, name], i) =>
    `<span class="legend-item${i === 0 ? ' legend-root' : ''}">` +
    `<span class="legend-abbr">${abbr}</span>` +
    `<span class="legend-name">${name}</span>` +
    `</span>`
  ).join('');
  return `<div class="interval-legend"><span class="legend-heading">Intervals</span>${items}</div>`;
}

// ── Event Binding ─────────────────────────────────────────────────────────────

function bindEvents(): void {
  on('key-sel', 'change', (e) => { state = {...state, root: num(e)}; render(); });
  on('key-dec', 'click', () => { state = {...state, root: (state.root - 1 + 12) % 12}; render(); });
  on('key-inc', 'click', () => { state = {...state, root: (state.root + 1) % 12}; render(); });

  on('scale-sel', 'change', (e) => {
    const name = (e.target as HTMLSelectElement).value;
    if (name !== 'Custom' && SCALES[name]) {
      state = {...state, intervals: [...SCALES[name]]};
      render();
    }
  });

  on('frets-in', 'change', (e) => { state = {...state, frets: clamp(num(e), 1, 36)}; render(); });
  on('frets-dec', 'click', () => { state = {...state, frets: clamp(state.frets - 1, 1, 36)}; render(); });
  on('frets-inc', 'click', () => { state = {...state, frets: clamp(state.frets + 1, 1, 36)}; render(); });

  on('strings-in', 'change', (e) => {
    const strings = clamp(num(e), 4, 8);
    state = {...state, strings, tuning: resizeTuning(state.tuning, state.strings, strings)};
    render();
  });
  on('strings-dec', 'click', () => {
    const strings = clamp(state.strings - 1, 4, 8);
    state = {...state, strings, tuning: resizeTuning(state.tuning, state.strings, strings)};
    render();
  });
  on('strings-inc', 'click', () => {
    const strings = clamp(state.strings + 1, 4, 8);
    state = {...state, strings, tuning: resizeTuning(state.tuning, state.strings, strings)};
    render();
  });

  document.querySelectorAll<HTMLInputElement>('.note-check input:not([disabled])').forEach(cb => {
    cb.addEventListener('change', () => {
      const iv      = Number(cb.dataset.iv);
      const checked = cb.checked;
      let ivs = checked
        ? [...state.intervals, iv].sort((a, b) => a - b)
        : state.intervals.filter(x => x !== iv);
      if (ivs.length === 0) ivs = [0];
      state = {...state, intervals: ivs};
      render();
    });
  });

  on('fretboard-zoom', 'click', () => {
    fretboardZoomed = !fretboardZoomed;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = TUNING_PRESETS[btn.dataset.preset ?? ''];
      if (preset) {
        state = {...state, tuning: applyPreset(state.tuning, state.strings, preset)};
        render();
      }
    });
  });

  on('tune-down', 'click', () => {
    state = {...state, tuning: state.tuning.map(pc => (pc - 1 + 12) % 12)};
    render();
  });

  on('tune-up', 'click', () => {
    state = {...state, tuning: state.tuning.map(pc => (pc + 1) % 12)};
    render();
  });

  document.querySelectorAll<HTMLSelectElement>('[data-tidx]').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx    = Number(sel.dataset.tidx);
      const pc     = Number(sel.value);
      const tuning = [...state.tuning];
      tuning[idx]  = pc;
      state = {...state, tuning};
      render();
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function on(id: string, ev: string, fn: (e: Event) => void): void {
  document.getElementById(id)?.addEventListener(ev, fn);
}

function num(e: Event): number {
  return Number((e.target as HTMLInputElement | HTMLSelectElement).value);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function resizeTuning(tuning: number[], oldN: number, newN: number): number[] {
  if (newN === oldN) return tuning;
  if (newN < oldN) return tuning.slice(tuning.length - newN);
  const base = defaultTuning(newN);
  const result = [...base];
  // Preserve existing string settings from old tuning
  for (let i = 0; i < Math.min(oldN, newN); i++) {
    result[result.length - 1 - i] = tuning[tuning.length - 1 - i];
  }
  return result;
}

// ── Boot ─────────────────────────────────────────────────────────────────────

render();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fretboardZoomed) {
    fretboardZoomed = false;
    render();
  }
});
