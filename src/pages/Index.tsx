import { useState, useCallback } from "react";
import PhotonSimulation from "@/components/PhotonSimulation";
import ControlPanel from "@/components/ControlPanel";
import * as THREE from "three";

interface PhotonData {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  path: THREE.Vector3[];
  isOutside: boolean;
  distanceFromCenter: number;
}

interface PhotonTrail {
  id: number;
  path: THREE.Vector3[];
}

const DEFAULT_SETTINGS = {
  rotationSpeed: 0.3,
  sphereTransparency: 0.4,
  photonSpeed: 1.0,
  stepDistance: 0.625, // Increased by 25% from 0.5
  photonSize: 3,
};

const MAX_PHOTONS = 8;

let photonIdCounter = 0;

function createPhoton(): PhotonData {
  const startPos = new THREE.Vector3(0, 0, 0);
  const velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.1,
    (Math.random() - 0.5) * 0.1,
    (Math.random() - 0.5) * 0.1
  );
  
  // Create initial path with 2 points so trail can render immediately
  const secondPos = startPos.clone().add(velocity.clone().multiplyScalar(0.01));
  
  return {
    id: photonIdCounter++,
    position: startPos.clone(),
    velocity: velocity,
    path: [startPos.clone(), secondPos], // Start with 2 points for immediate trail visibility
    isOutside: false,
    distanceFromCenter: 0,
  };
}

export default function Index() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [photons, setPhotons] = useState<PhotonData[]>([createPhoton()]);
  const [trails, setTrails] = useState<PhotonTrail[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const handleReset = useCallback(() => {
    setPhotons([createPhoton()]);
    setTrails([]);
  }, []);

  const handleAddPhoton = useCallback(() => {
    if (photons.length < MAX_PHOTONS) {
      setPhotons(prev => [...prev, createPhoton()]);
    }
  }, [photons.length]);

  const handlePhotonsUpdate = useCallback((updatedPhotons: PhotonData[], completedTrails?: PhotonTrail[]) => {
    setPhotons(updatedPhotons);
    if (completedTrails) {
      setTrails(prev => [...prev, ...completedTrails]);
    }
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <PhotonSimulation
        settings={settings}
        photons={photons}
        trails={trails}
        isPaused={isPaused}
        onPhotonsUpdate={handlePhotonsUpdate}
      />
      
      <ControlPanel
        settings={settings}
        onSettingsChange={setSettings}
        onReset={handleReset}
        onAddPhoton={handleAddPhoton}
        photonCount={photons.length}
        maxPhotons={MAX_PHOTONS}
        isPaused={isPaused}
        onPauseToggle={() => setIsPaused(!isPaused)}
      />
    </div>
  );
}