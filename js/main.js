/**
 * Entry point: the hash router and the home screen.
 * Views are the <main id="view-..."> elements in index.html. The hash picks one:
 * #game, #player-card, anything else shows home. Keep hashes simple (letters,
 * numbers and dashes).
 */

import { $ } from './shared/dom.js';
import { renderCard } from './shared/card.js';
import { initPlayerView } from './player/view.js';

const views = {
  'home': $('view-home'),
  'game': $('view-game'),
  'player-card': $('view-player-card'),
};
let firstShow = true;

function show() {
  const name = location.hash.slice(1);
  const key = views[name] ? name : 'home';
  for (const [viewName, view] of Object.entries(views)) view.hidden = viewName !== key;
  if (!firstShow) {
    window.scrollTo(0, 0);
    const heading = views[key].querySelector('h1, h2');
    if (heading) heading.focus({ preventScroll: true });
  }
  firstShow = false;
}

// Registered before the views start, so a view is already visible when its own
// hashchange listeners run.
window.addEventListener('hashchange', show);
show();

// The starting card everyone walks in with.
renderCard($('home-card'), {
  name: 'Human',
  cost: 0,
  colors: [],
  types: ['Human'],
  power: 1,
  toughness: 1,
  rulesText: 'Colorless. No abilities yet.',
  flavor: 'Everyone walks in as a 1/1.',
});

initPlayerView();
