interface VideoPreviewProps {
  videoRef: (ref: HTMLVideoElement | null) => void;
  isRecording: boolean;
}

export const VideoPreview = ({ videoRef, isRecording }: VideoPreviewProps) => {
  return (
    <div className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black aspect-video shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        muted
        className="w-full h-full object-cover"
      />
      {isRecording && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs font-semibold">REC</span>
        </div>
      )}
    </div>
  );
};
