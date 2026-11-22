// Ember Duel — game state and rules (state.js). No drawing, no sound, no browser
// in here: pure state plus the rules that change it, so the same file can be
// unit-tested in Node and driven by the browser loop.
//
// Core loop (verb -> feedback -> reward -> reset):
//   PLAY a card (click it) -> damage numbers fly, the enemy shakes, a hit sounds
//   -> the enemy's HP bar drops and its intent is answered -> END TURN resets
//   energy, draws a card, and the enemy shows its next intent to read.
// Energy: starts at 1, +1 each turn, max 10. Draw 1 per turn, hand max 7.
// Block absorbs damage and resets at the start of its owner's turn.
// Burn deals its damage at the start of its owner's turn, then ticks down.

import { buildDeck, drawCards, HAND_START, shuffle } from './deck.js';

export const MAX_HP = 30;
export const MAX_ENERGY = 10;

/** mulberry32: the same seed gives the same game, for ?shot= and tests. */
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFighter(hp) {
  return { hp, maxHp: MAX_HP, block: 0, burn: 0, burnTurns: 0 };
}

/** A fresh game, before the title screen's Play button is pressed. */
export function createGame(seed = 1) {
  const random = createRandom(seed);
  const deck = shuffle(buildDeck(), random);
  return {
    seed,
    random,
    phase: 'title', // title | play | win | loss
    turn: 0,
    energy: 0,
    maxEnergy: 0,
    player: makeFighter(MAX_HP),
    enemy: makeFighter(MAX_HP),
    enemyHand: 4, // face-down cards shown, not a real hand: the AI plays intents
    deck,
    hand: [],
    discard: [],
    intent: null, // { kind, amount, burn? } — what the enemy will do next
    log: ['The Ember Warden stokes its coals...'],
    floaters: [], // { x, y, text, color, t } — filled in by main.js with positions
    anims: [], // { kind, card, t, dur } — card flight, filled in by main.js
    shake: 0,
    stats: { played: 0, damageDealt: 0, damageTaken: 0, turns: 0 },
    message: '',
  };
}

/** Deal damage to a fighter: block absorbs first, the rest hits HP. Returns HP lost. */
export function dealDamage(target, amount) {
  const absorbed = Math.min(target.block, amount);
  target.block -= absorbed;
  const hpLost = Math.min(target.hp, amount - absorbed);
  target.hp -= hpLost;
  return hpLost;
}

/** Apply burn at the start of `owner`'s turn. Returns damage dealt (0 if none). */
export function tickBurn(owner) {
  if (owner.burn <= 0 || owner.burnTurns <= 0) return 0;
  const dealt = dealDamage(owner, owner.burn);
  owner.burnTurns -= 1;
  if (owner.burnTurns === 0) owner.burn = 0;
  return dealt;
}

export function addLog(game, line) {
  game.log.push(line);
  if (game.log.length > 3) game.log.shift();
}

/** Start a match: fresh piles, opening hand, first intent, turn 1 energy. */
export function startMatch(game) {
  game.phase = 'play';
  game.turn = 1;
  game.maxEnergy = 1;
  game.energy = 1;
  game.player = makeFighter(MAX_HP);
  game.enemy = makeFighter(MAX_HP);
  game.deck = shuffle(buildDeck(), game.random);
  game.hand = [];
  game.discard = [];
  game.log = ['Turn 1 — your move. The Warden plans its first strike.'];
  game.stats = { played: 0, damageDealt: 0, damageTaken: 0, turns: 1 };
  drawCards(game.deck, game.discard, game.hand, HAND_START, game.random);
  return game;
}

/** Begin the player's turn: energy grows, block refreshes, burn ticks, draw 1. */
export function startPlayerTurn(game) {
  game.turn += 1;
  game.stats.turns = game.turn;
  game.maxEnergy = Math.min(MAX_ENERGY, game.turn);
  game.energy = game.maxEnergy;
  game.player.block = 0;
  const burned = tickBurn(game.player);
  if (burned > 0) {
    game.stats.damageTaken += burned;
    addLog(game, `Burn scorches you for ${burned}.`);
  }
  drawCards(game.deck, game.discard, game.hand, 1, game.random);
  if (game.player.hp <= 0) {
    game.phase = 'loss';
    addLog(game, 'The burn finished you...');
  }
  return burned;
}

export function canPlay(game, index) {
  const card = game.hand[index];
  return Boolean(game.phase === 'play' && card && card.cost <= game.energy);
}

/**
 * Play the card at `index`. Returns an event object the loop turns into
 * animation + sound + log, or null when the card cannot be played.
 * Events: { type: 'damage'|'block'|'heal'|'burn', amount, hits?, card }
 */
export function playCard(game, index) {
  if (!canPlay(game, index)) return null;
  const card = game.hand[index];
  game.energy -= card.cost;
  game.hand.splice(index, 1);
  game.discard.push(card);
  game.stats.played += 1;
  const events = [];

  if (card.block) {
    game.player.block += card.block;
    events.push({ type: 'block', amount: card.block, card });
    addLog(game, `Guard: +${card.block} Block.`);
  }
  if (card.heal) {
    const healed = Math.min(card.heal, game.player.maxHp - game.player.hp);
    game.player.hp += healed;
    events.push({ type: 'heal', amount: healed, card });
    addLog(game, `Mend: restored ${healed} HP.`);
  }
  if (card.dmg) {
    const hits = card.hits || 1;
    let total = 0;
    for (let h = 0; h < hits; h += 1) total += dealDamage(game.enemy, card.dmg);
    game.stats.damageDealt += total;
    events.push({ type: 'damage', amount: total, hits, card });
    addLog(game, `${card.name}: ${total} damage to the Warden.`);
  }
  if (card.burn) {
    game.enemy.burn = card.burn;
    game.enemy.burnTurns = card.burnTurns;
    events.push({ type: 'burn', amount: card.burn, card });
    addLog(game, `Ember Burst: the Warden burns (${card.burn} x ${card.burnTurns} turns).`);
  }
  if (game.enemy.hp <= 0) {
    game.enemy.hp = 0;
    game.phase = 'win';
    addLog(game, 'The Warden crumbles to ash. You win!');
  }
  return events;
}

/** True when the match is over, either way. */
export function isOver(game) {
  return game.phase === 'win' || game.phase === 'loss';
}
