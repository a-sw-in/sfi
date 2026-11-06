"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import data from "../../data.json";
import { addPlayerPoints } from "../../lib/player-points";
import { getCachedPlayerPhone } from "../../lib/player-session";
import { useGame } from "../../store/gameStore";

const TOTAL_ROUNDS = 7;
const CANDIDATES_PER_ROUND = 4;
type Candidate = (typeof data.characters)[number];
type MatchState = Record<string, string>;
type SelectedSide = "image" | "name" | null;

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function createRounds(): Candidate[][] {
  return Array.from({ length: TOTAL_ROUNDS }, () => shuffle(data.characters).slice(0, CANDIDATES_PER_ROUND));
}

export default function MatchTheCandidate() {
  const [rounds, setRounds] = useState<Candidate[][]>([]);
  const [round, setRound] = useState(0);
  const [matches, setMatches] = useState<MatchState>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<SelectedSide>(null);
  const [wrongMatch, setWrongMatch] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const pointsAwardedRef = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const muted = useGame((state) => state.muted);
  const toggleMute = useGame((state) => state.toggleMute);
  const candidates = useMemo(() => rounds[round] ?? [], [rounds, round]);
  const names = useMemo(() => shuffle(candidates), [candidates]);
  const matchedSlugs = new Set(Object.keys(matches));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRounds(createRounds()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!finished || pointsAwardedRef.current) return;

    const playerPhone = getCachedPlayerPhone();
    if (!playerPhone) return;

    pointsAwardedRef.current = true;
    void addPlayerPoints(playerPhone, score).catch((error) => {
      pointsAwardedRef.current = false;
      console.error("Unable to save Match the Candidate points", error);
    });
  }, [finished, score]);

  const playSound = (frequency: number, duration: number, type: OscillatorType = "sine") => {
    if (muted) return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  const selectCandidate = (slug: string, side: Exclude<SelectedSide, null>) => {
    if (matchedSlugs.has(slug)) return;
    if (!selectedSlug) {
      setSelectedSlug(slug);
      setSelectedSide(side);
      playSound(420, 0.08, "sine");
      return;
    }
    if (slug !== selectedSlug || side === selectedSide) {
      if (slug !== selectedSlug && side !== selectedSide) {
        setWrongMatch(true);
        window.setTimeout(() => setWrongMatch(false), 350);
        setScore((value) => value - 100);
        playSound(150, 0.25, "sawtooth");
        setSelectedSlug(null);
        setSelectedSide(null);
        return;
      }
      setSelectedSlug(slug);
      setSelectedSide(side);
      return;
    }

    const nextMatches = { ...matches, [slug]: slug };
    setMatches(nextMatches);
    setScore((value) => value + 100);
    playSound(740, 0.12, "triangle");
    setSelectedSlug(null);
    setSelectedSide(null);
    if (Object.keys(nextMatches).length === CANDIDATES_PER_ROUND) setRoundComplete(true);
  };

  const nextRound = () => {
    if (!roundComplete) return;
    if (round === TOTAL_ROUNDS - 1) {
      playSound(880, 0.18, "triangle");
      window.setTimeout(() => playSound(1175, 0.3, "triangle"), 130);
      setFinished(true);
      return;
    }
    playSound(520, 0.18, "sine");
    setRound((value) => value + 1);
    setMatches({});
    setRoundComplete(false);
  };

  const restart = () => {
    window.location.reload();
  };

  if (finished) {
    return (
      <main className="is-playing match-game">
        <header className="site-header">
          <Link className="back-button" href="/">← Back</Link>
          <h1>Know Your Candidate</h1>
          <span className="header-space" />
        </header>
        <section className="match-complete">
          <div className="section-label">ALL ROUNDS COMPLETE</div>
          <h2>Candidate expert.</h2>
          <p>You matched all 28 candidates correctly.</p>
          <strong>{score.toLocaleString()} points</strong>
          <button type="button" onClick={restart}>PLAY AGAIN</button>
          <Link className="match-back-link" href="/">BACK TO HOME</Link>
        </section>
        <button className="match-mute-button" type="button" onClick={toggleMute}>{muted ? "🔇" : "🔊"}</button>
      </main>
    );
  }

  if (!rounds.length) {
    return <main className="is-playing match-game"><div className="match-loading">Preparing candidates...</div></main>;
  }

  return (
    <main className="is-playing match-game">
      <header className="site-header">
        <Link className="back-button" href="/">← Back</Link>
        <h1>Know Your Candidate</h1>
        <span className="header-space" />
      </header>
      <section className="match-game-content" aria-label="Match the Candidate game">
        <div className="match-game-heading">
          <div>
            <div className="section-label">MATCH THE CANDIDATE</div>
            <h2>Who is who?</h2>
          </div>
          <div className="match-score"><small>SCORE</small><strong>{score}</strong></div>
        </div>
        <div className="match-progress">ROUND {round + 1} OF {TOTAL_ROUNDS} · MATCH AN IMAGE TO A NAME</div>
        <div className={`match-board ${wrongMatch ? "match-wrong" : ""}`}>
          <svg className="match-lines" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
            {Object.keys(matches).map((slug) => {
              const imageIndex = candidates.findIndex((candidate) => candidate.slug === slug);
              const nameIndex = names.findIndex((candidate) => candidate.slug === slug);
              const y1 = ((imageIndex * 68 + 29) / 262) * 100;
              const y2 = ((nameIndex * 68 + 29) / 262) * 100;
              return <line key={slug} x1="19" x2="52" y1={y1} y2={y2} />;
            })}
          </svg>
          <div className="match-column">
            {candidates.map((candidate) => (
              <button
                className={`match-image-card ${selectedSlug === candidate.slug && selectedSide === "image" ? "match-selected" : ""} ${matchedSlugs.has(candidate.slug) ? "match-done" : ""}`}
                disabled={matchedSlugs.has(candidate.slug)}
                key={candidate.slug}
                onClick={() => selectCandidate(candidate.slug, "image")}
                type="button"
              >
                <Image src={`/characters/${candidate.slug}/banner.png`} alt={candidate.name} width={220} height={92} unoptimized />
              </button>
            ))}
          </div>
          <div className="match-column match-name-column">
            {names.map((candidate) => (
              <button
                className={`match-name-card ${selectedSlug === candidate.slug && selectedSide === "name" ? "match-selected" : ""} ${matchedSlugs.has(candidate.slug) ? "match-done" : ""}`}
                disabled={matchedSlugs.has(candidate.slug)}
                key={candidate.slug}
                onClick={() => selectCandidate(candidate.slug, "name")}
                type="button"
              >
                <strong>{candidate.name}</strong>
                <small>{candidate.description}</small>
              </button>
            ))}
          </div>
        </div>
        <p className="match-hint">{selectedSlug ? "Now choose the matching name." : roundComplete ? "Round complete!" : "Choose a candidate banner to begin."}</p>
        {roundComplete && <button className="match-next-button" type="button" onClick={nextRound}>{round === TOTAL_ROUNDS - 1 ? "FINISH GAME" : "NEXT ROUND →"}</button>}
      </section>
      <button className="match-mute-button" type="button" onClick={toggleMute}>{muted ? "🔇" : "🔊"}</button>
    </main>
  );
}
