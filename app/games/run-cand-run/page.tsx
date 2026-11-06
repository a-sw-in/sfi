"use client";

import Image from "next/image";
import Link from "next/link";
import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import data from "../../data.json";
import { getCachedCharacter } from "../../lib/character-selection";
import { getCachedPlayerPhone } from "../../lib/player-session";
import { addPlayerPoints } from "../../lib/player-points";
import { useGame } from "../../store/gameStore";

export default function PromiseOrBluff() {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const playerPhone = getCachedPlayerPhone();
  const character = selectedCharacter ? data.characters.find((item) => item.slug === selectedCharacter) : undefined;
  const [isJumping, setIsJumping] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showGameOverScreen, setShowGameOverScreen] = useState(false);
  const [obstacleX, setObstacleX] = useState(620);
  const [playerY, setPlayerY] = useState(0);
  const [score, setScore] = useState(0);
  const [obstacleType, setObstacleType] = useState<"cactus" | "bonfire">("cactus");
  const jumpY = useRef(0);
  const jumpVelocity = useRef(0);
  const obstaclePosition = useRef(620);
  const scoreRef = useRef(0);
  const pointsAwardedRef = useRef(false);
  const runSpeed = useRef(7);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const gameOverTimer = useRef<number | null>(null);
  const muted = useGame((state) => state.muted);
  const toggleMute = useGame((state) => state.toggleMute);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedCharacter(getCachedCharacter().slug);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = "square") => {
    if (muted) return;
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
  }, [muted]);

  const jump = useCallback(() => {
    if (gameOver) return;
    if (!gameStarted) {
      setGameStarted(true);
      const startX = (stageRef.current?.clientWidth ?? 300) + 360;
      obstaclePosition.current = startX;
      setObstacleX(startX);
      playSound(330, 0.12);
      jumpY.current = 0;
      jumpVelocity.current = 0;
    }
    if (isJumping) return;
    setIsJumping(true);
    runSpeed.current += 0.3;
    jumpVelocity.current = 15;
    playSound(520, 0.1, "triangle");
    window.setTimeout(() => setIsJumping(false), 650);
  }, [gameStarted, gameOver, isJumping, playSound]);

  const restartGame = useCallback(() => {
    if (gameOverTimer.current !== null) {
      window.clearTimeout(gameOverTimer.current);
      gameOverTimer.current = null;
    }
    setGameOver(false);
    setShowGameOverScreen(false);
    setGameStarted(false);
    setScore(0);
    scoreRef.current = 0;
    pointsAwardedRef.current = false;
    runSpeed.current = 7;
    jumpY.current = 0;
    jumpVelocity.current = 0;
    setPlayerY(0);
    const resetX = (stageRef.current?.clientWidth ?? 300) + 360;
    obstaclePosition.current = resetX;
    setObstacleX(resetX);
    setObstacleType("cactus");
  }, []);

  const saveGamePoints = useCallback(async () => {
    if (!playerPhone || pointsAwardedRef.current) return;

    pointsAwardedRef.current = true;
    try {
      await addPlayerPoints(playerPhone, scoreRef.current);
    } catch (error) {
      pointsAwardedRef.current = false;
      console.error("Unable to save player points", error);
    }
  }, [playerPhone]);

  const handleGameTouch = (event: TouchEvent<HTMLElement>) => {
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
      const playerLeft = stageWidth * 0.18 + 4;
      const playerRight = stageWidth * 0.18 + 57;
      const obstacleHitboxWidth = 58 * 0.75;
      const obstacleHitboxHeight = 58 * 0.75;
      const obstacleLeft = obstaclePosition.current + (58 - obstacleHitboxWidth) / 2;
      const obstacleRight = obstacleLeft + obstacleHitboxWidth;
      const playerBottom = 34 + jumpY.current + 4;
      const playerTop = playerBottom + 48;
      const obstacleBottom = 31 + (58 - obstacleHitboxHeight) / 2;
      const obstacleTop = obstacleBottom + obstacleHitboxHeight;
      if (playerRight > obstacleLeft && playerLeft < obstacleRight && playerTop > obstacleBottom && playerBottom < obstacleTop) {
        playSound(110, 0.35, "sawtooth");
        setGameOver(true);
        setGameStarted(false);
        gameOverTimer.current = window.setTimeout(() => {
          setShowGameOverScreen(true);
          gameOverTimer.current = null;
        }, 1000);
        void saveGamePoints();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [gameStarted, gameOver, playSound, saveGamePoints]);

  return (
    <main className="is-playing" onTouchStart={handleGameTouch}>
      <header className="site-header">
        <Link className="back-button" href="/">← Back</Link>
        <h1>Know Your Candidate</h1>
        <span className="header-space" />
      </header>
      <section className="dino-game" aria-label="Promise or Bluff game" data-player-phone={playerPhone ?? undefined}>
        <div className="game-screen-header"><span /><strong>Run Candidate Run</strong><span className="game-score">{String(score).padStart(5, "0")}</span></div>
        <div className={`dino-stage ${gameStarted && !gameOver ? "running" : ""}`} ref={stageRef}>
          <div className="game-cloud cloud-one" /><div className="game-cloud cloud-two" />
          {character && <Image key={character.slug} className={`runner-character character-${character.slug} ${isJumping ? "jumping" : ""}`} src={`${character.gameAsset}?v=${character.slug}`} alt={`${character.name} character`} width={138} height={86} priority unoptimized style={{ bottom: `${34 + playerY}px` }} />}
          <Image className={`obstacle obstacle-${obstacleType}`} src={data.gameAssets[obstacleType]} alt="" width={58} height={58} style={{ left: `${obstacleX}px` }} />
          <div className="ground-line" />
          {showGameOverScreen && character && <div className="game-over-screen"><div className="game-over-character"><Image className="game-over-portrait" src={character.portraitAsset} alt={`${character.name} portrait`} width={180} height={180} unoptimized /><strong>{character.name}</strong><p>{character.description}</p></div></div>}
        </div>
        <div className="game-instructions">
          <span>{gameOver ? "GAME OVER" : gameStarted ? "RUNNING" : "PRESS SPACE TO START"}</span>
          <strong>{gameOver ? "Your run is over" : "Jump over the bluff!"}</strong>
          <strong>{String(score).padStart(5, "0")}</strong><small>Final score</small>
          {gameOver ? <><button className="restart-button" onClick={restartGame}>Restart</button>{!playerPhone && <><small className="leaderboard-login-description">Login to enter the leaderboard.</small><Link className="login-game-button" href="/login">Login</Link></>}</> : <small>Space / ↑ to jump · Tap to jump</small>}
        </div>
      </section>
      <button className="dino-mute" type="button" onClick={toggleMute}>{muted ? "🔇" : "🔊"}</button>
    </main>
  );
}
