import { useCallback, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import type { PitchPoint } from '../lib/contour';
import { centsOff, freqToName } from '../lib/pitch';

export type MicStatus = 'idle' | 'requesting' | 'running' | 'denied' | 'error';

export interface LiveFrame {
  freq: number;
  clarity: number;
  note: string;
  cents: number;
}

export interface UseMicPitchOptions {
  /** Minimum McLeod clarity to treat a frame as voiced. */
  clarityThreshold?: number;
  /** Minimum RMS amplitude to treat a frame as voiced (gates silence/noise). */
  rmsThreshold?: number;
  /** Sampling interval in ms (~30fps default; plenty for pitch). */
  frameIntervalMs?: number;
  /** Called for every voiced frame with the detected frequency. */
  onHit?: (freq: number) => void;
}

export interface UseMicPitch {
  status: MicStatus;
  error: string | null;
  /** Points accumulated for the current take (voiced + pen-up markers). */
  points: PitchPoint[];
  /** Latest voiced frame, or null when unvoiced/idle. */
  live: LiveFrame | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Clear the current take's points (start a fresh layer) and return elapsed ms. */
  reset: () => void;
}

/**
 * Streams pitch from the microphone using an AnalyserNode + pitchy on a rAF
 * loop. Emits a broken contour (null freq during consonants/silence) that the
 * graph bridges. Main-thread detection is cheap enough for a v1; an
 * AudioWorklet is the escalation path if needed.
 */
export function useMicPitch(options: UseMicPitchOptions = {}): UseMicPitch {
  const {
    clarityThreshold = 0.88,
    rmsThreshold = 0.012,
    frameIntervalMs = 33,
    onHit,
  } = options;

  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<PitchPoint[]>([]);
  const [live, setLive] = useState<LiveFrame | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setStatus('idle');
    setLive(null);
  }, []);

  const reset = useCallback(() => {
    setPoints([]);
    startTsRef.current = performance.now();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume(); // iOS Safari: must resume within the user gesture.
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const input = new Float32Array(detector.inputLength);

      startTsRef.current = performance.now();
      lastSampleRef.current = 0;
      setPoints([]);
      setStatus('running');

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - lastSampleRef.current < frameIntervalMs) return;
        lastSampleRef.current = now;

        analyser.getFloatTimeDomainData(input);
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
        const rms = Math.sqrt(sumSq / input.length);

        const [freq, clarity] = detector.findPitch(input, ctx.sampleRate);
        const tMs = now - startTsRef.current;
        const voiced = clarity >= clarityThreshold && rms >= rmsThreshold && freq > 0;

        if (voiced) {
          setLive({ freq, clarity, note: freqToName(freq), cents: centsOff(freq) });
          onHitRef.current?.(freq);
          setPoints((prev) => [...prev, { tMs, freq, clarity }]);
        } else {
          setLive(null);
          setPoints((prev) => {
            // Only record a single pen-up marker per gap to keep arrays small.
            if (prev.length && prev[prev.length - 1].freq == null) return prev;
            return [...prev, { tMs, freq: null, clarity }];
          });
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setStatus('denied');
        setError('Microphone access was denied. Enable it and try again.');
      } else {
        setStatus('error');
        setError(e.message || 'Could not start the microphone.');
      }
    }
  }, [clarityThreshold, rmsThreshold, frameIntervalMs]);

  return { status, error, points, live, start, stop, reset };
}
