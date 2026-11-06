import data from "../data.json";

export type CachedCharacter = {
  description: string;
  gameAsset: string;
  name: string;
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
      if (character.slug && data.characters.some((item) => item.slug === character.slug)) {
        return createCharacter(character.slug);
      }
    } catch {
      // Replace invalid cached data with the first character.
    }
    window.localStorage.removeItem(cacheKey);
  }

  const legacySlug = window.localStorage.getItem("kyc-selected-character");
  if (legacySlug && data.characters.some((item) => item.slug === legacySlug)) {
    const character = createCharacter(legacySlug);
    window.localStorage.setItem(cacheKey, JSON.stringify(character));
    return character;
  }

  const defaultCharacter = createCharacter(data.characters[0].slug);
  window.localStorage.setItem(cacheKey, JSON.stringify(defaultCharacter));
  window.localStorage.setItem("kyc-selected-character", defaultCharacter.slug);
  return defaultCharacter;
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
    description: character.description,
    gameAsset: character.gameAsset,
    name: character.name,
    portraitAsset: character.portraitAsset,
    slug: character.slug,
  };
}
