// Vite config: the app is plain canvas + ES modules, so there is nothing to transform.
//
// Every place is its own document under its own path (`/design-system/`, `/gallery/floor/`…),
// which is what keeps a URL clean without a single-page router and without a server
// rewrite. `appType: 'mpa'` makes the dev server honest about it: an unknown path is a 404
// instead of a silent fallback to the hub. `base: './'` still keeps `dist/` portable to any
// subfolder, and the menu computes its links from each page's own depth.
//
// `agentsPlugin` is the dev-only door to the live Pi agents (S28/A1): the browser cannot read `~/.pi`, so the
// server does it and serves one snapshot at `/api/agents`.
import agentsPlugin from './tools/agents-plugin.mjs';

export default {
  plugins: [agentsPlugin()],
  appType: 'mpa',
  base: './',
  server: { port: 5173, open: false },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        hub: 'index.html',
        archive: 'archive/index.html',
        cafe: 'cafe/index.html',
        card: 'gallery/card/index.html',
        buildings: 'gallery/buildings/index.html',
        floor: 'gallery/terrain/index.html',
        designSystem: 'design-system/index.html',
      },
    },
  },
};
