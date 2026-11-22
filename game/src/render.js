// Ember Duel — rendering (render.js). Drawing only: game state in, pixels out.
// The table is a fixed 1280x720 logical field, scaled to fit the window and
// centred, so the layout never depends on the screen size. Layout is computed
// once per frame by `layout()` and shared with the click handling in main.js,
// so what you see is exactly what you can click.
//
// Visual language (21st-ui: one felt table, one ember accent, big numbers):
// dark-green felt, ember-orange accents, gold energy, cream text. Cards are
// 150x205 with a huge cost orb, a big effect number, and an element shown by
// colour AND shape (flame / drop / leaf / spark). No images, no fonts to fetch.

import { ELEMENTS } from './deck.js';

export const FIELD = { width: 1280, height: 720 };
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSS = 'loss';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const CREAM = '#f5efe6';
const MUTED = '#c9bfae';
const FELT_A = '#0e4d2e';
const FELT_B = '#0a3a22';
const EMBER = '#ff6b35';
const GOLD = '#ffd54f';
const PANEL = '#1d2b24';
const CARD_BG = '#f7f1e3';
const CARD_INK = '#241d18';

const CARD = { w: 150, h: 205, overlap: 16 };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Element glyphs, drawn as paths so they need no image file. */
export function drawElement(ctx, element, cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (element === 'flame') {
    // Teardrop flame: a round base with a flicked tip.
    ctx.moveTo(cx, cy - s);
    ctx.bezierCurveTo(cx + s * 0.85, cy - s * 0.2, cx + s * 0.6, cy + s * 0.7, cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx - s * 0.6, cy + s * 0.7, cx - s * 0.85, cy - s * 0.2, cx, cy - s);
  } else if (element === 'drop') {
    ctx.moveTo(cx, cy - s);
    ctx.bezierCurveTo(cx + s * 0.8, cy, cx + s * 0.7, cy + s * 0.75, cx, cy + s * 0.75);
    ctx.bezierCurveTo(cx - s * 0.7, cy + s * 0.75, cx - s * 0.8, cy, cx, cy - s);
  } else if (element === 'leaf') {
    ctx.ellipse(cx, cy, s * 0.85, s * 0.55, -0.6, 0, Math.PI * 2);
  } else {
    // spark: a lightning bolt.
    ctx.moveTo(cx + s * 0.15, cy - s);
    ctx.lineTo(cx - s * 0.55, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.05, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.2, cy + s);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.05, cy - s * 0.1);
  }
  ctx.fill();
}

/** Where everything clickable sits this frame. Shared with main.js hit-testing. */
export function layout(game) {
  const n = game.hand.length;
  const totalW = n === 0 ? 0 : n * CARD.w - (n - 1) * CARD.overlap;
  const startX = (FIELD.width - totalW) / 2;
  const hand = game.hand.map((card, i) => {
    const raised = game.selected === i ? 26 : 0;
    return { x: startX + i * (CARD.w - CARD.overlap), y: 492 - raised, w: CARD.w, h: CARD.h, card, index: i };
  });
  return {
    hand,
    endTurn: { x: 1064, y: 596, w: 176, h: 64 },
    playBtn: { x: 540, y: 525, w: 200, h: 64 },
    againBtn: { x: 540, y: 540, w: 200, h: 64 },
    muteBtn: { x: 1220, y: 668, w: 44, h: 36 },
  };
}

function inRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function hitTest(game, x, y) {
  const lay = layout(game);
  if (game.phase === 'title') return inRect(x, y, lay.playBtn) ? { type: 'play' } : null;
  if (game.phase === 'win' || game.phase === 'loss') return inRect(x, y, lay.againBtn) ? { type: 'again' } : null;
  if (inRect(x, y, lay.endTurn)) return { type: 'end' };
  if (inRect(x, y, lay.muteBtn)) return { type: 'mute' };
  for (let i = lay.hand.length - 1; i >= 0; i -= 1) {
    if (inRect(x, y, lay.hand[i])) return { type: 'card', index: lay.hand[i].index };
  }
  return null;
}

function text(ctx, value, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function hpBar(ctx, x, y, w, h, hp, maxHp, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  const frac = Math.max(0, hp / maxHp);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, '#e5484d');
  grad.addColorStop(1, '#ff6b35');
  ctx.fillStyle = grad;
  if (frac > 0) {
    rr(ctx, x + 3, y + 3, (w - 6) * frac, h - 6, 5);
    ctx.fill();
  }
  text(ctx, `${label}  ${hp} / ${maxHp}`, x + 12, y + h / 2 + 7, 20, CREAM, 'left', 700);
}

