"use client";

import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, PerspectiveCamera } from "@react-three/drei";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../store/gameStore";
import { LANE_X, PLAYER_Z } from "../../lib/game/constants";
import { getCachedCharacter } from "../../lib/character-selection";

type VehicleType = "car" | "lorry" | "bus";

function createVehicle(type: VehicleType): THREE.Group {
  const vehicle = new THREE.Group();
  const addBox = (size: [number, number, number], position: [number, number, number], color: string, metalness = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, metalness }));
    mesh.position.set(...position);
    vehicle.add(mesh);
    return mesh;
  };
  const addWheel = (x: number, z: number, radius = 0.28) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.18, 12), new THREE.MeshStandardMaterial({ color: "#111827" }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, radius, z);
    vehicle.add(wheel);
    addBox([0.06, radius * 0.75, 0.2], [x > 0 ? x - 0.1 : x + 0.1, radius, z], "#94a3b8", 0.5);
  };
  if (type === "car") {
    addBox([1.45, 0.48, 2.25], [0, 0.55, 0], "#2563eb", 0.15);
    addBox([1.2, 0.48, 0.95], [0, 1.02, -0.18], "#60a5fa", 0.1);
    addBox([1.02, 0.3, 0.05], [0, 1.05, 0.32], "#172554", 0.4);
    addBox([1.04, 0.12, 0.08], [0, 0.43, 1.16], "#1d4ed8", 0.1);
    addBox([0.2, 0.12, 0.06], [-0.48, 0.66, 1.14], "#fef08a", 0.2);
    addBox([0.2, 0.12, 0.06], [0.48, 0.66, 1.14], "#fef08a", 0.2);
    addWheel(-0.7, -0.72);
    addWheel(0.7, -0.72);
    addWheel(-0.7, 0.72);
    addWheel(0.7, 0.72);
  } else if (type === "lorry") {
    addBox([1.75, 1.65, 2.25], [0, 1.25, -0.55], "#f97316", 0.15);
    addBox([1.58, 1.15, 1.35], [0, 0.95, 1.18], "#facc15", 0.1);
    addBox([1.2, 0.5, 0.06], [0, 1.38, 1.87], "#172554", 0.4);
    addBox([1.05, 0.12, 0.08], [0, 0.45, 1.89], "#b45309", 0.1);
    addBox([0.22, 0.16, 0.06], [-0.55, 1.02, 1.91], "#fef08a", 0.2);
    addBox([0.22, 0.16, 0.06], [0.55, 1.02, 1.91], "#fef08a", 0.2);
    addBox([0.12, 0.18, 0.25], [-0.92, 1.12, 1.32], "#334155", 0.3);
    addBox([0.12, 0.18, 0.25], [0.92, 1.12, 1.32], "#334155", 0.3);
    for (const x of [-0.78, 0.78]) {
      addWheel(x, -1.12, 0.36);
      addWheel(x, 0.55, 0.36);
      addWheel(x, 1.35, 0.3);
    }
  } else {
    addBox([1.8, 2.2, 3.8], [0, 1.3, 0], "#dc2626", 0.15);
    addBox([1.5, 0.85, 0.08], [0, 1.72, 1.93], "#172554", 0.4);
    addBox([1.2, 0.12, 0.08], [0, 0.35, 1.95], "#991b1b", 0.1);
    for (const x of [-0.8, 0.8]) {
      addWheel(x, -1.35, 0.34);
      addWheel(x, 1.35, 0.34);
    }
  }
  vehicle.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  return vehicle;
}

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
      if (useGame.getState().mode !== "playing") return;
      startX = event.changedTouches[0].clientX;
      startY = event.changedTouches[0].clientY;
    };
    const touchEnd = (event: TouchEvent) => {
      if (useGame.getState().mode !== "playing") return;
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) lane.current = THREE.MathUtils.clamp(lane.current + (dx > 0 ? 1 : -1), 0, 2);
      else if (dy < 0 && y.current === 0) { velocity.current = 14; playJumpSound(); }
      else if (dy > 0) slide.current = 0.65;
    };
    window.addEventListener("touchstart", touchStart);
    window.addEventListener("touchend", touchEnd);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("touchstart", touchStart);
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
  return <group name="runner" ref={group} position={[0, 0, PLAYER_Z]}><Html center position={[0, 1.25, 0]} transform distanceFactor={7} style={{ pointerEvents: "none" }}><Image src={`/characters/${selectedCharacter.slug}/subway.gif?v=1`} alt="" width={123} height={179} unoptimized priority style={{ height: "auto", objectFit: "contain" }} /></Html></group>;
}

