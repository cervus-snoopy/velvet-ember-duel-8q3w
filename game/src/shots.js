// Ember Duel — deterministic screenshot scenes (shots.js).
// ?shot=start|play|win|loss (with &seed=N) stages that scene from the real
// rules and the real renderer — no mock pixels, no composite. The loop paints
// it twice and sets window.__shotReady so a screenshot tool knows it is done.
//   start — title screen, a fanned sample hand, Play button.
//   play  — turn 2, both fighters at 30/30, a 5-card hand, intent shown.
//   win   — the Warden at 0 HP, victory panel with match stats.
//   loss  — the player at 0 HP, defeat panel with match stats.

import { CARD_DEFS } from './deck.js';
import { createGame, startMatch } from './state.js';
import { SCREEN_LOSS, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function handOf(ids) {
  return ids.map((id, i) => ({ ...CARD_DEFS[id], uid: 100 + i }));
}

export function stageShot(name, seed = 1) {
  const game = createGame(seed);
  if (name === 'play') {
    startMatch(game);
    game.turn = 2;
    game.maxEnergy = 2;
    game.energy = 2;
    game.hand = handOf(['strike', 'heavy', 'guard', 'ember', 'mend']);
    game.deck = game.deck.slice(0, 7);
    game.discard = [];
    game.intent = { kind: 'attack', amount: 6, label: 'Attack 6' };
    game.log = ['Turn 2 — the Warden will Attack 6. Guard, or race it.'];
    return { game, screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    startMatch(game);
    game.turn = 5;
    game.stats = { played: 9, damageDealt: 34, damageTaken: 11, turns: 5 };
    game.player.hp = 18;
    game.enemy.hp = 0;
    game.phase = 'win';
    game.hand = handOf(['strike', 'guard']);
    game.log = ['The Warden crumbles to ash. You win!'];
    return { game, screen: SCREEN_WIN };
  }
  if (name === 'loss') {
    startMatch(game);
    game.turn = 6;
    game.stats = { played: 8, damageDealt: 22, damageTaken: 30, turns: 6 };
    game.player.hp = 0;
    game.enemy.hp = 12;
    game.phase = 'loss';
    game.hand = handOf(['mend', 'guard']);
    game.log = ['The Warden overwhelms you...'];
    return { game, screen: SCREEN_LOSS };
  }
  // start (and any unknown name): the title screen over a fresh game.
  return { game, screen: SCREEN_TITLE };
}
