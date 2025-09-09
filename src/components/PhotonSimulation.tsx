import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";

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

interface PhotonSimulationProps {
  settings: {
    rotationSpeed: number;
    sphereTransparency: number;
    photonSpeed: number;
    stepDistance: number;
    photonSize: number;
  };
  photons: PhotonData[];
  trails: PhotonTrail[];
  isPaused: boolean;
  onPhotonsUpdate: (photons: PhotonData[], completedTrails?: PhotonTrail[]) => void;
}

interface SceneProps extends PhotonSimulationProps {
  cameraDistance: number;
}

const SPHERE_RADIUS = 3.5; // Increased from 2.5
const MAX_DISTANCE = 25;

function Photon({ 
  photon, 
  settings, 
  isPaused,
  onUpdate 
}: { 
  photon: PhotonData; 
  settings: PhotonSimulationProps['settings'];
  isPaused: boolean;
  onUpdate: (photon: PhotonData) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pathGroupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (!photon || isPaused) return;

    const newPhoton = { ...photon };
    const speed = settings.photonSpeed * delta * 2;
    
    // Force initial path update if path is too short
    if (newPhoton.path.length < 2) {
      newPhoton.path.push(newPhoton.position.clone());
    }

    if (!newPhoton.isOutside) {
      // Random walk inside sphere
      if (Math.random() < 0.3) { // Change direction occasionally
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        newPhoton.velocity = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).multiplyScalar(settings.stepDistance);
      }

      newPhoton.position.add(newPhoton.velocity.clone().multiplyScalar(speed));
      newPhoton.distanceFromCenter = newPhoton.position.length();

      if (newPhoton.distanceFromCenter >= SPHERE_RADIUS) {
        // Hit sphere boundary - transition to straight line
        newPhoton.isOutside = true;
        newPhoton.position.normalize().multiplyScalar(SPHERE_RADIUS);
        newPhoton.velocity = newPhoton.position.clone().normalize().multiplyScalar(0.5);
      }
    } else {
      // Straight line outside sphere
      newPhoton.position.add(newPhoton.velocity.clone().multiplyScalar(speed * 3));
      newPhoton.distanceFromCenter = newPhoton.position.length();
    }

    // Add to path
    if (newPhoton.path.length === 0 || 
        newPhoton.path[newPhoton.path.length - 1].distanceTo(newPhoton.position) > 0.05) {
      newPhoton.path.push(newPhoton.position.clone());
    }

    onUpdate(newPhoton);

    // Update mesh position
    if (meshRef.current) {
      meshRef.current.position.copy(newPhoton.position);
    }
  });

  // Create path lines
  const pathLines = useMemo(() => {
    console.log(`Photon ${photon.id} path length:`, photon.path.length, 'isPaused:', isPaused);
    if (photon.path.length < 2) {
      console.log(`Photon ${photon.id} has insufficient path points`);
      return [];
    }
    
    const lines: JSX.Element[] = [];
    
    for (let i = 0; i < photon.path.length - 1; i++) {
      const start = photon.path[i];
      const end = photon.path[i + 1];
      
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        start.x, start.y, start.z,
        end.x, end.y, end.z
      ]);
      const positionAttribute = new THREE.BufferAttribute(positions, 3);
      geometry.setAttribute('position', positionAttribute);
      
      // Mark geometry as dirty to ensure proper rendering
      positionAttribute.needsUpdate = true;
      geometry.computeBoundingSphere();
      
      const distanceFromCenter = start.length();
      let color: THREE.Color;
      let opacity = 1.0; // Always fully visible
      
      if (distanceFromCenter <= SPHERE_RADIUS) {
        // Inside sphere: gradient from dark red to bright orange
        const t = distanceFromCenter / SPHERE_RADIUS;
        color = new THREE.Color().lerpColors(
          new THREE.Color(0x370307), // photon-start
          new THREE.Color(0xc85e0a), // photon-end
          t
        );
      } else {
        // Outside sphere: bright orange fading with distance
        color = new THREE.Color(0xc85e0a);
        const fadeDistance = Math.max(0, (distanceFromCenter - SPHERE_RADIUS) / 10);
        opacity = Math.max(0.1, Math.exp(-fadeDistance)); // Keep fade-out effect but remove transparency control
      }
      
      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: opacity < 1,
        opacity: opacity,
        linewidth: 1,
        visible: true,
      });
      
      console.log(`Creating line segment ${i} for photon ${photon.id} with opacity:`, opacity, 'color:', color.getHexString());
      
      lines.push(
        <primitive 
          key={`photon-${photon.id}-segment-${i}`}
          object={new THREE.Line(geometry, material)} 
        />
      );
    }
    
    console.log(`Photon ${photon.id} created ${lines.length} line segments`);
    return lines;
  }, [photon.path, photon.id]);

  return (
    <group>
      {/* Photon particle */}
      <mesh ref={meshRef} position={photon.position}>
        <sphereGeometry args={[settings.photonSize * 0.01, 8, 8]} />
        <meshBasicMaterial 
          color={0xffffff} 
          transparent 
          opacity={0.9}
        />
      </mesh>
      
      {/* Path trail */}
      <group ref={pathGroupRef}>
        {pathLines}
      </group>
    </group>
  );
}

