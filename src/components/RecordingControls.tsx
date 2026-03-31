import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export const RecordingControls = ({
  isRecording,
  isPaused,
  recordingTime,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset,
  disabled = false,
}: RecordingControlsProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-3xl font-mono text-gray-700">
        {formatTime(recordingTime)}
      </div>

      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            onClick={onStart}
            disabled={disabled}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={onResume}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                <Play className="w-5 h-5" />
                Resume
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}

            <button
              onClick={onStop}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          </>
        )}

        {recordingTime > 0 && !isRecording && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
