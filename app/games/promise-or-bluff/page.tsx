"use client";

import Image from "next/image";
import Link from "next/link";
import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import data from "../../data.json";
import { getCachedCharacter } from "../../lib/character-selection";

export default function PromiseOrBluff() {
  const [selectedCharacter] = useState(() => getCachedCharacter().slug);
  const character = data.characters.find((item) => item.slug === selectedCharacter) ?? data.characters[0];
  const [isJumping, setIsJumping] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [obstacleX, setObstacleX] = useState(620);
  const [playerY, setPlayerY] = useState(0);
  const [score, setScore] = useState(0);
  const [obstacleType, setObstacleType] = useState<"cactus" | "bonfire">("cactus");
  const jumpY = useRef(0);
  const jumpVelocity = useRef(0);
  const obstaclePosition = useRef(620);
  const scoreRef = useRef(0);
  const runSpeed = useRef(7);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = "square") => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }, []);

  const jump = useCallback(() => {
    if (gameOver) return;
    if (!gameStarted) {
      setGameStarted(true);
      const startX = (stageRef.current?.clientWidth ?? 300) + 360;
      obstaclePosition.current = startX;
      setObstacleX(startX);
      playSound(330, 0.12);
    }
    if (isJumping) return;
    setIsJumping(true);
    runSpeed.current += 0.3;
    jumpVelocity.current = 15;
    playSound(520, 0.1, "triangle");
    window.setTimeout(() => setIsJumping(false), 650);
  }, [gameStarted, gameOver, isJumping, playSound]);

  const restartGame = useCallback(() => {
    setGameOver(false);
    setGameStarted(false);
    setScore(0);
    scoreRef.current = 0;
    runSpeed.current = 7;
    jumpY.current = 0;
    jumpVelocity.current = 0;
    setPlayerY(0);
    const resetX = (stageRef.current?.clientWidth ?? 300) + 360;
    obstaclePosition.current = resetX;
    setObstacleX(resetX);
    setObstacleType("cactus");
  }, []);

  const handleGameTouch = (event: TouchEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    jump();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jump]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    let frame = 0;
    let lastTime = performance.now();
    const tick = (time: number) => {
      const delta = Math.min(time - lastTime, 40);
      lastTime = time;
      jumpY.current = Math.max(0, jumpY.current + jumpVelocity.current * (delta / 16));
      jumpVelocity.current -= 0.9 * (delta / 16);
      setPlayerY(jumpY.current);
      const stageWidth = stageRef.current?.clientWidth ?? 300;
      const nextX = obstaclePosition.current - runSpeed.current * (delta / 16);
      if (nextX < -85) {
        obstaclePosition.current = stageWidth + 300 + Math.random() * 180;
        setObstacleType(Math.random() > 0.5 ? "cactus" : "bonfire");
        scoreRef.current += 100;
        setScore(scoreRef.current);
        playSound(740, 0.08, "triangle");
      } else {
        obstaclePosition.current = nextX;
      }
      setObstacleX(obstaclePosition.current);
      const playerLeft = stageWidth * 0.18 + 10;
      const playerRight = stageWidth * 0.18 + 78;
      const obstacleLeft = obstaclePosition.current + 8;
      const obstacleRight = obstaclePosition.current + 50;
      const playerBottom = 34 + jumpY.current + 6;
      const playerTop = playerBottom + 43;
      const obstacleBottom = 37;
      const obstacleTop = obstacleBottom + 46;
      if (playerRight > obstacleLeft && playerLeft < obstacleRight && playerTop > obstacleBottom && playerBottom < obstacleTop) {
        playSound(110, 0.35, "sawtooth");
        setGameOver(true);
        setGameStarted(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [gameStarted, gameOver, playSound]);

  return (
    <main className="is-playing">
      <header className="site-header">
        <Link className="back-button" href="/">← Back</Link>
        <h1>Know Your Candidate</h1>
        <span className="header-space" />
      </header>
      <section className="dino-game" aria-label="Promise or Bluff game">
        <div className="game-screen-header"><span /><strong>Promise or Bluff?</strong><span className="game-score">{String(score).padStart(5, "0")}</span></div>
        <div className={`dino-stage ${gameStarted && !gameOver ? "running" : ""}`} ref={stageRef} onTouchStart={handleGameTouch}>
          <div className="game-cloud cloud-one" /><div className="game-cloud cloud-two" />
          <Image key={character.slug} className={`runner-character character-${character.slug} ${isJumping ? "jumping" : ""}`} src={`${character.gameAsset}?v=${character.slug}`} alt={`${character.name} character`} width={138} height={86} priority unoptimized style={{ bottom: `${34 + playerY}px` }} />
          <Image className={`obstacle obstacle-${obstacleType}`} src={data.gameAssets[obstacleType]} alt="" width={58} height={58} style={{ left: `${obstacleX}px` }} />
          <div className="ground-line" />
          {gameOver && <div className="game-over-screen"><Image className="game-over-portrait" src={character.portraitAsset} alt="" width={180} height={180} unoptimized /><div className="game-over-content"><span>GAME OVER</span><strong>{String(score).padStart(5, "0")}</strong><small>Final score</small></div></div>}
        </div>
        <div className="game-instructions">
          <span>{gameOver ? "GAME OVER" : gameStarted ? "RUNNING" : "PRESS SPACE TO START"}</span>
          <strong>{gameOver ? "Your run is over" : "Jump over the bluff!"}</strong>
          {gameOver ? <button className="restart-button" onClick={restartGame}>Restart</button> : <small>Space / ↑ to jump · Tap to jump</small>}
        </div>
      </section>
    </main>
  );
}
