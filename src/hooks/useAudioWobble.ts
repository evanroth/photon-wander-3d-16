import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioWobbleHook {
  isActive: boolean;
  audioLevel: number;
  toggleMic: () => void;
  error: string | null;
}

export function useAudioWobble(): AudioWobbleHook {
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    dataArrayRef.current = null;
    setAudioLevel(0);
  }, []);

  const startAudio = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      micStreamRef.current = stream;
      
      // Create audio context and analyser
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      // Start analysis loop
      const analyze = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Calculate RMS energy from mid-frequency range (roughly 200Hz-2kHz)
        const midStart = 8;  // Rough 200Hz at 44.1kHz sample rate
        const midEnd = 32;   // Rough 2kHz
        let sum = 0;
        
        for (let i = midStart; i < Math.min(midEnd, dataArrayRef.current.length); i++) {
          const normalized = dataArrayRef.current[i] / 255;
          sum += normalized * normalized;
        }
        
        const rms = Math.sqrt(sum / (midEnd - midStart));
        setAudioLevel(Math.min(1, rms * 2)); // Scale and clamp
        
        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      
      analyze();
      return true;
      
    } catch (err) {
      console.error('Microphone access denied:', err);
      setError('Microphone access denied');
      return false;
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (isActive) {
      stopAudio();
      setIsActive(false);
    } else {
      const success = await startAudio();
      if (success) {
        setIsActive(true);
      }
    }
  }, [isActive, startAudio, stopAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return {
    isActive,
    audioLevel,
    toggleMic,
    error
  };
}