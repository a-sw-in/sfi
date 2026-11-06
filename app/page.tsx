"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import data from "./data.json";
import { cacheCharacter, getCachedCharacter } from "./lib/character-selection";
import { getCachedPlayer, type CachedPlayer } from "./lib/player-session";
import { supabase } from "./lib/supabase";

type GameIcon = "bolt" | "book" | "target" | "crown";
type GameTone = "orange" | "blue" | "purple" | "green";
type Game = { description: string; id: string; imageAsset: string; route: string; title: string; tone: GameTone };
type Character = { description: string; gameAsset: string; name: string; portraitAsset: string; slug: string; tone: GameTone };
const games = data.games as Game[];
const characters = data.characters as Character[];
type RankingPlayer = { name: string; phone: string; points: number };

function Icon({ name, size = 22 }: { name: GameIcon; size?: number }) {
  const paths = {
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    crown: <path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" />,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4V2m8 10h2M12 20v2M4 12H2" /></>,
  };
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</g></svg>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"games" | "characters" | "ranking">("games");
  const [selectedCharacter, setSelectedCharacter] = useState(data.characters[0].slug);
  const [bannerVersion, setBannerVersion] = useState<string | null>(null);
  const [player, setPlayer] = useState<CachedPlayer | null>(null);
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedCharacter(getCachedCharacter().slug);
      setBannerVersion(String(Date.now()));
      setPlayer(getCachedPlayer());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab !== "ranking") return;

    let active = true;
    const timer = window.setTimeout(() => {
      setRankingLoading(true);
      setRankingError("");
      void supabase
        .from("players")
        .select("name, phone, points")
        .order("points", { ascending: false })
        .then(({ data: players, error }) => {
          if (!active) return;
          if (error) {
            console.error("Unable to load leaderboard", error);
            setRankingError("Leaderboard could not be loaded. Please try again.");
            setRankingLoading(false);
            return;
          }
          setRanking((players ?? []).map((item) => ({ name: item.name, phone: String(item.phone), points: Number(item.points ?? 0) })));
          setRankingLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeTab]);

  const chooseCharacter = (slug: string) => {
    setSelectedCharacter(slug);
    cacheCharacter(slug);
    window.location.reload();
  };

  return (
    <main>
      <header className="site-header">
        {player ? <span className="logged-in-user">{player.name}</span> : <Link className="login-button" href="/login">Login</Link>}
        <h1>Know Your Candidate</h1>
        <span className="header-space" />
      </header>

      {activeTab === "games" && (
        <section className="games-home" aria-label="Game list">
          <div className="section-label">CHOOSE A GAME</div>
          <div className="game-list">
            {games.map((game) => {
              const content = <><span className={`game-art tone-${game.tone}`}><Image className="game-image" src={game.imageAsset} alt={`${game.title} icon`} width={42} height={42} /></span><span className="game-details"><strong>{game.title}</strong><span className="game-description">{game.description}</span></span></>;
              return <Link className="game-card" href={game.route} key={game.title}>{content}</Link>;
            })}
          </div>
        </section>
      )}

      {activeTab === "characters" && (
        <section className="characters-home" aria-label="Character list">
          <div className="section-label">CHOOSE YOUR CHARACTER</div>
          <h2>Find your game style.</h2>
          <div className="character-grid">
            {characters.map((character, index) => (
              <button className={`character-card ${selectedCharacter === character.slug ? "selected-character" : ""}`} key={character.name} onClick={() => chooseCharacter(character.slug)}>
                <span className={`character-art tone-${character.tone}`}><Image src={`${character.portraitAsset.replace("/portrait.png", "/banner.png")}${bannerVersion ? `?v=${bannerVersion}` : ""}`} alt={`${character.name} banner`} width={70} height={70} /><small>0{index + 1}</small></span>
                <span className="character-info"><strong>{character.name}</strong><span>{character.description}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "ranking" && (
        <section className="ranking-home" aria-label="Top ranked players">
          <div className="section-label">TOP PLAYERS</div>
          <h2>Climb the leaderboard.</h2>
          {!player && <div className="leaderboard-login-box"><strong>Want to enter the leaderboard?</strong><span>Login and play to see your name ranked here.</span><Link className="leaderboard-login-button" href="/login">Login</Link></div>}
          {rankingLoading && <p className="leaderboard-status">Loading leaderboard...</p>}
          {rankingError && <p className="leaderboard-status leaderboard-error" role="alert">{rankingError}</p>}
          {!rankingLoading && !rankingError && <div className="leaderboard">{ranking.map((rankedPlayer, index) => {
            const isCurrentPlayer = player?.phone === rankedPlayer.phone;
            return <div className={`player-row ${index < 3 ? `player-podium player-podium-${index + 1}` : ""} ${isCurrentPlayer ? "player-current" : ""}`} key={`${rankedPlayer.name}-${index}`}><span className="player-rank">{index + 1}</span><span className="player-name">{rankedPlayer.name}</span>{isCurrentPlayer && <span className="player-you">YOU</span>}<span className="player-score">{rankedPlayer.points.toLocaleString()}<small> pts</small></span></div>;
          })}</div>}<p className="site-credit">© 2026 SFIUCE. All rights reserved. Designed and Developed by <strong><a href="http://github.com/a-sw-in">Aswin S</a></strong></p>
        </section>
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={activeTab === "games" ? "active" : ""} onClick={() => setActiveTab("games")}><Icon name="bolt" size={20} /><span>Games</span></button>
        <button className={activeTab === "characters" ? "active" : ""} onClick={() => setActiveTab("characters")}><span className="nav-character">●</span><span>Character</span></button>
        <button className={activeTab === "ranking" ? "active" : ""} onClick={() => setActiveTab("ranking")}><Icon name="crown" size={20} /><span>Ranking</span></button>
      </nav>
    </main>
  );
}
