import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import type { Loop, PitchPoint } from '../lib/contour';
import { centsOff, freqToName } from '../lib/pitch';
import { layerColor } from '../lib/palette';
import { peakOf } from '../lib/mixdown';
import type { LiveFrame } from './useMicPitch';

export type LooperStatus = 'idle' | 'requesting' | 'recording' | 'finished' | 'denied' | 'error';

export interface UseLooperOptions {
  /** Sampling interval in ms (~30fps default). */
  frameIntervalMs?: number;
  /** Initial detection sensitivity 0..1 (see gatesFor). Live-adjustable. */
  sensitivity?: number;
  /** Auto-finish after this much continuous silence, once any voice was heard. */
  silenceStopMs?: number;
  /** 'manual' (New Layer continues) or 'fixed' (auto-stop after loopLengthMs). */
  loopMode?: 'manual' | 'fixed';
  /** Fixed-loop length in ms. */
  loopLengthMs?: number;
  /**
   * Skip silence: while silent, pause the recorder AND freeze the take clock,
   * so voiced parts sit back-to-back (no dead time in the graph or the audio).
   */
  gateSilence?: boolean;
  onHit?: (freq: number) => void;
}

/** Stay "active" this long after the last voiced frame before skipping silence
 * (a short grace so consonant gaps inside a word aren't cut). */
const GATE_HOLD_MS = 220;

/**
 * iOS 16.4+ audio session hint. "playback" makes Web Audio ignore the hardware
 * mute switch; "play-and-record" is appropriate while the mic is live. No-op
 * (and harmless) where unsupported.
 */
function setAudioSession(type: 'playback' | 'play-and-record'): void {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = type;
  } catch {
    /* unsupported browser */
  }
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
/**
 * Map a 0..1 sensitivity to detection gates + input gain. Higher sensitivity
 * loosens the clarity and amplitude gates and boosts the analyser gain, so
 * quieter/more distant or reverberant voice still registers. Real spoken words
 * often score clarity ~0.7–0.85 on vowels, so the default sits comfortably
 * below the strict end.
 */
export function gatesFor(sensitivity: number): { clarity: number; rms: number; gain: number } {
  const s = Math.max(0, Math.min(1, sensitivity));
  return {
    clarity: 0.92 - s * 0.34, // 0.92 (strict) → 0.58 (loose)
    rms: 0.02 * Math.pow(0.0005 / 0.02, s), // 0.02 → 0.0005, log-spaced
    gain: 1 + s * 4, // 1× → 5×
  };
}