function badge(ctx, x, y, label, value, bg) {
  ctx.font = `700 18px ${FONT}`;
  const w = ctx.measureText(`${label} ${value}`).width + 24;
  ctx.fillStyle = bg;
  rr(ctx, x, y, w, 30, 15);
  ctx.fill();
  text(ctx, `${label} ${value}`, x + 12, y + 21, 18, '#fff');
  return w;
}

function drawCardFace(ctx, card, x, y, w, h, opts = {}) {
  const el = ELEMENTS[card.element];
  const playable = opts.playable !== false;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.fillStyle = playable ? CARD_BG : '#c9bfae';
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = 4;
  rr(ctx, x + 2, y + 2, w - 4, h - 4, 10);
  ctx.stroke();
  // Cost orb, top-left — the biggest number on the card.
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(x + 28, y + 28, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(card.cost), x + 28, y + 37);
  // Element glyph, top-right.
  drawElement(ctx, card.element, x + w - 30, y + 28, 16, el.color);
  // Name.
  ctx.fillStyle = CARD_INK;
  ctx.font = `800 ${card.name.length > 11 ? 19 : 22}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(card.name, x + w / 2, y + 78);
  // Big effect number, centre — the value a player reads first.
  const big = card.dmg ? (card.hits ? `${card.dmg}x${card.hits}` : String(card.dmg))
    : card.block ? `+${card.block}` : card.heal ? `+${card.heal}` : '—';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillStyle = card.dmg ? '#c73e1d' : card.block ? '#2e7d32' : '#1565c0';
  ctx.fillText(big, x + w / 2, y + 132);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = '#5b4a3a';
  ctx.fillText(card.dmg ? 'DAMAGE' : card.block ? 'BLOCK' : card.heal ? 'HEAL' : 'EFFECT', x + w / 2, y + 152);
  // Rules text.
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = '#3d3226';
  const words = card.text.split(' ');
  let line = '';
  let ly = y + 176;
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`.trim()).width > w - 20 && line) {
      ctx.fillText(line, x + w / 2, ly);
      line = word;
      ly += 15;
    } else line = `${line} ${word}`.trim();
  }
  if (line) ctx.fillText(line, x + w / 2, ly);
  if (!playable) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, x, y, w, h, 12);
    ctx.fill();
  }
  ctx.restore();
}

function drawCardBack(ctx, x, y, w, h) {
  ctx.fillStyle = '#7c2d12';
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  rr(ctx, x + 4, y + 4, w - 8, h - 8, 6);
  ctx.stroke();
  drawElement(ctx, 'flame', x + w / 2, y + h / 2, Math.min(w, h) * 0.28, EMBER);
}