function Sun({ transparency }: { transparency: number }) {
  return (
    <mesh>
      <sphereGeometry args={[SPHERE_RADIUS, 32, 32]} />
      <meshBasicMaterial 
        transparent 
        opacity={transparency} 
        color={0xffffff}
        wireframe
      />
    </mesh>
  );
}

function TrailRenderer({ trail, settings }: { trail: PhotonTrail; settings: PhotonSimulationProps['settings'] }) {
  const pathLines = useMemo(() => {
    console.log(`Trail ${trail.id} path length:`, trail.path.length);
    
    // Ensure trail has at least 2 points for visibility
    let processedPath = [...trail.path];
    if (processedPath.length < 2 && processedPath.length > 0) {
      // Duplicate the starting position to create a minimal visible line
      processedPath.push(processedPath[0].clone());
    }
    if (processedPath.length < 2) return [];
    
    const lines: JSX.Element[] = [];
    
    for (let i = 0; i < processedPath.length - 1; i++) {
      const start = processedPath[i];
      const end = processedPath[i + 1];
      
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        start.x, start.y, start.z,
        end.x, end.y, end.z
      ]);
      const positionAttribute = new THREE.BufferAttribute(positions, 3);
      geometry.setAttribute('position', positionAttribute);
      
      // Mark geometry as dirty to ensure proper rendering
      positionAttribute.needsUpdate = true;
      geometry.computeBoundingSphere();
      
      const distanceFromCenter = start.length();
      let color: THREE.Color;
      let opacity = 1.0; // Always fully visible
      
      if (distanceFromCenter <= SPHERE_RADIUS) {
        const t = distanceFromCenter / SPHERE_RADIUS;
        color = new THREE.Color().lerpColors(
          new THREE.Color(0x370307),
          new THREE.Color(0xc85e0a),
          t
        );
      } else {
        color = new THREE.Color(0xc85e0a);
        const fadeDistance = Math.max(0, (distanceFromCenter - SPHERE_RADIUS) / 10);
        opacity = Math.max(0.1, Math.exp(-fadeDistance)); // Keep fade-out effect but remove transparency control
      }
      
      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: opacity < 1,
        opacity: opacity,
        linewidth: 1,
        visible: true,
      });
      
      lines.push(
        <primitive 
          key={`trail-${trail.id}-segment-${i}`}
          object={new THREE.Line(geometry, material)} 
        />
      );
    }
    
    return lines;
  }, [trail.path, trail.id]);

  return <group>{pathLines}</group>;
}

