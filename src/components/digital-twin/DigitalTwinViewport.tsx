/**
 * DigitalTwinViewport — Three.js 3D conveyor belt Digital Twin.
 *
 * Replaces the SVG-based DigitalTwinCanvas with a real 3D WebGL scene.
 *
 * Camera modes (matching reference HTML):
 *   orbit   — standard OrbitControls engineering overview
 *   walkway — first-person walkway along the belt
 *   cross   — 35° cross-section inspection angle
 *
 * Scene:
 *   - Conveyor belt loop (extruded curved path)
 *   - Idler rolls
 *   - Splice markers (colored by condition, pulsing for anomalies)
 *   - Sensor gantry at 210m
 *   - Anomaly highlight at splice location
 *   - Grid floor plane
 *
 * All data from props — no independent state.
 * Proper cleanup on unmount to avoid WebGL memory leaks.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Splice, SpliceId, Conveyor } from '../../types';
import { LayerVisibility, ViewMode } from './DigitalTwinCanvas';

// ─── Props ────────────────────────────────────────────────────────────────────
interface DigitalTwinViewportProps {
  conveyor: Conveyor;
  splices: Record<string, Splice>;
  selectedSpliceId: SpliceId;
  onSelectSplice: (id: SpliceId) => void;
  viewMode: ViewMode;
  layers: LayerVisibility;
  inspectionStatus: string;
  isCameraContaminated: boolean;
  onViewportReady?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BELT_LENGTH = 420;          // meters — real scale 1 unit = 1 m
const BELT_WIDTH = 1.8;           // 1800mm belt
const BELT_HEIGHT = 0.06;         // belt thickness
const LOOP_HALF_LENGTH = BELT_LENGTH / 2;  // half-length of the straight run
const PULLEY_RADIUS = 2.5;        // head/tail pulley radius (m)
const IDLER_SPACING = 20;         // idlers every 20m
const BELT_Y = 0;                 // belt center height

// Condition → hex color
function spliceColorHex(condition: string): number {
  if (condition === 'Critical') return 0xef4444;
  if (condition === 'Warning') return 0xf59e0b;
  return 0x10b981;
}

// ─── Scene builder (runs once per mount) ─────────────────────────────────────
interface SceneObjects {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  spliceMarkers: Map<SpliceId, THREE.Mesh>;
  anomalyRings: Map<SpliceId, THREE.Mesh>;
  sensorGantry: THREE.Group;
  scanBeam: THREE.Mesh;
  frameId: number;
  clock: THREE.Clock;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  spliceIdMap: Map<THREE.Mesh, SpliceId>;
}

function buildScene(
  canvas: HTMLCanvasElement,
  conveyor: Conveyor,
  splices: Record<string, Splice>,
  layers: LayerVisibility,
  onSelectSplice: (id: SpliceId) => void
): SceneObjects {
  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x071224, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // ── Scene ──
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x071224, 0.006);

  // ── Camera ──
  const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 2000);
  camera.position.set(0, 120, 180);
  camera.lookAt(0, 0, 0);

  // ── OrbitControls ──
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 10;
  controls.maxDistance = 600;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.target.set(0, 0, 0);

  // ── Lighting ──
  const ambientLight = new THREE.AmbientLight(0x1a2744, 3.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x7ec8f4, 4.0);
  dirLight.position.set(60, 120, 80);
  dirLight.castShadow = true;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.camera.left = -250;
  dirLight.shadow.camera.right = 250;
  dirLight.shadow.camera.top = 100;
  dirLight.shadow.camera.bottom = -100;
  dirLight.shadow.mapSize.set(2048, 2048);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x334455, 1.5);
  fillLight.position.set(-40, 30, -60);
  scene.add(fillLight);

  // Point light above gantry
  const gantryLight = new THREE.PointLight(0xa855f7, 80, 60);
  gantryLight.position.set(0, 12, 0);
  scene.add(gantryLight);

  // ── Grid floor ──
  const gridHelper = new THREE.GridHelper(500, 50, 0x1a2a3a, 0x0f1e2e);
  gridHelper.position.y = -3.5;
  scene.add(gridHelper);

  // Fog plane beneath belt
  const fogGeo = new THREE.PlaneGeometry(600, 600);
  const fogMat = new THREE.MeshBasicMaterial({ color: 0x071224, transparent: true, opacity: 0.4 });
  const fogPlane = new THREE.Mesh(fogGeo, fogMat);
  fogPlane.rotation.x = -Math.PI / 2;
  fogPlane.position.y = -3.8;
  scene.add(fogPlane);

  // ── Belt geometry ──
  // Straight top run: z from -LOOP_HALF_LENGTH to +LOOP_HALF_LENGTH
  // Head pulley at +z, tail at -z
  const beltMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.1,
  });
  const oreMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 1.0,
    metalness: 0.0,
  });

  // Top carrying run
  const topBeltGeo = new THREE.BoxGeometry(BELT_WIDTH, BELT_HEIGHT, BELT_LENGTH);
  const topBelt = new THREE.Mesh(topBeltGeo, beltMat);
  topBelt.position.set(0, BELT_Y, 0);
  topBelt.receiveShadow = true;
  scene.add(topBelt);

  // Iron ore burden on top run
  const oreGeo = new THREE.BoxGeometry(BELT_WIDTH * 0.75, 0.35, BELT_LENGTH * 0.95);
  const oreMesh = new THREE.Mesh(oreGeo, oreMat);
  oreMesh.position.set(0, BELT_Y + 0.18, 0);
  oreMesh.castShadow = true;
  scene.add(oreMesh);

  // Return run (bottom, below main structure)
  const returnBeltGeo = new THREE.BoxGeometry(BELT_WIDTH, BELT_HEIGHT, BELT_LENGTH);
  const returnBelt = new THREE.Mesh(returnBeltGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
  returnBelt.position.set(0, BELT_Y - 4.0, 0);
  scene.add(returnBelt);

  // ── Head pulley ──
  const pulleyGeo = new THREE.CylinderGeometry(PULLEY_RADIUS, PULLEY_RADIUS, BELT_WIDTH + 0.3, 32);
  const pulleyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });

  const headPulley = new THREE.Mesh(pulleyGeo, pulleyMat);
  headPulley.rotation.z = Math.PI / 2;
  headPulley.position.set(0, BELT_Y, LOOP_HALF_LENGTH);
  scene.add(headPulley);

  // Tail pulley
  const tailPulley = headPulley.clone();
  tailPulley.position.set(0, BELT_Y, -LOOP_HALF_LENGTH);
  scene.add(tailPulley);

  // Head pulley glow ring
  const ringGeo = new THREE.TorusGeometry(PULLEY_RADIUS + 0.3, 0.12, 12, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
  const headRing = new THREE.Mesh(ringGeo, ringMat);
  headRing.rotation.z = Math.PI / 2;
  headRing.position.copy(headPulley.position);
  scene.add(headRing);

  const tailRing = headRing.clone();
  (tailRing.material as THREE.MeshBasicMaterial).color.set(0x10b981);
  tailRing.position.copy(tailPulley.position);
  scene.add(tailRing);

  // ── Structural trusses (simplified I-beam pairs) ──
  const trussPositions = [-160, -100, -40, 20, 80, 140, 170];
  trussPositions.forEach((z) => {
    const colGeo = new THREE.BoxGeometry(0.3, 6.5, 0.3);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.7 });
    [-1.3, 1.3].forEach((x) => {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(x, BELT_Y - 2.8, z);
      col.castShadow = true;
      scene.add(col);
    });
    // Cross beam
    const beamGeo = new THREE.BoxGeometry(3.0, 0.25, 0.25);
    const beam = new THREE.Mesh(beamGeo, colMat);
    beam.position.set(0, BELT_Y + 0.5, z);
    scene.add(beam);
  });

  // ── Idlers ──
  const idlerGeo = new THREE.CylinderGeometry(0.18, 0.18, BELT_WIDTH + 0.4, 12);
  const idlerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
  for (let z = -LOOP_HALF_LENGTH + IDLER_SPACING; z < LOOP_HALF_LENGTH; z += IDLER_SPACING) {
    const idler = new THREE.Mesh(idlerGeo, idlerMat);
    idler.rotation.z = Math.PI / 2;
    idler.position.set(0, BELT_Y - 0.2, z);
    scene.add(idler);
  }

  // ── Belt direction arrows (carried on top surface) ──
  const arrowGroup = new THREE.Group();
  for (let z = -180; z < 180; z += 50) {
    const arrowGeo = new THREE.ConeGeometry(0.25, 0.8, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.5 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, BELT_Y + 0.55, z);
    arrowGroup.add(arrow);
  }
  scene.add(arrowGroup);

  // ── Inspection Gantry at 210m from tail = z = LOOP_HALF_LENGTH - 210 ──
  // In our scene, tail is at z=-210, head at z=+210.
  // Belt coordinate 0 = tail end = z=-210, coordinate 420 = head end = z=+210
  // Coordinate 210 (gantry) → z = -210 + 210 = 0 (center of belt)
  const sensorGantry = new THREE.Group();
  sensorGantry.position.set(0, 0, 0);

  // Gantry arch
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
  const gantryFrameGeo = new THREE.BoxGeometry(0.3, 8, 0.3);
  [-3, 3].forEach((x) => {
    const col = new THREE.Mesh(gantryFrameGeo, gantryMat);
    col.position.set(x, 3, 0);
    col.castShadow = true;
    sensorGantry.add(col);
  });
  const crossBarGeo = new THREE.BoxGeometry(6.5, 0.3, 0.3);
  const crossBar = new THREE.Mesh(crossBarGeo, gantryMat);
  crossBar.position.set(0, 7.1, 0);
  sensorGantry.add(crossBar);

  // Camera housing (violet box)
  const camBoxGeo = new THREE.BoxGeometry(2.5, 0.5, 0.7);
  const camMat = new THREE.MeshStandardMaterial({ color: 0x581c87, metalness: 0.3, roughness: 0.5, emissive: 0x3b0764, emissiveIntensity: 0.4 });
  const camBox = new THREE.Mesh(camBoxGeo, camMat);
  camBox.position.set(0, 6.7, 0);
  sensorGantry.add(camBox);

  // MFL scanner below belt
  const mflGeo = new THREE.BoxGeometry(2.2, 0.4, 0.6);
  const mflMat = new THREE.MeshStandardMaterial({ color: 0x082f49, metalness: 0.5, roughness: 0.4, emissive: 0x0284c7, emissiveIntensity: 0.3 });
  const mflScanner = new THREE.Mesh(mflGeo, mflMat);
  mflScanner.position.set(0, BELT_Y - 0.5, 0);
  sensorGantry.add(mflScanner);

  // Gantry label sprite (simple point light as proxy)
  const gantryPointLight = new THREE.PointLight(0xa855f7, 30, 25);
  gantryPointLight.position.set(0, 7, 0);
  sensorGantry.add(gantryPointLight);

  scene.add(sensorGantry);

  // Scan beam (violet cone pointing down from camera)
  const beamGeo = new THREE.ConeGeometry(1.0, 5.5, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const scanBeam = new THREE.Mesh(beamGeo, beamMat);
  scanBeam.rotation.x = Math.PI;
  scanBeam.position.set(0, 4.5, 0);
  scene.add(scanBeam);

  // ── Splice Markers ──
  const spliceMarkers = new Map<SpliceId, THREE.Mesh>();
  const anomalyRings = new Map<SpliceId, THREE.Mesh>();
  const spliceIdMap = new Map<THREE.Mesh, SpliceId>();

  const markerGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.25, 20);
  const ringGeoAnomaly = new THREE.TorusGeometry(1.0, 0.1, 8, 32);

  Object.values(splices).forEach((splice) => {
    // Convert belt coordinate to scene z
    // Coordinate 0 = tail (z=-210), 420 = head (z=+210)
    const z = -LOOP_HALF_LENGTH + splice.baselineCoordinate;

    const col = spliceColorHex(splice.condition);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      metalness: 0.3,
      roughness: 0.5,
      emissive: col,
      emissiveIntensity: splice.condition === 'Warning' ? 0.5 : 0.15,
    });

    const marker = new THREE.Mesh(markerGeo, mat);
    marker.position.set(0, BELT_Y + 0.55, z);
    marker.castShadow = true;
    if (layers.splices) scene.add(marker);
    spliceMarkers.set(splice.id, marker);
    spliceIdMap.set(marker, splice.id);

    // Anomaly ring
    if (splice.condition !== 'Healthy') {
      const ringMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeoAnomaly, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, BELT_Y + 0.56, z);
      if (layers.anomalies) scene.add(ring);
      anomalyRings.set(splice.id, ring);
    }
  });

  // ── Click picking ──
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const handleClick = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const clickable = Array.from(spliceIdMap.keys());
    const hits = raycaster.intersectObjects(clickable);
    if (hits.length > 0) {
      const id = spliceIdMap.get(hits[0].object as THREE.Mesh);
      if (id) onSelectSplice(id);
    }
  };
  canvas.addEventListener('click', handleClick);
  (canvas as any).__cleanupClick = () => canvas.removeEventListener('click', handleClick);

  // ── Animation loop ──
  const clock = new THREE.Clock();

  let frameId = 0;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Animate anomaly rings (pulse scale)
    anomalyRings.forEach((ring) => {
      const s = 1.0 + 0.25 * Math.sin(t * 2.5);
      ring.scale.set(s, s, s);
    });

    // Animate scan beam
    const beamMat2 = scanBeam.material as THREE.MeshBasicMaterial;
    beamMat2.opacity = 0; // will be set externally via ref

    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return {
    renderer,
    scene,
    camera,
    controls,
    spliceMarkers,
    anomalyRings,
    sensorGantry,
    scanBeam,
    frameId,
    clock,
    raycaster,
    mouse,
    spliceIdMap,
  };
}

// ─── Camera preset positions ──────────────────────────────────────────────────
function applyCameraMode(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  mode: ViewMode,
  selectedZ: number
) {
  if (mode === 'orbit') {
    camera.position.set(0, 120, 200);
    controls.target.set(0, 0, 0);
  } else if (mode === 'walkway') {
    // Walk along belt at belt height, looking forward
    camera.position.set(-8, 4, -180);
    controls.target.set(0, 3, 0);
  } else if (mode === 'cross') {
    // 35° cross-section angle centered on selected splice
    const angle = (35 * Math.PI) / 180;
    camera.position.set(18, 12, selectedZ + 25);
    controls.target.set(0, BELT_Y, selectedZ);
  }
  controls.update();
}

// ─── Component ────────────────────────────────────────────────────────────────
export const DigitalTwinViewport: React.FC<DigitalTwinViewportProps> = ({
  conveyor,
  splices,
  selectedSpliceId,
  onSelectSplice,
  viewMode,
  layers,
  inspectionStatus,
  isCameraContaminated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneObjects | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Init scene on mount ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = buildScene(canvas, conveyor, splices, layers, onSelectSplice);
    sceneRef.current = scene;

    // Initial camera
    const selectedSplice = splices[selectedSpliceId];
    const selectedZ = selectedSplice
      ? -LOOP_HALF_LENGTH + selectedSplice.baselineCoordinate
      : 0;
    applyCameraMode(scene.camera, scene.controls, viewMode, selectedZ);

    return () => {
      // Cleanup
      cancelAnimationFrame(scene.frameId);
      scene.controls.dispose();
      scene.renderer.dispose();
      scene.scene.clear();
      (canvas as any).__cleanupClick?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only init once

  // ── Resize observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!sceneRef.current || width === 0 || height === 0) continue;
        const { renderer, camera } = sceneRef.current;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // ── Camera mode change ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const { camera, controls } = sceneRef.current;
    const selectedSplice = splices[selectedSpliceId];
    const selectedZ = selectedSplice
      ? -LOOP_HALF_LENGTH + selectedSplice.baselineCoordinate
      : 0;
    applyCameraMode(camera, controls, viewMode, selectedZ);
  }, [viewMode, selectedSpliceId, splices]);

  // ── Highlight selected splice ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const { spliceMarkers } = sceneRef.current;

    spliceMarkers.forEach((marker, id) => {
      const splice = splices[id];
      if (!splice) return;
      const mat = marker.material as THREE.MeshStandardMaterial;
      const col = spliceColorHex(splice.condition);
      mat.color.setHex(col);
      mat.emissive.setHex(col);

      if (id === selectedSpliceId) {
        // Selected: brighter, bigger emissive
        mat.emissiveIntensity = 1.2;
        marker.scale.set(1.8, 1.4, 1.8);
      } else {
        mat.emissiveIntensity = splice.condition === 'Warning' ? 0.5 : 0.15;
        marker.scale.set(1, 1, 1);
      }
    });
  }, [selectedSpliceId, splices]);

  // ── Scan beam ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const beamMat = sceneRef.current.scanBeam.material as THREE.MeshBasicMaterial;
    const isActive = inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone';

    if (isActive) {
      let t = 0;
      const pulse = () => {
        if (!sceneRef.current) return;
        t += 0.07;
        beamMat.opacity = 0.12 + 0.1 * Math.sin(t * 3);
      };
      // Patch into existing animation via a simple interval
      const id = setInterval(pulse, 50);
      return () => {
        clearInterval(id);
        beamMat.opacity = 0;
      };
    } else {
      beamMat.opacity = 0;
    }
  }, [inspectionStatus]);

  // ── Layer visibility ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const { spliceMarkers, anomalyRings, sensorGantry, scene } = sceneRef.current;

    spliceMarkers.forEach((marker) => {
      marker.visible = layers.splices;
    });
    anomalyRings.forEach((ring) => {
      ring.visible = layers.splices && layers.anomalies;
    });
    sensorGantry.visible = layers.sensors;
  }, [layers]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#071224] rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
      />

      {/* ── HUD overlays ── */}
      {/* Scan status */}
      {(inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone') && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-950/90 border border-violet-600/60 text-[10px] font-mono-tech text-violet-300 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
          {inspectionStatus === 'Scanning' ? 'MFL + VISION SCAN ACTIVE' : 'APPROACHING INSPECTION ZONE'}
        </div>
      )}

      {/* Camera contamination warning */}
      {isCameraContaminated && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-600/60 text-[9px] font-mono-tech text-amber-300 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          CAMERA CONTAMINATED
        </div>
      )}

      {/* OPC-UA live badge */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/50 text-[9px] font-mono-tech text-slate-400 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        OPC-UA LIVE · {conveyor.loopLengthM}m LOOP · {conveyor.speedMs} m/s
      </div>

      {/* View mode badge */}
      <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/50 text-[9px] font-mono-tech text-cyan-500 uppercase tracking-wider pointer-events-none">
        {viewMode === 'orbit' ? 'Orbit View' : viewMode === 'walkway' ? 'Walkway' : '35° Cross-Section'}
      </div>
    </div>
  );
};
