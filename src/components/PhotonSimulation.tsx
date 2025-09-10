import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";

// Helper function to convert trail path into tube mesh for export
function addTrailMesh(group: THREE.Group, path: THREE.Vector3[], radius = 0.01) {
  if (!path || path.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(path);
  const tubularSegments = Math.min(2000, path.length * 2);
  const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false);
  const material = new THREE.MeshBasicMaterial({ color: 0xc85e0a });
  const mesh = new THREE.Mesh(tube, material);
  group.add(mesh);
}

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
const MAX_TRAIL_SEGMENTS = 2000;
const DISTANCE_THRESHOLD = 0.1; // Increased from 0.05

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
      newPhoton.path = [...newPhoton.path, newPhoton.position.clone()];
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

    // Add to path immutably with increased threshold
    if (newPhoton.path.length === 0 || 
        newPhoton.path[newPhoton.path.length - 1].distanceTo(newPhoton.position) > DISTANCE_THRESHOLD) {
      newPhoton.path = [...newPhoton.path, newPhoton.position.clone()];
    }

    onUpdate(newPhoton);

    // Update mesh position
    if (meshRef.current) {
      meshRef.current.position.copy(newPhoton.position);
    }
  });

  const lineRef = useRef<THREE.Line>();
  const positionsRef = useRef<Float32Array>();
  const geometryRef = useRef<THREE.BufferGeometry>();
  const materialRef = useRef<THREE.LineBasicMaterial>();

  // Initialize line object once
  useEffect(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_TRAIL_SEGMENTS * 2 * 3);
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_SEGMENTS * 2 * 3), 3));
    
    const line = new THREE.Line(geometry, material);
    
    lineRef.current = line;
    positionsRef.current = positions;
    geometryRef.current = geometry;
    materialRef.current = material;
    
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, []);

  // Update line geometry when path changes
  useEffect(() => {
    if (!lineRef.current || !positionsRef.current || !geometryRef.current) return;
    
    const ensureTwoPoints = (arr: THREE.Vector3[]) =>
      arr.length >= 2 ? arr : arr.length === 1 ? [arr[0], arr[0].clone()] : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    
    const pts = ensureTwoPoints(photon.path);
    const positions = positionsRef.current;
    const geometry = geometryRef.current;
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;
    
    const segmentCount = Math.min(pts.length - 1, MAX_TRAIL_SEGMENTS);
    
    for (let i = 0; i < segmentCount; i++) {
      const start = pts[i];
      const end = pts[i + 1];
      const offset = i * 6;
      const colorOffset = i * 6;
      
      // Set positions
      positions[offset] = start.x;
      positions[offset + 1] = start.y;
      positions[offset + 2] = start.z;
      positions[offset + 3] = end.x;
      positions[offset + 4] = end.y;
      positions[offset + 5] = end.z;
      
      // Set colors
      const distanceFromCenter = start.length();
      let color: THREE.Color;
      
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
        const fade = Math.max(0.1, Math.exp(-fadeDistance));
        color.multiplyScalar(fade);
      }
      
      colorAttribute.array[colorOffset] = color.r;
      colorAttribute.array[colorOffset + 1] = color.g;
      colorAttribute.array[colorOffset + 2] = color.b;
      colorAttribute.array[colorOffset + 3] = color.r;
      colorAttribute.array[colorOffset + 4] = color.g;
      colorAttribute.array[colorOffset + 5] = color.b;
    }
    
    geometry.setDrawRange(0, segmentCount * 2);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeBoundingSphere();
  }, [photon.path.length]);

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
        {lineRef.current && <primitive object={lineRef.current} />}
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
  const lineRef = useRef<THREE.Line>();
  const positionsRef = useRef<Float32Array>();
  const geometryRef = useRef<THREE.BufferGeometry>();
  const materialRef = useRef<THREE.LineBasicMaterial>();
  const isInitialized = useRef(false);

  // Initialize line object once and freeze it (completed trail)
  useEffect(() => {
    if (isInitialized.current) return;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_TRAIL_SEGMENTS * 2 * 3);
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_SEGMENTS * 2 * 3), 3));
    
    const line = new THREE.Line(geometry, material);
    
    lineRef.current = line;
    positionsRef.current = positions;
    geometryRef.current = geometry;
    materialRef.current = material;
    
    // Build trail geometry once (frozen trail)
    const ensureTwoPoints = (arr: THREE.Vector3[]) =>
      arr.length >= 2 ? arr : arr.length === 1 ? [arr[0], arr[0].clone()] : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    
    const tpts = ensureTwoPoints(trail.path);
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;
    
    const segmentCount = Math.min(tpts.length - 1, MAX_TRAIL_SEGMENTS);
    
    for (let i = 0; i < segmentCount; i++) {
      const start = tpts[i];
      const end = tpts[i + 1];
      const offset = i * 6;
      const colorOffset = i * 6;
      
      // Set positions
      positions[offset] = start.x;
      positions[offset + 1] = start.y;
      positions[offset + 2] = start.z;
      positions[offset + 3] = end.x;
      positions[offset + 4] = end.y;
      positions[offset + 5] = end.z;
      
      // Set colors
      const distanceFromCenter = start.length();
      let color: THREE.Color;
      
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
        const fade = Math.max(0.1, Math.exp(-fadeDistance));
        color.multiplyScalar(fade);
      }
      
      colorAttribute.array[colorOffset] = color.r;
      colorAttribute.array[colorOffset + 1] = color.g;
      colorAttribute.array[colorOffset + 2] = color.b;
      colorAttribute.array[colorOffset + 3] = color.r;
      colorAttribute.array[colorOffset + 4] = color.g;
      colorAttribute.array[colorOffset + 5] = color.b;
    }
    
    geometry.setDrawRange(0, segmentCount * 2);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeBoundingSphere();
    
    isInitialized.current = true;
    
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return <group>{lineRef.current && <primitive object={lineRef.current} />}</group>;
}

function Scene({ settings, photons, trails, isPaused, onPhotonsUpdate, cameraDistance }: SceneProps) {
  const { camera, scene, gl } = useThree();
  const orbitRef = useRef<any>();
  const [isUserControlling, setIsUserControlling] = useState(false);

  // Function to export 3D scene as GLB with trail meshes
  const export3D = useCallback(() => {
    const exportGroup = new THREE.Group();

    // Sphere (export as a simple mesh)
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    exportGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

    // Trails (completed)
    trails.forEach(trail => {
      addTrailMesh(exportGroup, trail.path, settings.photonSize * 0.002);
    });

    // Active photons' current paths
    photons.forEach(photon => {
      addTrailMesh(exportGroup, photon.path, settings.photonSize * 0.002);
    });

    exportGroup.updateMatrixWorld(true);

    const exporter = new GLTFExporter();
    exporter.parse(
      exportGroup,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "photon-simulation.glb";
        link.click();
        URL.revokeObjectURL(url);
      },
      (error) => {
        console.error('Export failed:', error);
      },
      { binary: true, onlyVisible: true }
    );
  }, [photons, trails, settings.photonSize]);

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
      // Create a new photon at center with two points for immediate trail visibility
      const start = new THREE.Vector3(0, 0, 0);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      );
      const second = start.clone().add(vel.clone().multiplyScalar(0.01));
      
      const newPhoton: PhotonData = {
        id: Date.now(),
        position: new THREE.Vector3(0, 0, 0),
        velocity: vel,
        path: [start, second],
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
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ 
          antialias: false, // Optimized: disable for performance
          alpha: true
        }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        }}
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