import data from "../data.json";

export type CachedCharacter = {
  gameAsset: string;
  portraitAsset: string;
  slug: string;
};

const cacheKey = "kyc-selected-character-cache";

export function getCachedCharacter(): CachedCharacter {
  if (typeof window === "undefined") {
    return createCharacter("decoder");
  }

  const cached = window.localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const character = JSON.parse(cached) as CachedCharacter;
      if (character.slug && character.gameAsset && character.portraitAsset) {
        return character;
      }
    } catch {
      // Remove invalid cached data and fall back to the default character.
      window.localStorage.removeItem(cacheKey);
    }
  }

  const legacySlug = window.localStorage.getItem("kyc-selected-character") ?? "decoder";
  return createCharacter(legacySlug);
}

export function cacheCharacter(slug: string): CachedCharacter {
  const character = createCharacter(slug);
  window.localStorage.setItem(cacheKey, JSON.stringify(character));
  window.localStorage.setItem("kyc-selected-character", slug);
  return character;
}

function createCharacter(slug: string): CachedCharacter {
  const character = data.characters.find((item) => item.slug === slug) ?? data.characters[0];
  return {
    gameAsset: character.gameAsset,
    portraitAsset: character.portraitAsset,
    slug: character.slug,
  };
}
