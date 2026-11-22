// Ember Duel — the cards (deck.js).
// GDD in brief: a turn-based ember battle. One job per file; this file only knows
// what a card is, what the starting deck holds, and how to shuffle and draw it.
// Suits are elements, told apart by colour AND shape (flame, drop, leaf, spark),
// never by a playing-card suit, so the game is original and colour-blind friendlier.
//
// Card economy (tuned for a 3-5 minute match, 30 HP each side):
//   Strike 1 energy / 3 dmg — the workhorse. Heavy Blow 2 / 6 dmg — the finisher.
//   Guard 1 / +5 block — the answer to a telegraphed attack.
//   Ember Burst 2 / 4 dmg + burn 2 for 2 turns — damage that keeps working.
//   Mend 2 / heal 5 — the comeback card. Spark Chain 3 / 2 dmg x3 — the big turn.

export const ELEMENTS = {
  flame: { color: '#ff6b35', dark: '#c73e1d', label: 'Flame' },
  drop: { color: '#4fc3f7', dark: '#1565c0', label: 'Drop' },
  leaf: { color: '#66bb6a', dark: '#2e7d32', label: 'Leaf' },
  spark: { color: '#ffd54f', dark: '#f9a825', label: 'Spark' },
};

export const CARD_DEFS = {
  strike: {
    id: 'strike', name: 'Strike', cost: 1, element: 'flame',
    dmg: 3, text: 'Deal 3 damage.',
  },
  heavy: {
    id: 'heavy', name: 'Heavy Blow', cost: 2, element: 'spark',
    dmg: 6, text: 'Deal 6 damage.',
  },
  guard: {
    id: 'guard', name: 'Guard', cost: 1, element: 'leaf',
    block: 5, text: 'Gain 5 Block.',
  },
  ember: {
    id: 'ember', name: 'Ember Burst', cost: 2, element: 'flame',
    dmg: 4, burn: 2, burnTurns: 2, text: 'Deal 4 damage. Burn 2 for 2 turns.',
  },
  mend: {
    id: 'mend', name: 'Mend', cost: 2, element: 'drop',
    heal: 5, text: 'Restore 5 HP.',
  },
  spark: {
    id: 'spark', name: 'Spark Chain', cost: 3, element: 'spark',
    dmg: 2, hits: 3, text: 'Deal 2 damage x 3.',
  },
};

// The starting deck: 12 cards. Three Strikes and three Guards keep every hand
// playable; the expensive cards are one-offs so a big turn feels earned.
export const DECK_LIST = [
  'strike', 'strike', 'strike',
  'guard', 'guard', 'guard',
  'heavy', 'heavy',
  'ember', 'ember',
  'mend',
  'spark',
];

export const HAND_MAX = 7;
export const HAND_START = 4;

/** A fresh copy of the starting deck: new card objects, in list order. */
export function buildDeck() {
  return DECK_LIST.map((id, index) => ({ ...CARD_DEFS[id], uid: index }));
}

/** Fisher-Yates shuffle in place, driven by the game's seeded random. */
export function shuffle(deck, random) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/**
 * Draw up to `count` cards from `deck` into `hand` (hand cap enforced).
 * An empty deck reshuffles the discard pile back in; with both empty, no draw.
 * Returns how many cards were actually drawn.
 */
export function drawCards(deck, discard, hand, count, random) {
  let drawn = 0;
  for (let n = 0; n < count; n += 1) {
    if (hand.length >= HAND_MAX) break;
    if (deck.length === 0) {
      if (discard.length === 0) break;
      while (discard.length > 0) deck.push(discard.pop());
      if (random) shuffle(deck, random);
    }
    hand.push(deck.pop());
    drawn += 1;
  }
  return drawn;
}
