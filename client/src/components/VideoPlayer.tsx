import { useRef, useEffect } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
}

export function VideoPlayer({ stream, muted = false, label }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={stream ? 'has-stream' : ''}
      />
      <span className="video-label">{label}</span>
    </div>
  );
}