export function useLooper(options: UseLooperOptions = {}) {
  const {
    frameIntervalMs = 33,
    sensitivity: initialSensitivity = 0.65,
    silenceStopMs = 4000,
    loopMode = 'manual',
    loopLengthMs = 6000,
    gateSilence = false,
    onHit,
  } = options;

  const [status, setStatus] = useState<LooperStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<Loop[]>([]);
  const [activePoints, setActivePoints] = useState<PitchPoint[]>([]);
  const [live, setLive] = useState<LiveFrame | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  /** Fixed mode: a take has auto-stopped and we're waiting for New Layer. */
  const [armed, setArmed] = useState(false);
  /** Playback position in ms while playing all layers, else null. */
  const [playbackMs, setPlaybackMs] = useState<number | null>(null);
  /** Live input loudness 0..1 (post-gain RMS, scaled) for the meter. */
  const [inputLevel, setInputLevel] = useState(0);
  const [sensitivity, setSensitivityState] = useState(initialSensitivity);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef(0);
  const lastSampleRef = useRef(0);
  const pointsRef = useRef<PitchPoint[]>([]);
  const lastVoicedRef = useRef<{ freq: number; tMs: number } | null>(null);
  const hadVoiceRef = useRef(false);
  const lastVoiceWallRef = useRef(0);
  const autoStoppingRef = useRef(false);
  const autoFinishRef = useRef<() => void>(() => {});
  const pausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const playRafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const loopModeRef = useRef(loopMode);
  const loopLengthMsRef = useRef(loopLengthMs);
  const gateSilenceRef = useRef(gateSilence);
  const silencePausedRef = useRef(false);
  const silenceEnterRef = useRef(0);
  gateSilenceRef.current = gateSilence;
  const armedRef = useRef(false);
  const armingRef = useRef(false);
  const armRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  loopModeRef.current = loopMode;
  loopLengthMsRef.current = loopLengthMs;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const inputGainRef = useRef<GainNode | null>(null);
  const sensitivityRef = useRef(initialSensitivity);
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;

  const setSensitivity = useCallback((v: number) => {
    sensitivityRef.current = v;
    setSensitivityState(v);
    if (inputGainRef.current) inputGainRef.current.gain.value = gatesFor(v).gain;
  }, []);

  // iOS Safari suspends/interrupts the AudioContext when the tab is
  // backgrounded; resume it whenever we become visible again (any non-running
  // state) so recording/playback keep working.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ctxRef.current && ctxRef.current.state !== 'running') {
        void ctxRef.current.resume().catch(() => {});
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
      lastVoicedRef.current = null;
      hadVoiceRef.current = false;
      autoStoppingRef.current = false;
      armingRef.current = false;
      pausedRef.current = false;
      silencePausedRef.current = false;
      setActivePoints([]);
      setPaused(false);

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        if (pausedRef.current) return;
        const now = performance.now();
        if (now - lastSampleRef.current < frameIntervalMs) return;
        lastSampleRef.current = now;

        analyser.getFloatTimeDomainData(input);
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
        const rms = Math.sqrt(sumSq / input.length);
        const [freq, clarity] = detector.findPitch(input, ctx.sampleRate);

        const gates = gatesFor(sensitivityRef.current);
        // Meter: scale post-gain RMS to a readable 0..1 (voice sits ~0.05–0.3).
        setInputLevel(Math.min(1, rms * 4));
        const voicedRaw = clarity >= gates.clarity && rms >= gates.rms && freq > 0;
        const rec = recorderRef.current;

        // Skip-silence: while silent, pause the recorder AND freeze the take
        // clock, so voiced parts sit back-to-back with no dead time in the graph
        // or the recording. On the next voiced frame we shift the clock past the
        // skipped span and resume recording.
        if (silencePausedRef.current) {
          if (voicedRaw) {
            startTsRef.current += now - silenceEnterRef.current;
            if (rec && rec.state === 'paused') {
              try {
                rec.resume();
              } catch {
                /* ignore */
              }
            }
            silencePausedRef.current = false;
          } else {
            return; // still silent — no time advances, no points added
          }
        }

        const tMs = now - startTsRef.current;

        // Pitch-continuity guard: kill the downward plunges at phrase edges.
        // Autocorrelation often reports a sub-harmonic (~an octave too low), and
        // noise during pauses slips through as a garbage low pitch. Correct clear
        // octave-halving errors relative to the recent pitch, and drop any
        // remaining implausible downward leap to a clean pen-up (gap) instead of
        // drawing a line to the floor.
        let voiced = voicedRaw;
        let f = freq;
        if (voiced) {
          const prev = lastVoicedRef.current;
          if (prev && tMs - prev.tMs < 250) {
            if (f > prev.freq * 0.4 && f < prev.freq * 0.6) f *= 2; // ~octave low
            else if (f > prev.freq * 0.2 && f < prev.freq * 0.3) f *= 4; // ~2 octaves low
            else if (f > prev.freq * 1.7 && f < prev.freq * 2.5) f /= 2; // ~octave high
            if (Math.abs(12 * Math.log2(f / prev.freq)) > 10) voiced = false; // implausible leap
          }
        }

        if (voiced) {
          lastVoicedRef.current = { freq: f, tMs };
          hadVoiceRef.current = true;
          lastVoiceWallRef.current = now;
          setLive({ freq: f, clarity, note: freqToName(f), cents: centsOff(f) });
          onHitRef.current?.(f);
          pointsRef.current = [...pointsRef.current, { tMs, freq: f, clarity }];
        } else {
          setLive(null);
          const last = pointsRef.current[pointsRef.current.length - 1];
          if (!last || last.freq != null) {
            pointsRef.current = [...pointsRef.current, { tMs, freq: null, clarity }];
          }
        }
        setActivePoints(pointsRef.current);

        // Enter skip-silence once we've been quiet past the hold (a short grace
        // so brief consonant gaps inside a word don't trigger it). Pauses the
        // recorder and marks the clock to freeze from `now`.
        if (
          gateSilenceRef.current &&
          !silencePausedRef.current &&
          !voicedRaw &&
          now - lastVoiceWallRef.current > GATE_HOLD_MS
        ) {
          silencePausedRef.current = true;
          silenceEnterRef.current = now;
          if (rec && rec.state === 'recording') {
            try {
              rec.pause();
            } catch {
              /* ignore */
            }
          }
        }

        // Fixed mode: auto-stop the take at the loop length and arm for the next.
        if (loopModeRef.current === 'fixed' && !armingRef.current && tMs >= loopLengthMsRef.current) {
          armingRef.current = true;
          if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          armRef.current();
          return;
        }

        // Manual mode: auto-finish after we've heard voice and gone quiet a while.
        if (
          loopModeRef.current !== 'fixed' &&
          hadVoiceRef.current &&
          !autoStoppingRef.current &&
          now - lastVoiceWallRef.current > silenceStopMs
        ) {
          autoStoppingRef.current = true;
          if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          autoFinishRef.current();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [frameIntervalMs, silenceStopMs],
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
      // Must precede getUserMedia: a prior playback set the session to
      // 'playback', which iOS refuses to capture under ("AudioSession category
      // is not compatible with audio capture"). Reset to a capture-capable
      // category first.
      setAudioSession('play-and-record');
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
      analyserRef.current = analyser;
      // Extra headroom for detection on devices with weak AGC. This gain feeds
      // only the analyser — the MediaRecorder reads the raw stream, so recorded
      // audio is unaffected.
      const inputGain = ctx.createGain();
      inputGain.gain.value = gatesFor(sensitivityRef.current).gain;
      inputGainRef.current = inputGain;
      source.connect(inputGain).connect(analyser);

      setCommitted([]);
      setArmed(false);
      armedRef.current = false;
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
    lastVoicedRef.current = null;
    setActivePoints([]);
    startTsRef.current = performance.now();
    startRecorder();
  }, [commitTake, startRecorder]);

  // Fixed mode: commit the current take and wait (armed) for the next.
  const armCurrentTake = useCallback(async () => {
    await commitTake();
    pointsRef.current = [];
    lastVoicedRef.current = null;
    setActivePoints([]);
    setLive(null);
    setInputLevel(0);
    armedRef.current = true;
    setArmed(true);
  }, [commitTake]);
  armRef.current = armCurrentTake;

  // Fixed mode: begin recording the next fixed-length take.
  const recordNext = useCallback(() => {
    const ctx = ctxRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;
    armedRef.current = false;
    setArmed(false);
    beginAnalysis(ctx, analyser);
    startRecorder();
  }, [beginAnalysis, startRecorder]);

  /** Primary layer action — behaves per loop mode / armed state. */
  const advance = useCallback(async () => {
    // If paused, New Layer resumes recording first (no separate Resume tap).
    if (pausedRef.current) resumeRef.current();
    if (loopModeRef.current === 'fixed') {
      if (armedRef.current) {
        recordNext();
      } else {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        await armCurrentTake();
      }
    } else {
      await newLayer();
    }
  }, [recordNext, armCurrentTake, newLayer]);

  const finish = useCallback(async () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    await commitTake();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    inputGainRef.current = null;
    armedRef.current = false;
    pausedRef.current = false;
    setArmed(false);
    setPaused(false);
    setLive(null);
    setInputLevel(0);
    setActivePoints([]);
    setStatus('finished');
  }, [commitTake]);
  autoFinishRef.current = finish;

  const playAll = useCallback(async () => {
    // iOS: route to the "playback" session so the hardware mute switch doesn't
    // silence Web Audio.
    setAudioSession('playback');
    // After backgrounding, iOS may leave the context suspended/interrupted and
    // resume() alone doesn't recover it. Try to resume; if it won't run, rebuild
    // a fresh context (decoded AudioBuffers are context-independent, so playback
    // still works). This is what fixes "switch away and back → no sound".
    let ctx = ctxRef.current;
    if (ctx && ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    if (!ctx || ctx.state !== 'running') {
      try {
        await ctx?.close();
      } catch {
        /* ignore */
      }
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      await ctx.resume();
      ctxRef.current = ctx;
    }
    const withAudio = committed.filter((l) => l.audio);
    if (!withAudio.length) {
      setError('No recorded audio to play back — the take may not have captured. Try recording again.');
      return;
    }
    const gain = ctx.createGain();
    // Normalize quiet mic takes to a usable level, then keep headroom for the
    // number of overlapping layers so the sum doesn't clip.
    const peak = Math.max(...withAudio.map((l) => peakOf(l.audio!)), 1e-6);
    const makeup = Math.min(200, 0.9 / peak);
    gain.gain.value = makeup / Math.sqrt(withAudio.length);
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
    const startAt = ctx.currentTime;
    const totalMs = longest * 1000;
    setIsPlaying(true);
    setPlaybackMs(0);
    const track = () => {
      const t = (ctx.currentTime - startAt) * 1000;
      if (t >= totalMs) {
        setIsPlaying(false);
        setPlaybackMs(null);
        playRafRef.current = null;
        return;
      }
      setPlaybackMs(t);
      playRafRef.current = requestAnimationFrame(track);
    };
    playRafRef.current = requestAnimationFrame(track);
  }, [committed]);

  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    pauseStartRef.current = performance.now();
    try {
      recorderRef.current?.pause();
    } catch {
      /* ignore */
    }
    setPaused(true);
    setLive(null);
    setInputLevel(0);
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    // Shift the time base forward by the paused span so the contour stays
    // aligned with the (also paused) recorded audio — no gap on resume.
    const d = performance.now() - pauseStartRef.current;
    startTsRef.current += d;
    lastVoiceWallRef.current += d;
    lastSampleRef.current += d;
    pausedRef.current = false;
    try {
      recorderRef.current?.resume();
    } catch {
      /* ignore */
    }
    setPaused(false);
  }, []);
  resumeRef.current = resume;

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
    if (playRafRef.current != null) cancelAnimationFrame(playRafRef.current);
    playRafRef.current = null;
    setIsPlaying(false);
    setPlaybackMs(null);
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
    inputGainRef.current = null;
    armedRef.current = false;
    pausedRef.current = false;
    setArmed(false);
    setPaused(false);
    setCommitted([]);
    setActivePoints([]);
    setLive(null);
    setInputLevel(0);
    setStatus('idle');
  }, [stopPlayback]);

  return {
    status,
    error,
    committed,
    activePoints,
    live,
    isPlaying,
    paused,
    armed,
    playbackMs,
    inputLevel,
    sensitivity,
    setSensitivity,
    start,
    newLayer,
    advance,
    finish,
    pause,
    resume,
    playAll,
    stopPlayback,
    playHitTone,
    reset,
  };
}
