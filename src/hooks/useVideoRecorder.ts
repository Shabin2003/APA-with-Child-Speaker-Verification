import { useRef, useState, useCallback } from 'react';

export const useVideoRecorder = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    videoRef.current = ref;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      chunksRef.current = [];

      // Pick the best supported video MIME type.
      // Safari/iOS does not support video/webm — fall back to video/mp4.
      const PREFERRED_VIDEO_TYPES = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType = PREFERRED_VIDEO_TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('Failed to start recording:', err);
      const name = err instanceof Error ? err.name : '';
      const msg  = err instanceof Error ? err.message : String(err);

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        // User dismissed or denied the browser permission popup.
        // Fire a custom event so the component can show an inline error
        // instead of leaving the UI silently frozen.
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setVideoBlob(null);

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);

    chunksRef.current = [];

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, [isRecording, videoUrl]);

  return {
    setVideoRef,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    isRecording,
    isPaused,
    recordingTime,
    videoBlob,
    videoUrl,
  };
};