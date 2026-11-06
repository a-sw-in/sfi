"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useGame } from "../../store/gameStore";
import data from "../../data.json";
import { getCachedCharacter, type CachedCharacter } from "../../lib/character-selection";
import { getCachedPlayer, getCachedPlayerPhone } from "../../lib/player-session";
import { addPlayerPoints } from "../../lib/player-points";

const Scene = dynamic(() => import("./GameScene"), {
  ssr: false,
  loading: () => <div className="subway-three-loading">Loading Subway...</div>,
});

export default function Game() {
  const mode = useGame((state) => state.mode);
  const score = useGame((state) => state.score);
  const coins = useGame((state) => state.coins);
  const best = useGame((state) => state.best);
  const start = useGame((state) => state.start);
  const pause = useGame((state) => state.pause);
  const resume = useGame((state) => state.resume);
  const reset = useGame((state) => state.reset);
  const hydrateBest = useGame((state) => state.hydrateBest);
  const muted = useGame((state) => state.muted);
  const toggleMute = useGame((state) => state.toggleMute);
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CachedCharacter>(() => data.characters[0]);
  const pointsAwardedRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsLoggedIn(getCachedPlayer() !== null);
      setSelectedCharacter(getCachedCharacter());
      hydrateBest();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrateBest]);

  useEffect(() => {
    if (mode === "playing") {
      pointsAwardedRef.current = false;
      return;
    }
    if (mode !== "over" || pointsAwardedRef.current) return;

    const playerPhone = getCachedPlayerPhone();
    if (!playerPhone) return;

    pointsAwardedRef.current = true;
    void addPlayerPoints(playerPhone, coins * 10).catch((error) => {
      pointsAwardedRef.current = false;
      console.error("Unable to save Subway Surf points", error);
    });
  }, [coins, mode]);

  const goToMainMenu = () => {
    reset();
    router.push("/");
  };

  return (
    <main className="subway-three-game">
      <Scene />
      <div className="subway-three-vignette" />
      <div className="subway-three-title">
        <div>{selectedCharacter.name}</div>
        <small>{selectedCharacter.description}</small>
      </div>
      {mode === "playing" && (
        <>
          <div className="subway-three-score"><small>SCORE</small><strong>{score.toLocaleString()}</strong></div>
          <div className="subway-three-coins">🪙 {coins}<button type="button" onClick={pause}>Ⅱ</button></div>
          <div className="subway-three-help">← → change lane · ↑ jump · ↓ slide</div>
        </>
      )}
      {mode !== "playing" && (
        <div className="subway-three-overlay">
          <section>
            <div className="subway-three-character-panel">
              <Image
                src={`/characters/${selectedCharacter.slug}/subway.gif?v=1`}
                alt={selectedCharacter.name}
                width={123}
                height={179}
                unoptimized
                priority
                style={{ height: "auto" }}
              />
            </div>
            <div className="subway-three-menu-content">
              <h2 className="subway-three-character-name">{selectedCharacter.name}</h2>
              <p className="subway-three-character-description">{selectedCharacter.description}</p>
              <div className="subway-three-kicker">ENDLESS RUNNER</div>
              <h1>SUBWAY</h1>
              {mode === "menu" && <><p>Dodge trains. Grab coins. Keep running.</p><button type="button" onClick={start}>▶ PLAY</button><small>Best score: {best.toLocaleString()}</small></>}
              {mode === "paused" && <><h2>PAUSED</h2><button type="button" onClick={resume}>RESUME</button><button className="secondary" type="button" onClick={goToMainMenu}>MAIN MENU</button></>}
              {mode === "over" && <><h2>RUN OVER</h2><p>Score {score.toLocaleString()} · Coins {coins}</p><div className="subway-three-best-score">BEST SCORE <strong>{best.toLocaleString()}</strong></div><button type="button" onClick={start}>RUN AGAIN</button>{isLoggedIn ? <button className="secondary" type="button" onClick={goToMainMenu}>MAIN MENU</button> : <><div className="subway-three-actions"><button className="secondary" type="button" onClick={() => router.push("/login")}>LOGIN</button><button className="secondary" type="button" onClick={goToMainMenu}>MAIN MENU</button></div><small className="subway-three-login-note">Login to enter the leaderboard.</small></>}</>}
            </div>
          </section>
        </div>
      )}
      <button className="subway-three-mute" type="button" onClick={toggleMute}>{muted ? "🔇" : "🔊"}</button>
    </main>
  );
}
