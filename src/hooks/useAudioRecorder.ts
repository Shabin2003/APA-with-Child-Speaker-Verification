import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

export const useAudioRecorder = () => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioBlob: null,
    audioUrl: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Pick the best supported audio MIME type.
      // Preference order: wav (best for ASR), then ogg/opus, then webm/opus,
      // then plain webm.  Safari supports audio/mp4 but not webm.
      const PREFERRED_TYPES = [
        'audio/wav',
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const mimeType = PREFERRED_TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const audioUrl = URL.createObjectURL(audioBlob);
        setState((prev) => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false,
        }));
      };

      mediaRecorder.start();
      setState((prev) => ({
        ...prev,
        isRecording: true,
        recordingTime: 0,
        audioBlob: null,
        audioUrl: null,
      }));

      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);
    } catch (error: unknown) {
      console.error('Error starting recording:', error);
      const name = error instanceof Error ? error.name : '';
      const msg  = error instanceof Error ? error.message : String(error);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        window.dispatchEvent(new CustomEvent('recording-permission-denied', {
          detail: { reason: 'dismissed' },
        }));
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        window.dispatchEvent(new CustomEvent('recording-permission-denied', {
          detail: { reason: 'no-device' },
        }));
      } else {
        window.dispatchEvent(new CustomEvent('recording-permission-denied', {
          detail: { reason: msg },
        }));
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, [state.isPaused]);

  const resetRecording = useCallback(() => {
    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioBlob: null,
      audioUrl: null,
    });
    audioChunksRef.current = [];
  }, []);

  const getAnalyser = useCallback(() => {
    return analyserRef.current;
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAnalyser,
  };
};