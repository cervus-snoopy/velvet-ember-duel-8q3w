// Ember Duel — the hand-in program (Node 22, standard library only).
// The game itself is plain static files under game/: game/index.html plus its
// ES modules, no library, no network request, so any static server can host it
// and desktop Chrome can play it offline. This program copies game/ and
// screenshots/ from beside this file into /output (or MAKEFUN_OUTPUT_DIR
// outside the grader) and writes /output/dossier.json, the summary the judge
// reads, using the vendored make.fun library in vendor/makefun-game.ts.
//
// Serve it locally with any static server rooted at game/, for example:
//   cd game && python3 -m http.server 8080
// then open http://localhost:8080. Outside the grader:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: at most 4 screenshots, each at most 256 KiB; game/
// at most 993 files and 48 MiB in all, no path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
