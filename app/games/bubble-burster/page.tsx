"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import data from "../../data.json";
import { addPlayerPoints } from "../../lib/player-points";
import { getCachedPlayerPhone } from "../../lib/player-session";

const SECTIONS_PER_ROUND = 5;
const SECTION_DURATION = 6500;

type Candidate = (typeof data.characters)[number];
type Feedback = "correct" | "wrong" | null;
type Bubble = { id: string; candidate: Candidate; left: number; delay: number };

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function createSections(target: Candidate): Candidate[][] {
  const allCandidates = shuffle(data.characters);
  const sections = Array.from({ length: SECTIONS_PER_ROUND }, () => [] as Candidate[]);
  allCandidates.forEach((candidate, index) => sections[index % SECTIONS_PER_ROUND].push(candidate));
  sections.forEach((section) => {
    if (section.length < 3 && !section.some((candidate) => candidate.slug === target.slug) && Math.random() < 0.4) {
      section.push(target);
    }
  });
  return sections;
}

function createBubbles(candidates: Candidate[], section: number): Bubble[] {
  const columns = window.innerWidth < 430 ? 1 : window.innerWidth < 680 ? 2 : 3;
  return shuffle(candidates).map((candidate, index) => ({
    id: `${candidate.slug}-${section}-${Date.now()}-${index}`,
    candidate,
    left: ((index % columns) + 1) * (100 / (columns + 1)),
    delay: index * 0.18,
  }));
}

export default function BubbleBurster() {
  const [targets, setTargets] = useState<Candidate[]>([]);
  const [sections, setSections] = useState<Candidate[][]>([]);
  const [round, setRound] = useState(0);
  const [section, setSection] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [popped, setPopped] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const poppedThisRound = useRef(false);
  const pointsAwardedRef = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const target = targets[round];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nextTargets = shuffle(data.characters);
      setTargets(nextTargets);
      setSections(createSections(nextTargets[0]));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!targets.length || !sections.length) return;
    const frame = window.requestAnimationFrame(() => {
      if (section === 0) poppedThisRound.current = false;
      setBubbles(createBubbles(sections[section], section));
      setPopped([]);
      setFeedback(null);
    });
    const timer = window.setTimeout(() => {
      if (section === SECTIONS_PER_ROUND - 1) {
        if (!poppedThisRound.current) setScore((value) => value - 3);
        if (round === targets.length - 1) setFinished(true);
        else setRoundComplete(true);
      } else {
        setSection((value) => value + 1);
      }
    }, SECTION_DURATION);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [round, section, sections, targets]);

  useEffect(() => {
    if (!finished || pointsAwardedRef.current) return;
    const playerPhone = getCachedPlayerPhone();
    if (!playerPhone) return;
    pointsAwardedRef.current = true;
    void addPlayerPoints(playerPhone, score, 0.1).catch((error) => {
      pointsAwardedRef.current = false;
      console.error("Unable to save Bubble Burster points", error);
    });
  }, [finished, score]);

  const playSound = (frequency: number, type: OscillatorType) => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  };

  const popBubble = (bubble: Bubble) => {
    if (popped.includes(bubble.id) || !target) return;
    poppedThisRound.current = true;
    setPopped((current) => [...current, bubble.id]);
    if (bubble.candidate.slug === target.slug) {
      setScore((value) => value + 1);
      setFeedback("correct");
      playSound(760, "triangle");
    } else {
      setScore((value) => value - 1);
      setFeedback("wrong");
      playSound(150, "sawtooth");
    }
    window.setTimeout(() => setFeedback(null), 420);
  };

  const restart = () => window.location.reload();

  const nextRound = () => {
    setRound((value) => value + 1);
    setSection(0);
    setSections(createSections(targets[round + 1]));
    setRoundComplete(false);
  };

  if (!targets.length || !sections.length) return <main className="bubble-game"><div className="match-loading">Preparing bubbles...</div></main>;

  if (finished) {
    return <main className="bubble-game"><header className="site-header"><Link className="back-button" href="/">← Back</Link><h1>Bubble Burster</h1><span className="header-space" /></header><section className="bubble-complete"><div className="section-label">ALL CANDIDATES COMPLETE</div><h2>Bubble expert.</h2><p>You found every candidate bubble.</p><strong>{score} points</strong><button type="button" onClick={restart}>PLAY AGAIN</button><Link className="match-back-link" href="/">BACK TO HOME</Link></section></main>;
  }

  return <main className={`bubble-game ${feedback === "wrong" ? "bubble-wrong" : ""} ${feedback === "correct" ? "bubble-correct" : ""}`}><header className="site-header"><Link className="back-button" href="/">← Back</Link><h1>Bubble Burster</h1><span className="header-space" /></header><section className="bubble-content" aria-label="Bubble Burster game"><div className="bubble-heading"><div><div className="section-label">BUBBLE BURSTER</div><h2>Pop the right one.</h2></div><div className="match-score"><small>SCORE</small><strong>{score}</strong></div></div><div className="bubble-progress">ROUND {round + 1} OF {targets.length}</div><div className="bubble-target"><strong>{target.name}</strong><span>{target.description}</span></div><div className="bubble-field">{bubbles.map((bubble) => <button className={`candidate-bubble ${popped.includes(bubble.id) ? "bubble-popped" : ""}`} key={bubble.id} onClick={() => popBubble(bubble)} style={{ left: `${bubble.left}%`, animationDelay: `${bubble.delay}s` }} type="button" aria-label={`Pop ${bubble.candidate.name}`}><Image src={`/characters/${bubble.candidate.slug}/banner.png`} alt={bubble.candidate.name} fill sizes="120px" unoptimized /></button>)}{roundComplete && <div className="bubble-round-overlay"><button className="bubble-next-button" onClick={nextRound} type="button">NEXT ROUND</button><p className="bubble-round-note">Finish all rounds to add your points to the leaderboard.</p></div>}</div>{!roundComplete && <p className="bubble-hint">Each section has up to three bubbles. Pop the matching banner before they fly away.</p>}</section></main>;
}
