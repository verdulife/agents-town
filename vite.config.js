// Vite config: the app is a plain canvas + ES modules, so there is nothing to
// transform. `base: './'` only matters for the build, and keeps `dist/`
// portable to any subfolder.
export default {
  base: './',
  server: { port: 5173, open: false },
  preview: { port: 4173 },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
};
