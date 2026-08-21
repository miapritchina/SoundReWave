import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import type { Loop, PitchPoint } from '../lib/contour';
import { centsOff, freqToName } from '../lib/pitch';
import { layerColor } from '../lib/palette';
import type { LiveFrame } from './useMicPitch';

export type LooperStatus = 'idle' | 'requesting' | 'recording' | 'finished' | 'denied' | 'error';

export interface UseLooperOptions {
  clarityThreshold?: number;
  rmsThreshold?: number;
  frameIntervalMs?: number;
  onHit?: (freq: number) => void;
}

function pickMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

/**
 * The full looper engine: one shared mic stream drives both real-time pitch
 * analysis (drawn contour) and per-take audio recording (MediaRecorder). Takes
 * are committed as layers with both their contour points and decoded audio.
 */
export function useLooper(options: UseLooperOptions = {}) {
  // Thresholds tuned for normal speaking/singing distance: rely on pitchy's
  // clarity score to reject noise, and keep the amplitude gate low so distant
  // voice still registers (autoGainControl below normalizes the level).
  const { clarityThreshold = 0.9, rmsThreshold = 0.005, frameIntervalMs = 33, onHit } = options;

  const [status, setStatus] = useState<LooperStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<Loop[]>([]);
  const [activePoints, setActivePoints] = useState<PitchPoint[]>([]);
  const [live, setLive] = useState<LiveFrame | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef(0);
  const lastSampleRef = useRef(0);
  const pointsRef = useRef<PitchPoint[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;

  // iOS Safari suspends the AudioContext when the tab is backgrounded; resume it
  // when the app becomes visible again so recording/playback keep working.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ctxRef.current?.state === 'suspended') {
        void ctxRef.current.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // --- audio analysis loop ---
  const beginAnalysis = useCallback(
    (ctx: AudioContext, analyser: AnalyserNode) => {
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const input = new Float32Array(detector.inputLength);
      startTsRef.current = performance.now();
      lastSampleRef.current = 0;
      pointsRef.current = [];
      setActivePoints([]);

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
          pointsRef.current = [...pointsRef.current, { tMs, freq, clarity }];
        } else {
          setLive(null);
          const last = pointsRef.current[pointsRef.current.length - 1];
          if (!last || last.freq != null) {
            pointsRef.current = [...pointsRef.current, { tMs, freq: null, clarity }];
          }
        }
        setActivePoints(pointsRef.current);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [clarityThreshold, rmsThreshold, frameIntervalMs],
  );

  // --- recording ---
  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: pickMime() });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start();
    recorderRef.current = rec;
  }, []);

  /** Stop the current recorder and decode its audio to an AudioBuffer. */
  const finalizeRecorder = useCallback(async (): Promise<AudioBuffer | null> => {
    const rec = recorderRef.current;
    const ctx = ctxRef.current;
    if (!rec || !ctx) return null;
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType }));
      rec.stop();
    });
    recorderRef.current = null;
    if (blob.size === 0) return null;
    try {
      return await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      return null;
    }
  }, []);

  /** Commit the current take (points + audio) as a new layer, if it has pitch. */
  const commitTake = useCallback(async () => {
    const points = pointsRef.current;
    const audio = await finalizeRecorder();
    if (!points.some((p) => p.freq != null)) return; // skip silent takes
    const durationMs = points.length ? points[points.length - 1].tMs : 0;
    setCommitted((prev) => [
      ...prev,
      {
        id: `loop-${prev.length}-${Math.round(durationMs)}`,
        index: prev.length,
        color: layerColor(prev.length),
        points,
        durationMs,
        audio: audio ?? undefined,
      },
    ]);
  }, [finalizeRecorder]);

  // --- public actions ---
  const start = useCallback(async () => {
    setError(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // autoGainControl normalizes distance so you don't have to be on top of
        // the mic; EC/NS stay off to keep the pitch (and recorded audio) faithful.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      // Extra headroom for detection on devices with weak AGC. This gain feeds
      // only the analyser — the MediaRecorder reads the raw stream, so recorded
      // audio is unaffected.
      const inputGain = ctx.createGain();
      inputGain.gain.value = 1.6;
      source.connect(inputGain).connect(analyser);

      setCommitted([]);
      beginAnalysis(ctx, analyser);
      startRecorder();
      setStatus('recording');
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
  }, [beginAnalysis, startRecorder]);

  const newLayer = useCallback(async () => {
    await commitTake();
    // reset the active take and start recording the next one
    pointsRef.current = [];
    setActivePoints([]);
    startTsRef.current = performance.now();
    startRecorder();
  }, [commitTake, startRecorder]);

  const finish = useCallback(async () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    await commitTake();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(null);
    setActivePoints([]);
    setStatus('finished');
  }, [commitTake]);

  const playAll = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    void ctx.resume();
    const withAudio = committed.filter((l) => l.audio);
    if (!withAudio.length) return;
    const gain = ctx.createGain();
    gain.gain.value = withAudio.length > 1 ? 1 / Math.sqrt(withAudio.length) : 1;
    gain.connect(ctx.destination);
    let longest = 0;
    playSourcesRef.current = withAudio.map((l) => {
      const src = ctx.createBufferSource();
      src.buffer = l.audio!;
      src.connect(gain);
      src.start(0);
      longest = Math.max(longest, l.audio!.duration);
      return src;
    });
    setIsPlaying(true);
    window.setTimeout(() => setIsPlaying(false), longest * 1000 + 100);
  }, [committed]);

  /** Short A3 chime when the target note is hit (Phase 3). */
  const playHitTone = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220; // A3
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }, []);

  const stopPlayback = useCallback(() => {
    playSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    playSourcesRef.current = [];
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    stopPlayback();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    pointsRef.current = [];
    setCommitted([]);
    setActivePoints([]);
    setLive(null);
    setStatus('idle');
  }, [stopPlayback]);

  return {
    status,
    error,
    committed,
    activePoints,
    live,
    isPlaying,
    start,
    newLayer,
    finish,
    playAll,
    stopPlayback,
    playHitTone,
    reset,
  };
}
