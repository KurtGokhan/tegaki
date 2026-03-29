import { useCallback, useEffect, useRef, useState } from 'react';
import font from '#src/font.ts';
import { computeTimeline, Tegaki } from '../lib/TegakiRenderer.tsx';

export function TegakiDemo() {
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);

  const timeline = computeTimeline(text, font);
  const { totalDuration } = timeline;

  const timeRef = useRef(0);
  const speedRef = useRef(speed);
  const prevTotalRef = useRef(totalDuration);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Auto-resume when new text extends the timeline
  useEffect(() => {
    if (totalDuration > prevTotalRef.current && timeRef.current >= prevTotalRef.current) {
      setPlaying(true);
    }
    prevTotalRef.current = totalDuration;
  }, [totalDuration]);

  // Clamp time when text shortens
  useEffect(() => {
    if (timeRef.current > totalDuration) {
      timeRef.current = totalDuration;
      setDisplayTime(totalDuration);
    }
  }, [totalDuration]);

  // rAF playback loop
  useEffect(() => {
    if (!playing || totalDuration <= 0) return;
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      if (lastTs === null) {
        lastTs = ts;
        raf = requestAnimationFrame(tick);
        return;
      }
      const elapsed = (ts - lastTs) / 1000;
      lastTs = ts;

      const remaining = Math.max(0, totalDuration - timeRef.current);
      const catchUpFactor = Math.max(1, remaining / 2);
      const delta = elapsed * speedRef.current * catchUpFactor;

      timeRef.current = Math.min(timeRef.current + delta, totalDuration);
      setDisplayTime(timeRef.current);

      if (timeRef.current >= totalDuration) {
        setPlaying(false);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalDuration]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    timeRef.current = t;
    setDisplayTime(t);
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && timeRef.current >= computeTimeline(text, font).totalDuration) {
        timeRef.current = 0;
        setDisplayTime(0);
      }
      return !p;
    });
  }, [text]);

  return (
    <div className="flex flex-col p-20 gap-4 items-start">
      <textarea className="p-4 border border-gray-800 rounded w-80" rows={3} value={text} onChange={(e) => setText(e.target.value)} />

      <div className="flex flex-row items-center gap-4">
        <button type="button" className="px-3 py-1 border border-gray-800 rounded cursor-pointer" onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>

        <label className="flex flex-row items-center gap-2">
          <span className="text-sm">Speed: {speed.toFixed(1)}x</span>
          <input type="range" min={0.1} max={5} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
      </div>

      <div className="flex flex-row items-center gap-2 w-80">
        <span className="text-sm tabular-nums">{displayTime.toFixed(2)}s</span>
        <input className="flex-1" type="range" min={0} max={totalDuration} step={0.01} value={displayTime} onChange={handleScrub} />
        <span className="text-sm tabular-nums">{totalDuration.toFixed(2)}s</span>
      </div>

      <Tegaki className="text-3xl w-80 border border-gray-300 rounded p-4" text={text} time={displayTime} font={font} />
    </div>
  );
}
