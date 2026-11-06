"use client";

import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, PerspectiveCamera } from "@react-three/drei";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../store/gameStore";
import { LANE_X, PLAYER_Z } from "../../lib/game/constants";
import { getCachedCharacter } from "../../lib/character-selection";

function Runner() {
  const selectedCharacter = getCachedCharacter();
  const group = useRef<THREE.Group>(null);
  const lane = useRef(1);
  const y = useRef(0);
  const velocity = useRef(0);
  const slide = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const audioContext = useRef<AudioContext | null>(null);
  const mode = useGame((state) => state.mode);
  const muted = useGame((state) => state.muted);

  const playJumpSound = useCallback(() => {
    if (muted) return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(620, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, context.currentTime + 0.22);
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  }, [muted]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
      keys.current[event.key.toLowerCase()] = true;
      if (event.repeat) return;
      if (event.key === "Escape") {
        const state = useGame.getState();
        if (state.mode === "playing") state.pause();
        else if (state.mode === "paused") state.resume();
      }
    };
    const up = (event: KeyboardEvent) => { keys.current[event.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    let startX = 0;
    let startY = 0;
    const touchStart = (event: TouchEvent) => {
      event.preventDefault();
      startX = event.changedTouches[0].clientX;
      startY = event.changedTouches[0].clientY;
    };
    const touchMove = (event: TouchEvent) => { event.preventDefault(); };
    const touchEnd = (event: TouchEvent) => {
      event.preventDefault();
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) lane.current = THREE.MathUtils.clamp(lane.current + (dx > 0 ? 1 : -1), 0, 2);
      else if (dy < 0 && y.current === 0) { velocity.current = 14; playJumpSound(); }
      else if (dy > 0) slide.current = 0.65;
    };
    window.addEventListener("touchstart", touchStart, { passive: false });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
    };
  }, [playJumpSound]);

  useFrame((_, delta) => {
    if (mode !== "playing" || !group.current) return;
    const keyState = keys.current;
    if (keyState.arrowleft || keyState.a) { lane.current = Math.max(0, lane.current - 1); keyState.arrowleft = false; keyState.a = false; }
    if (keyState.arrowright || keyState.d) { lane.current = Math.min(2, lane.current + 1); keyState.arrowright = false; keyState.d = false; }
    if ((keyState.arrowup || keyState.w || keyState[" "]) && y.current === 0) { velocity.current = 14; playJumpSound(); keyState.arrowup = false; keyState.w = false; keyState[" "] = false; }
    if (keyState.arrowdown || keyState.s) { slide.current = 0.6; keyState.arrowdown = false; keyState.s = false; }
    y.current = Math.max(0, y.current + velocity.current * delta);
    velocity.current -= 26 * delta;
    if (y.current === 0) velocity.current = 0;
    slide.current = Math.max(0, slide.current - delta);
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, LANE_X[lane.current], 12, delta);
    group.current.position.y = y.current;
    group.current.scale.y = slide.current > 0 ? 0.55 : 1;
    group.current.rotation.z = Math.sin(performance.now() * 0.012) * 0.035;
  });

  if (mode !== "playing") return null;
  return <group name="runner" ref={group} position={[0, 0, PLAYER_Z]}><Html center position={[0, 1.25, 0]} transform distanceFactor={7} style={{ pointerEvents: "none" }}><Image src={`/characters/${selectedCharacter.slug}/subway.gif?v=1`} alt="" width={123} height={179} unoptimized priority style={{ objectFit: "contain" }} /></Html></group>;
}

