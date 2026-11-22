// Ember Duel — the opponent (ai.js). One job: decide what the Ember Warden does
// and do it. The intent is chosen at the START of the player's turn and shown
// on screen (icon + number) before it happens, so the player can read it and
// counter it — Guard against a big attack, race a defend, Mend after a burn.
//
// AI shape: a simple weighted table that gets meaner as the match goes on.
// Early turns it pokes; from turn 3 it can wind up a Heavy attack, and when the
// player is low it favours finishing blows. It never hides information: the
// intent it shows is exactly the intent it executes.

import { addLog, dealDamage, tickBurn } from './state.js';

/**
 * Pick the Warden's next intent. `game.turn` is the turn just starting.
 * Returns { kind: 'attack'|'defend'|'burn', amount, burn?, label }.
 */
export function chooseIntent(game) {
  const r = game.random();
  const playerLow = game.player.hp <= 10;
  const turn = game.turn;

  // Turn 1-2: teach the player the read — a plain attack, then a defend.
  if (turn <= 1) return { kind: 'attack', amount: 5, label: 'Attack 5' };
  if (turn === 2) return { kind: 'defend', amount: 6, label: 'Guard 6' };

  if (playerLow && r < 0.45) {
    return { kind: 'attack', amount: 8, label: 'Attack 8' };
  }
  if (r < 0.45) {
    const amount = 5 + Math.floor(game.random() * 3); // 5-7
    return { kind: 'attack', amount, label: `Attack ${amount}` };
  }
  if (r < 0.68) {
    const amount = 5 + Math.floor(game.random() * 3); // 5-7
    return { kind: 'defend', amount, label: `Guard ${amount}` };
  }
  if (r < 0.85) {
    return { kind: 'attack', amount: 9, label: 'Heavy 9' };
  }
  return { kind: 'burn', amount: 4, burn: 2, label: 'Ember 4 + Burn 2' };
}

/**
 * Run the enemy's turn: burn ticks first, then the shown intent executes,
 * then a fresh intent is chosen for the next player turn.
 * Returns events for animation + sound: [{ type, amount }].
 */
export function enemyAct(game) {
  const events = [];
  const burned = tickBurn(game.enemy);
  if (burned > 0) {
    events.push({ type: 'burnTick', amount: burned, target: 'enemy' });
    addLog(game, `Burn scorches the Warden for ${burned}.`);
  }
  if (game.enemy.hp <= 0) {
    game.enemy.hp = 0;
    game.phase = 'win';
    addLog(game, 'The burn finished the Warden. You win!');
    return events;
  }

  const intent = game.intent;
  if (!intent) return events;
  game.enemy.block = 0; // the Warden's block refreshes each of its turns too

  if (intent.kind === 'attack') {
    const lost = dealDamage(game.player, intent.amount);
    game.stats.damageTaken += lost;
    events.push({ type: 'damage', amount: lost, target: 'player' });
    addLog(game, `Warden attacks for ${intent.amount} (${lost} got through).`);
  } else if (intent.kind === 'burn') {
    const lost = dealDamage(game.player, intent.amount);
    game.stats.damageTaken += lost;
    game.player.burn = intent.burn;
    game.player.burnTurns = 2;
    events.push({ type: 'damage', amount: lost, target: 'player' });
    events.push({ type: 'burn', amount: intent.burn, target: 'player' });
    addLog(game, `Warden hurls embers: ${intent.amount} damage, you burn.`);
  } else {
    game.enemy.block += intent.amount;
    events.push({ type: 'block', amount: intent.amount, target: 'enemy' });
    addLog(game, `Warden guards: +${intent.amount} Block.`);
  }

  if (game.player.hp <= 0) {
    game.player.hp = 0;
    game.phase = 'loss';
    addLog(game, 'The Warden overwhelms you...');
  }
  return events;
}
