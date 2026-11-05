"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import data from "./data.json";
import { cacheCharacter, getCachedCharacter } from "./lib/character-selection";

type GameIcon = "bolt" | "book" | "target" | "crown";
type GameTone = "orange" | "blue" | "purple" | "green";
type Game = { category: string; description: string; icon: GameIcon; id: string; route: string; title: string; tone: GameTone };
type Character = { description: string; gameAsset: string; name: string; portraitAsset: string; slug: string; tone: GameTone };
const games = data.games as Game[];
const characters = data.characters as Character[];
const topPlayers = data.topPlayers;

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
  const [selectedCharacter, setSelectedCharacter] = useState(() => getCachedCharacter().slug);

  const chooseCharacter = (slug: string) => {
    setSelectedCharacter(slug);
    cacheCharacter(slug);
    window.location.reload();
  };

  return (
    <main>
      <header className="site-header">
        <button className="login-button">Login</button>
        <h1>Know Your Candidate</h1>
        <span className="header-space" />
      </header>

      {activeTab === "games" && (
        <section className="games-home" aria-label="Game list">
          <div className="section-label">CHOOSE A GAME</div>
          <div className="game-list">
            {games.map((game, index) => {
              const content = <><span className={`game-art tone-${game.tone}`}><span className="game-number">0{index + 1}</span><span className="game-icon"><Icon name={game.icon} size={25} /></span><span className="art-ring ring-one" /><span className="art-ring ring-two" /></span><span className="game-details"><span className="game-category">{game.category}</span><strong>{game.title}</strong><span className="game-description">{game.description}</span><span className="play-label">Play now <span>→</span></span></span></>;
              return index === 0 ? <Link className="game-card" href={game.route} key={game.title}>{content}</Link> : <button className="game-card" key={game.title}>{content}</button>;
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
                <span className={`character-art tone-${character.tone}`}><Image src={character.portraitAsset.replace("/portrait.png", "/banner.png")} alt={`${character.name} banner`} width={70} height={70} /><small>0{index + 1}</small></span>
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
          <div className="ranking-period"><span className="selected">This week</span><span>All time</span></div>
          <div className="leaderboard">{topPlayers.map(([name, points, initials, tone], index) => <div className={`player-row player-${tone}`} key={name}><span className="player-rank">{index + 1}</span><span className="player-avatar">{initials}</span><span className="player-name">{name}</span><span className="player-score">{points}<small> pts</small></span></div>)}</div>
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
