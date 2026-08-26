"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const JAPAN_SOUND_SCENES = [
  { id: "tokyo", label: "東京の街" },
  { id: "train", label: "電車" },
  { id: "cafe", label: "カフェ" },
  { id: "rain", label: "雨" },
  { id: "matsuri", label: "夏祭り" },
  { id: "night", label: "夜の街" },
  { id: "bgm", label: "軽いBGM" },
] as const;

export type JapanSoundScene = (typeof JAPAN_SOUND_SCENES)[number]["id"];

const ON_KEY = "newfind.japan-sound.on";
const SCENE_KEY = "newfind.japan-sound.scene";

function noiseBuffer(ctx: AudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

class JapanSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timers: number[] = [];
  private scene: JapanSoundScene = "tokyo";

  async enable() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.start(this.scene);
  }

  async disable() {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.suspend();
  }

  setScene(scene: JapanSoundScene) {
    this.scene = scene;
    if (this.ctx && this.ctx.state === "running" && this.master) {
      this.start(scene);
    }
  }

  private stop() {
    this.timers.forEach((id) => window.clearInterval(id));
    this.timers = [];
    this.nodes.forEach((node) => {
      try {
        if ("stop" in node && typeof (node as OscillatorNode).stop === "function") {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.nodes = [];
    this.master?.disconnect();
    this.master = null;
  }

  private start(scene: JapanSoundScene) {
    if (!this.ctx) return;
    this.stop();
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
    this.master = master;
    if (scene === "rain") this.rain(ctx, master);
    else if (scene === "train") this.train(ctx, master);
    else if (scene === "cafe") this.cafe(ctx, master);
    else if (scene === "matsuri") this.matsuri(ctx, master);
    else if (scene === "night") this.night(ctx, master);
    else if (scene === "bgm") this.bgm(ctx, master);
    else this.tokyo(ctx, master);
  }

  private filteredNoise(
    ctx: AudioContext,
    dest: AudioNode,
    type: BiquadFilterType,
    freq: number,
    gainValue: number,
  ) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 3);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start();
    this.nodes.push(src, filter, gain);
  }

  private tone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    type: OscillatorType,
    gainValue: number,
  ) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    this.nodes.push(osc, gain);
    return osc;
  }

  private tokyo(ctx: AudioContext, dest: AudioNode) {
    this.filteredNoise(ctx, dest, "lowpass", 600, 0.18);
    this.filteredNoise(ctx, dest, "bandpass", 1400, 0.05);
    this.tone(ctx, dest, 110, "sine", 0.02);
  }

  private train(ctx: AudioContext, dest: AudioNode) {
    this.filteredNoise(ctx, dest, "lowpass", 400, 0.16);
    this.tone(ctx, dest, 8.5, "sine", 0.04);
    this.tone(ctx, dest, 220, "triangle", 0.012);
  }

  private cafe(ctx: AudioContext, dest: AudioNode) {
    this.filteredNoise(ctx, dest, "lowpass", 900, 0.08);
    this.tone(ctx, dest, 196, "sine", 0.015);
    this.tone(ctx, dest, 247, "sine", 0.01);
  }

  private rain(ctx: AudioContext, dest: AudioNode) {
    this.filteredNoise(ctx, dest, "highpass", 1800, 0.12);
    this.filteredNoise(ctx, dest, "bandpass", 4200, 0.06);
  }

  private matsuri(ctx: AudioContext, dest: AudioNode) {
    this.filteredNoise(ctx, dest, "lowpass", 500, 0.06);
    const pentatonic = [392, 440, 494, 587, 659];
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(dest);
    this.nodes.push(gain);
    let i = 0;
    const tick = window.setInterval(() => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = pentatonic[i % pentatonic.length]!;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);
      osc.connect(env);
      env.connect(gain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
      i += 1;
    }, 420);
    this.timers.push(tick);
  }

  private night(ctx: AudioContext, dest: AudioNode) {
    this.filteredNoise(ctx, dest, "lowpass", 280, 0.14);
    this.tone(ctx, dest, 73, "sine", 0.03);
    this.tone(ctx, dest, 146, "sine", 0.012);
  }

  private bgm(ctx: AudioContext, dest: AudioNode) {
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0];
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(dest);
    this.nodes.push(gain);
    let i = 0;
    const tick = window.setInterval(() => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = notes[i % notes.length]!;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);
      osc.connect(env);
      env.connect(gain);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.25);
      i += i % 5 === 3 ? 2 : 1;
    }, 900);
    this.timers.push(tick);
  }
}

function readSoundScene(): JapanSoundScene {
  if (typeof window === "undefined") return "tokyo";
  try {
    const saved = window.localStorage.getItem(SCENE_KEY) as JapanSoundScene | null;
    if (saved && JAPAN_SOUND_SCENES.some((item) => item.id === saved)) return saved;
  } catch {
    // ignore
  }
  return "tokyo";
}

const engine = new JapanSoundEngine();

export function JapanSoundToggle() {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState<JapanSoundScene>("tokyo");
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = useCallback(async () => {
    setError("");
    const next = !on;
    try {
      if (next) {
        const chosen = scene || readSoundScene();
        engine.setScene(chosen);
        await engine.enable();
      } else {
        await engine.disable();
      }
      setOn(next);
      window.localStorage.setItem(ON_KEY, next ? "1" : "0");
    } catch {
      setError("Audio could not start");
    }
  }, [on, scene]);

  const chooseScene = useCallback(
    async (next: JapanSoundScene) => {
      setScene(next);
      engine.setScene(next);
      window.localStorage.setItem(SCENE_KEY, next);
      if (on) {
        try {
          await engine.enable();
        } catch {
          setError("Scene switch failed");
        }
      }
    },
    [on],
  );

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${
          on
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-300 bg-white text-neutral-500"
        }`}
        aria-pressed={on}
      >
        {on ? "JAPAN SOUND ON" : "JAPAN SOUND OFF"}
      </button>
      <button
        type="button"
        className="ml-1 text-[10px] text-neutral-400"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose sound scene"
      >
        v
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
          <p className="px-1 pb-1 text-[10px] text-neutral-400">No autoplay</p>
          {JAPAN_SOUND_SCENES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void chooseScene(item.id)}
              className={`block w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${
                scene === item.id ? "bg-neutral-900 text-white" : "text-neutral-700"
              }`}
            >
              {item.label}
            </button>
          ))}
          {error ? <p className="px-1 pt-1 text-[10px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
