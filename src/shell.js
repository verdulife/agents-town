// The menu every place carries. The places are separate documents — there is no router,
// so the only thing they share is this bar, and this file is the list they share it with.
//
// A link is relative to the document, and each page declares its own depth in
// `data-root` ("", "../", "../../"). That is what keeps the menu working from `vite dev`,
// from `dist/` served at a domain root, and from a subfolder: no server rewrite, no
// build-time base, no runtime guessing from the asset path.

import './shell.css';

const PLACES = [
  { path: '', label: 'home' },
  { path: 'cafe/', label: 'cafe' },
  { path: 'gallery/card/', label: 'card' },
  { path: 'gallery/buildings/', label: 'buildings' },
  { path: 'gallery/terrain/', label: 'floor' },
  { path: 'design-system/', label: 'design system' },
  { path: 'archive/', label: 'archive' },
];

// `index.html` and a missing trailing slash both mean the same page.
function currentPath() {
  const path = location.pathname.replace(/index\.html$/, '');
  return path.endsWith('/') ? path : `${path}/`;
}

function mountMenu() {
  const root = document.body.dataset.root ?? '';
  const here = currentPath();
  const nav = document.createElement('nav');
  nav.id = 'menu';
  nav.setAttribute('aria-label', 'places');
  for (const place of PLACES) {
    const link = document.createElement('a');
    link.href = `${root}${place.path}`;
    link.textContent = place.label;
    // the resolved path compares equal to the current one, however the link is written
    if (link.href === `file://${here}` || new URL(link.href, location.href).pathname === here) {
      link.setAttribute('aria-current', 'page');
    }
    nav.append(link);
  }
  document.body.append(nav);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountMenu);
else mountMenu();