function World() {
  const refs = useRef<THREE.Group>(null);
  const mode = useGame((state) => state.mode);
  const setScore = useGame((state) => state.setScore);
  const addCoin = useGame((state) => state.addCoin);
  const muted = useGame((state) => state.muted);
  const audioContext = useRef<AudioContext | null>(null);
  const elapsed = useRef(0);
  const distance = useRef(0);
  const objects = useRef<{ z: number; lane: number; coin: boolean; mesh: THREE.Mesh }[]>([]);
  const spawn = useRef(0);
  const lastCoinDistance = useRef(-60);
  const lastObstacleDistance = useRef(-90);
  const previousMode = useRef(mode);

  const playCoinSound = () => {
    if (muted) return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  };

  const playGameOverSound = () => {
    if (muted) return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(220, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, context.currentTime + 0.45);
    gain.gain.setValueAtTime(0.14, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  };

  useEffect(() => {
    if (mode !== "playing") return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "suspended") void context.resume();
    const notes = [196, 247, 294, 247];
    let noteIndex = 0;
    const playBackgroundNote = () => {
      if (muted) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = notes[noteIndex % notes.length];
      noteIndex += 1;
      gain.gain.setValueAtTime(0.054, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.28);
    };
    playBackgroundNote();
    const interval = window.setInterval(playBackgroundNote, 360);
    return () => window.clearInterval(interval);
  }, [mode, muted]);

  useFrame((state, delta) => {
    if (mode !== previousMode.current) {
      previousMode.current = mode;
      if (mode === "menu" || mode === "over") {
        for (const object of objects.current) {
          refs.current?.remove(object.mesh);
          object.mesh.geometry.dispose();
          (object.mesh.material as THREE.Material).dispose();
        }
        objects.current = [];
        spawn.current = 0;
        elapsed.current = 0;
        distance.current = 0;
        lastCoinDistance.current = -60;
        lastObstacleDistance.current = -90;
      }
    }
    if (mode !== "playing") return;
    elapsed.current += delta;
    const difficultyDistance = Math.min(distance.current, 750);
    const speed = 13 + Math.min(difficultyDistance * 0.012, 9);
    const obstacleSpeed = speed * 1.1 ** Math.floor(difficultyDistance / 50);
    distance.current += delta * speed;
    setScore(Math.floor(elapsed.current * 10));
    spawn.current -= delta;
    if (spawn.current <= 0 && refs.current) {
      spawn.current = Math.max(0.45, 1.1 - elapsed.current * 0.005);
      const coinIsDue = distance.current - lastCoinDistance.current >= 70;
      const obstacleIsDue = distance.current - lastObstacleDistance.current >= 120;
      const obstacleRate = 0.7 * 1.1;
      const coinRate = 0.3 * 1.3 * 1.3;
      const coin = coinIsDue || (!obstacleIsDue && Math.random() < coinRate / (obstacleRate + coinRate));
      const lane = Math.floor(Math.random() * 3);
      const mesh = new THREE.Mesh(coin ? new THREE.TorusGeometry(0.35, 0.1, 8, 16) : new THREE.BoxGeometry(1.5, 2.5, 2.5), new THREE.MeshStandardMaterial({ color: coin ? "#facc15" : "#ef4444", metalness: coin ? 0.8 : 0.1 }));
      mesh.position.set(LANE_X[lane], coin ? 1.1 : 1.25, -65);
      mesh.castShadow = true;
      refs.current.add(mesh);
      objects.current.push({ z: -65, lane, coin, mesh });
      if (coin) lastCoinDistance.current = distance.current;
      else lastObstacleDistance.current = distance.current;
    }
    for (const object of objects.current) {
      object.z += delta * (object.coin ? speed : obstacleSpeed);
      object.mesh.position.z = object.z;
      if (object.coin) object.mesh.rotation.y += delta * 3;
      if (object.z > PLAYER_Z - 1 && object.z < PLAYER_Z + 1) {
        const player = state.scene.getObjectByName("runner");
        const playerX = player?.position.x ?? 0;
        const playerY = player?.position.y ?? 0;
        if (Math.abs(playerX - LANE_X[object.lane]) < 0.8) {
          if (object.coin && playerY < 1.5) { addCoin(); playCoinSound(); object.z = 100; }
          else if (Math.abs(object.z - PLAYER_Z) < 0.8 && playerY < 1.5) {
            playGameOverSound();
            useGame.getState().over();
          }
        }
      }
    }
    objects.current = objects.current.filter((object) => {
      if (object.z > 12) {
        refs.current?.remove(object.mesh);
        object.mesh.geometry.dispose();
        (object.mesh.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  });

  return <group ref={refs}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, -35]} receiveShadow><planeGeometry args={[80, 150]} /><meshStandardMaterial color="#1f2933" /></mesh>{[-2.2, 0, 2.2].map((x) => <mesh key={x} position={[x, -0.05, -35]}><boxGeometry args={[1.9, 0.1, 150]} /><meshStandardMaterial color="#374151" /></mesh>)}{[-3.2, -1.2, 1.2, 3.2].map((x) => <mesh key={x} position={[x, 0.12, -35]}><boxGeometry args={[0.13, 0.22, 150]} /><meshStandardMaterial color="#d1d5db" metalness={0.7} /></mesh>)}{Array.from({ length: 18 }, (_, index) => <group key={index} position={[(index % 2 ? 1 : -1) * (7 + (index % 4)), 0, -index * 8 - 5]}><mesh position={[0, 2, 0]}><boxGeometry args={[4, 4 + (index % 3), 4]} /><meshStandardMaterial color={index % 2 ? "#542020" : "#6b2929"} /></mesh><mesh position={[0, 4, 0]}><boxGeometry args={[4.2, 0.3, 4.2]} /><meshStandardMaterial color="#991b1b" /></mesh>{Array.from({ length: 12 }, (_, windowIndex) => <mesh key={windowIndex} position={[-1.25 + (windowIndex % 3) * 1.25, 1.25 + Math.floor(windowIndex / 3) * 1.05, 2.01]}><boxGeometry args={[0.55, 0.48, 0.06]} /><meshStandardMaterial color={windowIndex % 4 === 0 ? "#fbbf24" : "#fecaca"} emissive={windowIndex % 4 === 0 ? "#f59e0b" : "#b91c1c"} emissiveIntensity={windowIndex % 4 === 0 ? 1.2 : 0.35} /></mesh>)}</group>)}</group>;
}

export default function GameScene() {
  return <Canvas shadows="basic" dpr={[1, 1.5]}><PerspectiveCamera makeDefault position={[0, 5, 10]} fov={60} /><color attach="background" args={["#7f1d1d"]} /><ambientLight intensity={1.1} /><directionalLight position={[5, 12, 5]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} /><World /><Runner /><CameraRig /><Environment preset="city" /></Canvas>;
}

function CameraRig() {
  useFrame(({ camera }, delta) => { camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3, delta); camera.position.y = THREE.MathUtils.damp(camera.position.y, 5, 3, delta); camera.lookAt(0, 1, -8); });
  return null;
}