function World() {
  const refs = useRef<THREE.Group>(null);
  const roadMarkings = useRef<THREE.Group>(null);
  const mode = useGame((state) => state.mode);
  const setScore = useGame((state) => state.setScore);
  const addCoin = useGame((state) => state.addCoin);
  const muted = useGame((state) => state.muted);
  const audioContext = useRef<AudioContext | null>(null);
  const elapsed = useRef(0);
  const distance = useRef(0);
  const objects = useRef<{ z: number; lane: number; coin: boolean; mesh: THREE.Group }[]>([]);
  const spawn = useRef(0);
  const lastCoinDistance = useRef(-60);
  const lastObstacleDistance = useRef(-90);
  const previousMode = useRef(mode);
  const displayedScore = useRef(-1);

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
          object.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              child.material.dispose();
            }
          });
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
    roadMarkings.current?.children.forEach((marking) => {
      marking.position.z += delta * obstacleSpeed;
      if (marking.position.z > 14) marking.position.z -= 150;
    });
    const nextScore = Math.floor(elapsed.current * 10);
    if (nextScore !== displayedScore.current) {
      displayedScore.current = nextScore;
      setScore(nextScore);
    }
    spawn.current -= delta;
    if (spawn.current <= 0 && refs.current) {
      spawn.current = Math.max(0.45, 1.1 - elapsed.current * 0.005);
      const coinIsDue = distance.current - lastCoinDistance.current >= 70;
      const obstacleIsDue = distance.current - lastObstacleDistance.current >= 120;
      const obstacleRate = 0.7 * 1.1;
      const coinRate = 0.3 * 1.3 * 1.3;
      const coin = coinIsDue || (!obstacleIsDue && Math.random() < coinRate / (obstacleRate + coinRate));
      const lane = Math.floor(Math.random() * 3);
      const mesh = new THREE.Group();
      if (coin) {
        const coinMesh = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), new THREE.MeshStandardMaterial({ color: "#facc15", metalness: 0.8 }));
        coinMesh.castShadow = true;
        mesh.add(coinMesh);
      } else {
        mesh.add(createVehicle((["car", "lorry", "bus"] as VehicleType[])[Math.floor(Math.random() * 3)]));
      }
      mesh.position.set(LANE_X[lane], coin ? 1.1 : 1.25, -65);
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
        object.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        return false;
      }
      return true;
    });
  });

  return <group ref={refs}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, -35]} receiveShadow><planeGeometry args={[80, 150]} /><meshStandardMaterial color="#111827" /></mesh>{[-2.2, 0, 2.2].map((x) => <mesh key={x} position={[x, -0.05, -35]}><boxGeometry args={[1.9, 0.1, 150]} /><meshStandardMaterial color="#1f2937" /></mesh>)}{[-3.35, 3.35].map((x) => <group key={`barrier-${x}`} position={[x, 0, -35]}><mesh position={[0, 0.65, 0]}><boxGeometry args={[0.16, 0.16, 150]} /><meshStandardMaterial color="#f8fafc" metalness={0.5} /></mesh><mesh position={[0, 0.32, 0]}><boxGeometry args={[0.12, 0.12, 150]} /><meshStandardMaterial color="#94a3b8" metalness={0.6} /></mesh>{Array.from({ length: 16 }, (_, index) => <group key={index} name="barrier-support" position={[0, 0, -index * 10 - 5]}><mesh position={[0, 0.35, 0]}><boxGeometry args={[0.3, 0.7, 0.3]} /><meshStandardMaterial color="#64748b" metalness={0.5} /></mesh><mesh position={[0, 0.72, 0.16]}><boxGeometry args={[0.18, 0.12, 0.04]} /><meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.8} /></mesh></group>)}</group>)}<group ref={roadMarkings}>{Array.from({ length: 16 }, (_, index) => <group key={`marking-${index}`} position={[index % 2 ? 1.1 : -1.1, 0.08, -index * 10 - 5]}><mesh><boxGeometry args={[0.12, 0.06, 4.2]} /><meshStandardMaterial color="#ffffff" emissive="#cbd5e1" emissiveIntensity={0.2} /></mesh></group>)}</group>{Array.from({ length: 12 }, (_, index) => <group key={`prop-${index}`} name="roadside-prop" position={[(index % 2 ? 1 : -1) * (5.8 + (index % 3)), 0, -index * 15 - 10]}><mesh position={[0, 0.08, 0]}><boxGeometry args={[2.8, 0.16, 8]} /><meshStandardMaterial color={index % 2 ? "#64748b" : "#78716c"} /></mesh><mesh position={[0, 0.3, 0]}><boxGeometry args={[1.2, 0.45, 0.8]} /><meshStandardMaterial color={index % 3 ? "#16a34a" : "#92400e"} /></mesh><mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.07, 0.07, 3]} /><meshStandardMaterial color="#475569" /></mesh><mesh position={[0, 3.35, 0]}><sphereGeometry args={[0.32, 8, 8]} /><meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.8} /></mesh></group>)}{Array.from({ length: 14 }, (_, index) => <group key={`detail-${index}`} name="detail" position={[(index % 2 ? 1 : -1) * (6.5 + (index % 3) * 1.5), 0, -index * 10 - 8]}><mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.18, 0.25, 4.8, 8]} /><meshStandardMaterial color="#334155" /></mesh><mesh position={[0, 5, 0]}><sphereGeometry args={[1.35, 10, 8]} /><meshStandardMaterial color={index % 2 ? "#166534" : "#15803d"} /></mesh><mesh position={[0, 4.3, 0.35]}><boxGeometry args={[1.8, 0.7, 0.08]} /><meshStandardMaterial color={index % 3 ? "#facc15" : "#38bdf8"} emissive={index % 3 ? "#f59e0b" : "#0284c7"} emissiveIntensity={0.7} /></mesh></group>)}{Array.from({ length: 18 }, (_, index) => <group key={`building-${index}`} name="building" position={[(index % 2 ? 1 : -1) * (7 + (index % 4)), 0, -index * 8 - 5]}><mesh position={[0, 2, 0]}><boxGeometry args={[4, 4 + (index % 3), 4]} /><meshStandardMaterial color={index % 2 ? "#542020" : "#6b2929"} /></mesh><mesh position={[0, 4, 0]}><boxGeometry args={[4.2, 0.3, 4.2]} /><meshStandardMaterial color="#991b1b" /></mesh>{Array.from({ length: 12 }, (_, windowIndex) => <mesh key={windowIndex} position={[-1.25 + (windowIndex % 3) * 1.25, 1.25 + Math.floor(windowIndex / 3) * 1.05, 2.01]}><boxGeometry args={[0.55, 0.48, 0.06]} /><meshStandardMaterial color={windowIndex % 4 === 0 ? "#fbbf24" : "#fecaca"} emissive={windowIndex % 4 === 0 ? "#f59e0b" : "#b91c1c"} emissiveIntensity={windowIndex % 4 === 0 ? 1.2 : 0.35} /></mesh>)}</group>)}</group>;
}