function drawPanel(ctx, title, lines, prompt, accent) {
  const w = 640;
  const h = 150 + lines.length * 32 + 70;
  const x = (FIELD.width - w) / 2;
  const y = (FIELD.height - h) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PANEL;
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  rr(ctx, x, y, w, h, 18);
  ctx.stroke();
  text(ctx, title, FIELD.width / 2, y + 72, 52, CREAM, 'center', 800);
  lines.forEach((line, i) => text(ctx, line, FIELD.width / 2, y + 122 + i * 32, 21, MUTED, 'center', 500));
  text(ctx, prompt, FIELD.width / 2, y + h - 28, 22, GOLD, 'center', 700);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  function drawTable() {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, FELT_A);
    grad.addColorStop(1, FELT_B);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Felt ring around the table.
    ctx.strokeStyle = 'rgba(255,213,79,0.25)';
    ctx.lineWidth = 3;
    rr(ctx, 14, 14, FIELD.width - 28, FIELD.height - 28, 24);
    ctx.stroke();
    // Ember glow at the top centre, behind the Warden.
    const glow = ctx.createRadialGradient(640, 170, 10, 640, 170, 190);
    glow.addColorStop(0, 'rgba(255,107,53,0.35)');
    glow.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(380, 0, 520, 360);
  }

  function drawEnemy(game) {
    // Warden portrait: a burning coal circle with eyes.
    const cx = 640;
    const cy = 168;
    ctx.fillStyle = '#2b1a12';
    ctx.beginPath();
    ctx.arc(cx, cy, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = EMBER;
    ctx.lineWidth = 4;
    ctx.stroke();
    drawElement(ctx, 'flame', cx, cy - 8, 34, EMBER);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(cx - 16, cy + 22, 5, 0, Math.PI * 2);
    ctx.arc(cx + 16, cy + 22, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'EMBER WARDEN', cx, cy + 92, 20, CREAM, 'center', 800);
    // Burn / block badges under the portrait.
    let bx = cx - 60;
    if (game.enemy.block > 0) bx += badge(ctx, bx, cy + 104, 'Block', game.enemy.block, '#2e7d32') + 8;
    if (game.enemy.burn > 0) badge(ctx, bx, cy + 104, 'Burn', `${game.enemy.burn}x${game.enemy.burnTurns}`, '#c73e1d');
    // Face-down hand, top centre.
    const backs = game.enemyHand;
    const bw = 46;
    const bh = 64;
    const total = backs * (bw + 8) - 8;
    for (let i = 0; i < backs; i += 1) {
      drawCardBack(ctx, 640 - total / 2 + i * (bw + 8), 272, bw, bh);
    }
  }

  function drawHud(game, lay) {
    // Enemy HP, top-left; intent, top-right — the read the player plans around.
    hpBar(ctx, 40, 20, 420, 34, game.enemy.hp, game.enemy.maxHp, 'WARDEN');
    if (game.intent) {
      const label = `NEXT: ${game.intent.label}`;
      ctx.font = `700 20px ${FONT}`;
      const w = ctx.measureText(label).width + 96;
      const x = 1240 - w;
      ctx.fillStyle = game.intent.kind === 'defend' ? '#2e7d32' : '#c73e1d';
      rr(ctx, x, 16, w, 42, 12);
      ctx.fill();
      const icon = game.intent.kind === 'defend' ? 'leaf' : game.intent.kind === 'burn' ? 'flame' : 'spark';
      drawElement(ctx, icon, x + 28, 37, 13, '#fff');
      text(ctx, label, x + 48, 44, 20, '#fff', 'left', 700);
    }
    text(ctx, `TURN ${game.turn}`, 640, 48, 22, GOLD, 'center', 800);
    // Player row, above the hand.
    hpBar(ctx, 40, 436, 300, 34, game.player.hp, game.player.maxHp, 'YOU');
    let bx = 356;
    if (game.player.block > 0) bx += badge(ctx, bx, 440, 'Block', game.player.block, '#2e7d32') + 8;
    if (game.player.burn > 0) badge(ctx, bx, 440, 'Burn', `${game.player.burn}x${game.player.burnTurns}`, '#c73e1d');
    text(ctx, `Deck ${game.deck.length}   Discard ${game.discard.length}`, 640, 462, 18, MUTED, 'center', 500);
    // Energy orbs, right of the player row.
    text(ctx, 'ENERGY', 1064, 452, 16, GOLD, 'left', 800);
    for (let i = 0; i < game.maxEnergy; i += 1) {
      const ex = 1072 + i * 20;
      ctx.beginPath();
      ctx.arc(ex, 472, 8, 0, Math.PI * 2);
      ctx.fillStyle = i < game.energy ? GOLD : 'rgba(255,213,79,0.25)';
      ctx.fill();
    }
    // End Turn button.
    const et = lay.endTurn;
    const canEnd = game.phase === 'play';
    ctx.fillStyle = canEnd ? EMBER : '#5b4a3a';
    rr(ctx, et.x, et.y, et.w, et.h, 14);
    ctx.fill();
    text(ctx, 'END TURN', et.x + et.w / 2, et.y + 40, 24, '#fff', 'center', 800);
    text(ctx, 'or press E', et.x + et.w / 2, et.y + 84, 15, MUTED, 'center', 500);
    // Log line, centre table.
    const last = game.log[game.log.length - 1] || '';
    text(ctx, last, 640, 372, 20, CREAM, 'center', 500);
    // Mute hint.
    text(ctx, game.muted ? 'M — sound off' : 'M — mute', 1240, 700, 14, MUTED, 'right', 500);
  }

  function drawHand(game, lay) {
    for (const slot of lay.hand) {
      const playable = slot.card.cost <= game.energy;
      drawCardFace(ctx, slot.card, slot.x, slot.y, slot.w, slot.h, { playable });
      if (game.selected === slot.index) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 4;
        rr(ctx, slot.x - 3, slot.y - 3, slot.w + 6, slot.h + 6, 14);
        ctx.stroke();
      }
    }
    if (game.hand.length === 0) text(ctx, 'No cards in hand — end your turn to draw.', 640, 580, 20, MUTED, 'center', 500);
    text(ctx, 'Click a card to play it  •  1-7 also work', 640, 716, 15, MUTED, 'center', 500);
  }

  function drawAnims(game) {
    for (const anim of game.anims) {
      const p = Math.min(1, anim.t / anim.dur);
      const ease = 1 - (1 - p) * (1 - p);
      const x = anim.from.x + (anim.to.x - anim.from.x) * ease;
      const y = anim.from.y + (anim.to.y - anim.from.y) * ease - Math.sin(p * Math.PI) * 60;
      drawCardFace(ctx, anim.card, x - 60, y - 82, 120, 164, { alpha: 1 - p * 0.3 });
    }
    for (const f of game.floaters) {
      const p = Math.min(1, f.t / 1.1);
      ctx.globalAlpha = 1 - p;
      text(ctx, f.text, f.x, f.y - p * 46, 34, f.color, 'center', 800);
      ctx.globalAlpha = 1;
    }
  }

  function draw(game, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08130d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    drawTable();
    const lay = layout(game);
    if (screen === SCREEN_TITLE) {
      // Title: the Warden's flame, the name, a fanned hand of sample cards.
      drawElement(ctx, 'flame', 640, 120, 56, EMBER);
      text(ctx, 'EMBER DUEL', 640, 230, 84, CREAM, 'center', 800);
      text(ctx, 'A battle of cards against the Ember Warden', 640, 272, 24, GOLD, 'center', 500);
      const sample = [
        { id: 'strike', name: 'Strike', cost: 1, element: 'flame', dmg: 3, text: 'Deal 3 damage.' },
        { id: 'ember', name: 'Ember Burst', cost: 2, element: 'flame', dmg: 4, burn: 2, burnTurns: 2, text: 'Deal 4 damage. Burn 2 for 2 turns.' },
        { id: 'guard', name: 'Guard', cost: 1, element: 'leaf', block: 5, text: 'Gain 5 Block.' },
      ];
      sample.forEach((card, i) => drawCardFace(ctx, card, 400 + i * 170, 300, CARD.w, CARD.h, {}));
      const pb = lay.playBtn;
      ctx.fillStyle = EMBER;
      rr(ctx, pb.x, pb.y, pb.w, pb.h, 14);
      ctx.fill();
      text(ctx, 'PLAY', pb.x + pb.w / 2, pb.y + 42, 30, '#fff', 'center', 800);
      text(ctx, 'You: 30 HP  •  Warden: 30 HP  •  Read its intent, then answer it', 640, 625, 20, MUTED, 'center', 500);
      text(ctx, 'Click a card to play it. End Turn passes. First to 0 HP loses.', 640, 657, 20, MUTED, 'center', 500);
      return;
    }
    drawEnemy(game);
    drawHud(game, lay);
    drawHand(game, lay);
    drawAnims(game);
    if (screen === SCREEN_WIN) {
      drawPanel(ctx, 'YOU WIN!', [
        `The Ember Warden crumbles to ash in ${game.stats.turns} turns.`,
        `Cards played: ${game.stats.played}  •  Damage dealt: ${game.stats.damageDealt}`,
      ], 'Press Space or click Play Again', EMBER);
      const b = lay.againBtn;
      ctx.fillStyle = EMBER;
      rr(ctx, b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      text(ctx, 'PLAY AGAIN', b.x + b.w / 2, b.y + 42, 24, '#fff', 'center', 800);
    } else if (screen === SCREEN_LOSS) {
      drawPanel(ctx, 'YOU LOSE', [
        `The Warden overwhelms you on turn ${game.stats.turns}.`,
        `Damage dealt: ${game.stats.damageDealt}  •  Cards played: ${game.stats.played}`,
      ], 'Press Space or click Play Again', '#7c2d12');
      const b = lay.againBtn;
      ctx.fillStyle = '#7c2d12';
      rr(ctx, b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      text(ctx, 'PLAY AGAIN', b.x + b.w / 2, b.y + 42, 24, '#fff', 'center', 800);
    }
  }

  return { draw, view, layout };
}
