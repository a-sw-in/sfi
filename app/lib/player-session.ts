export type CachedPlayer = {
  name: string;
  phone: string;
};

const playerCacheKey = "kyc-logged-in-player";

export function cachePlayer(player: CachedPlayer) {
  window.localStorage.setItem(playerCacheKey, JSON.stringify(player));
}

export function getCachedPlayer(): CachedPlayer | null {
  if (typeof window === "undefined") return null;

  const cached = window.localStorage.getItem(playerCacheKey);
  if (!cached) return null;

  try {
    const player = JSON.parse(cached) as CachedPlayer;
    if (player.name && player.phone) return player;
  } catch {
    window.localStorage.removeItem(playerCacheKey);
  }

  return null;
}

export function getCachedPlayerPhone() {
  return getCachedPlayer()?.phone ?? null;
}
