import { useEffect, useRef } from "react";

interface AudioManagerProps {
  isPlaying: boolean;
  onError?: () => void;
}

export default function AudioManager({ isPlaying, onError }: AudioManagerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://sandbox.evan-roth.com/namur/assets/music/R4MP-D4yl1ght.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7;
      
      audioRef.current.addEventListener('error', () => {
        console.warn('Audio failed to load, continuing without sound');
        onError?.();
      });
    }

    const audio = audioRef.current;

    if (isPlaying) {
      audio.play().catch((error) => {
        console.warn('Audio playback failed:', error);
        onError?.();
      });
    } else {
      audio.pause();
    }

    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [isPlaying, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('error', () => {});
      }
    };
  }, []);

  return null;
}