function SkyDecor() {
  return <group><mesh position={[-10, 11, -42]}><sphereGeometry args={[2.2, 20, 20]} /><meshBasicMaterial color="#fde047" /></mesh><pointLight position={[-10, 11, -30]} color="#fff4b5" intensity={20} distance={90} /><group position={[4, 9, -35]}><mesh position={[-1.5, 0, 0]}><sphereGeometry args={[1.2, 12, 12]} /><meshBasicMaterial color="#ffffff" /></mesh><mesh position={[0, 0.35, 0]}><sphereGeometry args={[1.6, 12, 12]} /><meshBasicMaterial color="#ffffff" /></mesh><mesh position={[1.7, 0, 0]}><sphereGeometry args={[1.05, 12, 12]} /><meshBasicMaterial color="#ffffff" /></mesh></group><group position={[-3, 10, -55]}><mesh position={[-1.3, 0, 0]}><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#f8fafc" /></mesh><mesh position={[0, 0.25, 0]}><sphereGeometry args={[1.35, 12, 12]} /><meshBasicMaterial color="#f8fafc" /></mesh><mesh position={[1.4, 0, 0]}><sphereGeometry args={[0.9, 12, 12]} /><meshBasicMaterial color="#f8fafc" /></mesh></group></group>;
}

export default function GameScene() {
  return <Canvas shadows="basic" dpr={[1, 1.25]}><PerspectiveCamera makeDefault position={[0, 5, 10]} fov={60} /><color attach="background" args={["#60b9f5"]} /><fog attach="fog" args={["#60b9f5", 48, 145]} /><ambientLight intensity={1.1} /><directionalLight position={[-10, 12, 5]} intensity={2} castShadow shadow-mapSize={[512, 512]} /><SkyDecor /><World /><Runner /><CameraRig /></Canvas>;
}

function CameraRig() {
  useFrame(({ camera }, delta) => { camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3, delta); camera.position.y = THREE.MathUtils.damp(camera.position.y, 5, 3, delta); camera.lookAt(0, 1, -8); });
  return null;
}
