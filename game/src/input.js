// Ember Duel — input (input.js). One job: turn raw pointer and keyboard events
// into game actions. It knows nothing about rules; it hands the main loop a
// logical (1280x720) click point and one-shot key actions, and the loop decides
// what they mean on the current screen.
//
// Pointer: click a card to play it, End Turn to pass, Play / Play Again to start.
// Keys: 1-7 play a hand card, E ends the turn, Space/Enter confirms (start,
// restart), R restarts after a win or loss, M mutes, P pauses the table music
// (there is none — P is reserved, not a trap).

export const KEY_PLAY = 'play'; // Space / Enter on title / win / loss screens
export const KEY_END = 'end'; // E — end turn
export const KEY_RESTART = 'restart'; // R — restart after win/loss
export const KEY_MUTE = 'mute'; // M

export function createInput(canvas, toLogical, handlers) {
  function onPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1280;
    const y = ((event.clientY - rect.top) / rect.height) * 720;
    handlers.click(toLogical(x, y));
  }
  canvas.addEventListener('pointerdown', onPointer);

  function onKey(event) {
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      handlers.key(KEY_PLAY);
      event.preventDefault();
    } else if (event.code === 'KeyE') {
      handlers.key(KEY_END);
    } else if (event.code === 'KeyR') {
      handlers.key(KEY_RESTART);
    } else if (event.code === 'KeyM') {
      handlers.key(KEY_MUTE);
    } else if (/^Digit[1-7]$/.test(event.code)) {
      handlers.card(Number(event.code.slice(5)) - 1);
    }
  }
  window.addEventListener('keydown', onKey);

  return {
    destroy() {
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    },
  };
}
