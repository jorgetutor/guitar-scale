# Guitar Scale Visualizer

An interactive fretboard visualizer for exploring guitar scales and modes. Select a root note and a scale (Major, Minor, pentatonic, modes, and more) to see the notes highlighted across a fully configurable fretboard.

By [Jorge Tutor](https://jorgetutor.net).

## Features

- 20+ scales and modes (Major, Natural/Harmonic/Melodic Minor, all church modes, pentatonics, Blues, Whole Tone, Diminished, Chromatic)
- Configurable number of strings (4–8) and frets (up to 36)
- Per-string tuning control
- Scale detection — select intervals manually and the app names the matching scale
- State persisted in `localStorage`

## Development

Requires Docker and Docker Compose.

```bash
docker compose up
```

The app runs at <http://localhost:5173>.

## Build

```bash
docker compose run --rm app pnpm build
```

Output goes to `dist/`.

## License

MIT — see [LICENSE](LICENSE).
