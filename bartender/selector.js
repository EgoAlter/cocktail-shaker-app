// Maps a set of answers to the best-matching cocktail via tag scoring.
// Tag scoring survives a real menu with 30+ cocktails without if-else chains.

export function selectCocktail(cocktails, { spirit, flavour, style }) {
  if (!cocktails?.length) return null;

  // "Surprise me" bypasses tag scoring — return a random cocktail.
  // Keeps the DB clean: no 'surprise me' tag needed in any cocktail record.
  if (spirit?.toLowerCase() === 'surprise me') {
    return cocktails[Math.floor(Math.random() * cocktails.length)];
  }

  const answers = [spirit, flavour, style].map((a) => a?.toLowerCase()).filter(Boolean);

  let best = null;
  let bestScore = -1;

  for (const cocktail of cocktails) {
    const tags = cocktail.tags ? cocktail.tags.split(',').map((t) => t.trim().toLowerCase()) : [];
    const score = answers.reduce((n, answer) => n + (tags.includes(answer) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = cocktail;
    }
  }

  return best;
}
