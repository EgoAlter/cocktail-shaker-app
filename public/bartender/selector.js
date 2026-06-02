// Maps a set of answers to the best-matching cocktail.
//
// Why hard-filter on spirit first, then score on flavour + style:
// treating spirit as a scoring input lets a vodka cocktail win a gin query
// if it happens to match on flavour + style. At 10 cocktails that's
// survivable; at a real 30-cocktail menu it produces nonsense results.
// Hard-filtering to the chosen spirit guarantees the answer is always
// honoured, then flavour/style scoring finds the best fit within that pool.
//
// "Surprise me" skips the spirit filter so every cocktail is eligible,
// but still scores on flavour + style — the customer gets a match for
// their taste preferences from any spirit.

export function selectCocktail(cocktails, { spirit, flavour, style }) {
  if (!cocktails?.length) return null;

  const isSurprise = spirit?.toLowerCase() === 'surprise me';

  const pool = isSurprise
    ? cocktails
    : cocktails.filter((c) => {
        const tags = c.tags ? c.tags.split(',').map((t) => t.trim().toLowerCase()) : [];
        return tags.includes(spirit.toLowerCase());
      });

  // Defensive fallback — should not happen with correct seed data
  const candidates = pool.length ? pool : cocktails;

  const answers = [flavour, style].map((a) => a?.toLowerCase()).filter(Boolean);

  let best = null;
  let bestScore = -1;

  for (const cocktail of candidates) {
    const tags = cocktail.tags ? cocktail.tags.split(',').map((t) => t.trim().toLowerCase()) : [];
    const score = answers.reduce((n, answer) => n + (tags.includes(answer) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = cocktail;
    }
  }

  return best;
}
