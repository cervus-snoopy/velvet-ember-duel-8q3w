// Ember Duel — entry point and game loop (main.js).
// Boot: read ?shot= / ?seed=, build state + renderer + audio + input, then run.
// The loop is one requestAnimationFrame: advance card-flight animations,
// damage floaters and screen shake, then paint. Rules live in state.js / ai.js;
// this file only wires them to clicks, keys and sound.
//
// Turn flow: Play -> click a card (or 1-7) -> its flight animation + sound ->
// End Turn (or E) -> the Warden burns, acts on its shown intent, a new intent
// is chosen -> your next turn starts with +1 energy and a fresh draw.
// Win the moment the Warden hits 0 HP; lose the moment you do.
//
// ?shot=start|play|win|loss stages a deterministic scene instead of the loop
// and sets window.__shotReady after two paints (see shots.js).

import { createAudio } from './audio.js';
import { chooseIntent, enemyAct } from './ai.js';
import { createInput, KEY_END, KEY_MUTE, KEY_PLAY, KEY_RESTART } from './input.js';
import { createRenderer, hitTest, SCREEN_LOSS, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { canPlay, createGame, isOver, playCard, startMatch, startPlayerTurn } from './state.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

/** A damage floater over a fighter: (640, 168) is the Warden, (190, 436) you. */
function addFloater(game, x, y, text, color) {
  game.floaters.push({ x, y, text, color, t: 0 });
}

function applyEvents(game, events, target) {
  for (const ev of events) {
    if (ev.type === 'damage') {
      const atPlayer = target === 'player' || ev.target === 'player';
      addFloater(game, atPlayer ? 190 : 640, atPlayer ? 420 : 120, `-${ev.amount}`, '#ff8a65');
      game.shake = Math.max(game.shake, 10);
      audio.hit();
    } else if (ev.type === 'block') {
      addFloater(game, ev.target === 'player' ? 190 : 640, 120, `+${ev.amount} Block`, '#81c784');
      audio.block();
    } else if (ev.type === 'heal') {
      addFloater(game, 190, 420, `+${ev.amount}`, '#4fc3f7');
      audio.heal();
    } else if (ev.type === 'burn') {
      addFloater(game, ev.target === 'player' ? 190 : 640, 150, 'BURN', '#ff6b35');
      audio.burn();
    } else if (ev.type === 'burnTick') {
      addFloater(game, ev.target === 'player' ? 190 : 640, 150, `-${ev.amount} burn`, '#ff6b35');
      audio.burn();
    }
  }
}

function flyCard(game, card, fromRect) {
  game.anims.push({
    kind: 'card', card,
    from: { x: fromRect.x + fromRect.w / 2, y: fromRect.y + fromRect.h / 2 },
    to: { x: 640, y: 168 },
    t: 0, dur: 0.35,
  });
}

function runShot(name) {
  const { game, screen } = stageShot(name, seed);
  game.muted = false;
  let painted = 0;
  function paint() {
    renderer.draw(game, screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const game = createGame(seed);
  game.muted = false;
  game.selected = -1;
  let screen = SCREEN_TITLE;
  let last = performance.now();

  function start() {
    startMatch(game);
    game.selected = -1;
    game.intent = chooseIntent(game);
    screen = SCREEN_PLAY;
    audio.turn();
    announce(`Turn 1. You have 1 energy and ${game.hand.length} cards. The Warden will ${game.intent.label}.`);
  }

  function tryPlayCard(index) {
    if (screen !== SCREEN_PLAY || !canPlay(game, index)) {
      audio.click();
      return;
    }
    const card = game.hand[index];
    const lay = renderer.layout(game);
    const rect = lay.hand.find((s) => s.index === index);
    if (rect) flyCard(game, card, rect);
    const events = playCard(game, index);
    game.selected = -1;
    audio.play();
    if (events) applyEvents(game, events, 'enemy');
    if (game.phase === 'win') {
      screen = SCREEN_WIN;
      audio.win();
      announce('You win! The Ember Warden crumbles to ash.');
    }
  }

  function endTurn() {
    if (screen !== SCREEN_PLAY) return;
    audio.turn();
    // The Warden's turn: burn ticks, then it does exactly what it showed.
    const events = enemyAct(game);
    applyEvents(game, events, 'player');
    if (game.phase === 'loss') {
      screen = SCREEN_LOSS;
      audio.lose();
      announce('You lose. The Warden overwhelms you.');
      return;
    }
    if (game.phase === 'win') {
      screen = SCREEN_WIN;
      audio.win();
      announce('You win! The burn finished the Warden.');
      return;
    }
    // Your next turn: +1 energy, fresh draw, and a new intent to read.
    startPlayerTurn(game);
    if (game.phase === 'loss') {
      screen = SCREEN_LOSS;
      audio.lose();
      announce('You lose. The burn finished you.');
      return;
    }
    game.intent = chooseIntent(game);
    audio.draw();
    announce(`Turn ${game.turn}. ${game.energy} energy. The Warden will ${game.intent.label}.`);
  }

  function onClick(point) {
    audio.unlock();
    const hit = hitTest(game, point.x, point.y);
    if (!hit) return;
    if (hit.type === 'play' && screen === SCREEN_TITLE) { audio.click(); start(); return; }
    if (hit.type === 'again' && (screen === SCREEN_WIN || screen === SCREEN_LOSS)) { audio.click(); start(); return; }
    if (hit.type === 'end') { endTurn(); return; }
    if (hit.type === 'mute') { game.muted = audio.toggleMute(); return; }
    if (hit.type === 'card') {
      if (game.selected === hit.index) tryPlayCard(hit.index);
      else { game.selected = hit.index; audio.click(); }
    }
  }

  function onKey(action) {
    audio.unlock();
    if (action === KEY_MUTE) { game.muted = audio.toggleMute(); return; }
    if (action === KEY_PLAY) {
      if (screen === SCREEN_TITLE) start();
      else if (screen === SCREEN_WIN || screen === SCREEN_LOSS) start();
      return;
    }
    if (action === KEY_RESTART && (screen === SCREEN_WIN || screen === SCREEN_LOSS)) { start(); return; }
    if (action === KEY_END) endTurn();
  }

  function onCardKey(index) {
    audio.unlock();
    if (screen === SCREEN_PLAY) tryPlayCard(index);
  }

  createInput(canvas, (x, y) => ({ x, y }), {
    click: onClick,
    key: onKey,
    card: onCardKey,
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const anim of game.anims) anim.t += dt;
    game.anims = game.anims.filter((a) => a.t < a.dur);
    for (const f of game.floaters) f.t += dt;
    game.floaters = game.floaters.filter((f) => f.t < 1.1);
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 30);
    renderer.draw(game, screen);
  }

  // Test hook (also used by the automated playtest): the same functions the
  // clicks call, exposed read-only for driving a full match headlessly.
  window.__ember = {
    game,
    get screen() { return screen; },
    start, endTurn, tryPlayCard,
    state: () => ({ phase: game.phase, turn: game.turn, energy: game.energy, playerHp: game.player.hp, enemyHp: game.enemy.hp, hand: game.hand.map((c) => c.id) }),
  };

  announce('Ember Duel. Press Space or click Play to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
