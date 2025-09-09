import { useState } from "react";

interface StartOverlayProps {
  onStart: () => void;
}

export default function StartOverlay({ onStart }: StartOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleStart = () => {
    setIsVisible(false);
    setTimeout(() => {
      onStart();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className="overlay-start"
      onClick={handleStart}
    >
      <div className="sun-button">
        <div className="relative">
          {/* Sun emoji as background */}
          <div 
            className="text-9xl select-none"
            style={{ filter: 'drop-shadow(0 0 20px rgba(255, 224, 0, 0.5))' }}
          >
            ☀️
          </div>
          
          {/* Start text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-photon-start tracking-wider">
              Start
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}