function Scene({ settings, photons, trails, isPaused, onPhotonsUpdate, cameraDistance }: SceneProps) {
  const { camera, scene, gl } = useThree();
  const orbitRef = useRef<any>();
  const [isUserControlling, setIsUserControlling] = useState(false);

  // Function to export 3D scene as GLB
  const export3D = useCallback(() => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'photon-simulation.glb';
        link.click();
        URL.revokeObjectURL(url);
      },
      (error) => {
        console.error('Export failed:', error);
      },
      { binary: true }
    );
  }, [scene]);

  // Expose export function globally
  useEffect(() => {
    (window as any).exportPhotonSimulation3D = export3D;
  }, [export3D]);
  
  useFrame((state) => {
    // Only auto-rotate if user is not manually controlling and rotation speed > 0
    if (settings.rotationSpeed > 0 && !isPaused && !isUserControlling) {
      const radius = cameraDistance;
      camera.position.x = Math.cos(state.clock.elapsedTime * settings.rotationSpeed * 0.1) * radius;
      camera.position.z = Math.sin(state.clock.elapsedTime * settings.rotationSpeed * 0.1) * radius;
      camera.lookAt(0, 0, 0);
    }
  });

  const handlePhotonUpdate = useCallback((updatedPhoton: PhotonData) => {
    const newPhotons = photons.map(p => 
      p.id === updatedPhoton.id ? updatedPhoton : p
    );
    onPhotonsUpdate(newPhotons);
  }, [photons, onPhotonsUpdate]);

  // Remove photons that are too far away and spawn new ones
  useEffect(() => {
    const activePhotons = photons.filter(p => p.distanceFromCenter < MAX_DISTANCE);
    const removedPhotons = photons.filter(p => p.distanceFromCenter >= MAX_DISTANCE);
    
    // Convert removed photons to trails, ensuring they have at least 2 points
    const newTrails = removedPhotons.map(p => {
      let trailPath = [...p.path];
      // Ensure trail has at least 2 points for immediate visibility
      if (trailPath.length < 2 && trailPath.length > 0) {
        trailPath.push(trailPath[0].clone());
      } else if (trailPath.length === 0) {
        // Fallback: create a minimal trail at the photon's last position
        trailPath = [p.position.clone(), p.position.clone()];
      }
      return { id: p.id, path: trailPath };
    });
    
    // If we removed photons (they went too far), add a new one to maintain at least 1
    if (activePhotons.length < photons.length && activePhotons.length === 0) {
      // Create a new photon at center
      const newPhoton: PhotonData = {
        id: Date.now(),
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        path: [new THREE.Vector3(0, 0, 0)],
        isOutside: false,
        distanceFromCenter: 0,
      };
      onPhotonsUpdate([newPhoton], newTrails);
    } else if (activePhotons.length !== photons.length) {
      onPhotonsUpdate(activePhotons, newTrails);
    }
  }, [photons, onPhotonsUpdate]);

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        minDistance={cameraDistance}
        maxDistance={cameraDistance}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        onStart={() => setIsUserControlling(true)}
        onEnd={() => setIsUserControlling(false)}
      />
      
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={1} color={0xffe000} />
      
      <Sun transparency={settings.sphereTransparency} />
      
      {/* Render completed trails */}
      {trails.map(trail => (
        <TrailRenderer
          key={trail.id}
          trail={trail}
          settings={settings}
        />
      ))}
      
      {/* Render active photons */}
      {photons.map(photon => (
        <Photon
          key={photon.id}
          photon={photon}
          settings={settings}
          isPaused={isPaused}
          onUpdate={handlePhotonUpdate}
        />
      ))}
      
      {/* Zoom controls - remove since zoom is handled outside */}
    </>
  );
}

export default function PhotonSimulation({ settings, photons, trails, isPaused, onPhotonsUpdate }: PhotonSimulationProps) {
  const [cameraDistance, setCameraDistance] = useState(10); // Increased to show full sphere initially

  const handleZoomIn = () => setCameraDistance(prev => Math.max(5, prev - 0.5));
  const handleZoomOut = () => setCameraDistance(prev => Math.min(15, prev + 0.5));

  return (
    <div className="w-full h-full solar-gradient relative">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }} // Match initial cameraDistance
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene 
          settings={settings} 
          photons={photons}
          trails={trails}
          isPaused={isPaused}
          onPhotonsUpdate={onPhotonsUpdate} 
          cameraDistance={cameraDistance}
        />
      </Canvas>
      
      {/* Zoom Control Buttons */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-12 h-12 bg-black/20 hover:bg-black/30 border border-white/20 rounded-full flex items-center justify-center text-white text-lg font-bold transition-all duration-300 ease-out"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-12 h-12 bg-black/20 hover:bg-black/30 border border-white/20 rounded-full flex items-center justify-center text-white text-lg font-bold transition-all duration-300 ease-out"
          title="Zoom Out"
        >
          -
        </button>
      </div>
    </div>
  );
}