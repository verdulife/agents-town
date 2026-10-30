// The dev server's door to the live Pi agents (A1, A6).
//
// The browser cannot read `~/.pi`, so `/api/agents` runs `tools/agents-source.py` — which imports the YASB bar's
// own widget, so the bar and the town can never disagree — and returns its one JSON snapshot. Dev only: on the
// built site there is no endpoint, and the page falls back to its static snapshot.
//
// The read is cached for a moment: the page polls every 2.5 s and several tabs share one process, and the files
// behind it are written by Pi's presence publisher every 5 s.

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, 'agents-source.py');
const CACHE_MS = 2000;

let cached = null;
let cachedAt = 0;

function readAgents() {
  return new Promise((resolve) => {
    // `py` is the Windows launcher; `python3`/`python` cover the rest. The first that runs wins.
    const candidates = process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python'];
    const failures = [];
    const attempt = (i) => {
      if (i >= candidates.length) {
        resolve({ schema: 'pixel-town.agents/v1', source: 'none', live: 0, agents: [], error: failures.join(' | ') || 'no python' });
        return;
      }
      execFile(candidates[i], [BRIDGE], { timeout: 8000, windowsHide: true }, (err, stdout) => {
        if (err) {
          failures.push(candidates[i] + ': ' + String(err.message).slice(0, 120));
          attempt(i + 1);
          return;
        }
        try {
          resolve(JSON.parse(String(stdout)));
        } catch {
          resolve({ schema: 'pixel-town.agents/v1', source: 'none', live: 0, agents: [], error: 'bad json' });
        }
      });
    };
    attempt(0);
  });
}

function agentsPlugin() {
  return {
    name: 'pixel-town-agents',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/agents', async (req, res) => {
        const now = Date.now();
        if (!cached || now - cachedAt > CACHE_MS) {
          cached = await readAgents();
          cachedAt = now;
        }
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(JSON.stringify(cached));
      });
    },
  };
}

export default agentsPlugin;
