import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Conveyor, Splice, SpliceId } from '../../types';
import type { LayerVisibility, ViewMode } from './DigitalTwinCanvas';

interface DigitalTwinViewportProps {
  conveyor: Conveyor;
  splices: Record<string, Splice>;
  selectedSpliceId: SpliceId;
  onSelectSplice: (id: SpliceId) => void;
  viewMode: ViewMode;
  layers: LayerVisibility;
  zoom: number;
  inspectionStatus: string;
  isCameraContaminated: boolean;
  onViewportReady?: () => void;
}

interface SceneObjects {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  markers: Map<SpliceId, THREE.Mesh>;
  anomalyRings: Map<SpliceId, THREE.Mesh>;
  gantry: THREE.Group;
  scanBeam: THREE.Mesh;
  frameId: number;
}

const BELT_LENGTH = 180;
const BELT_WIDTH = 15;
const PULLEY_RADIUS = 4.2;
const BELT_Y = 2.5;

function conditionColor(condition: string): number {
  if (condition === 'Critical') return 0xef4444;
  if (condition === 'Warning') return 0xf59e0b;
  return 0x10b981;
}

function mapSpliceToBeltX(baselineCoordinate: number, loopLengthM: number): number {
  const normalized = baselineCoordinate / Math.max(loopLengthM, 1);
  return (normalized - 0.5) * BELT_LENGTH * 1.35;
}

function buildScene(
  canvas: HTMLCanvasElement,
  conveyor: Conveyor,
  splices: Record<string, Splice>,
  layers: LayerVisibility,
  inspectionStatus: string,
  onSelectSplice: (id: SpliceId) => void
): SceneObjects {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 1200, canvas.clientHeight || 700, false);
  renderer.setClearColor(0x071224, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071224);
  scene.fog = new THREE.Fog(0x071224, 60, 260);

  const camera = new THREE.PerspectiveCamera(48, (canvas.clientWidth || 1200) / Math.max(canvas.clientHeight || 700, 1), 0.1, 1000);
  camera.position.set(30, 18, 34);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 18;
  controls.maxDistance = 180;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 2.5, 0);
  controls.update();

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(35, 42, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x38bdf8, 0.5);
  fill.position.set(-40, 20, -25);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 120),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.92, metalness: 0.08 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(220, 22, 0x1e293b, 0x1e293b);
  grid.position.y = -2.4;
  scene.add(grid);

  const beltMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8, metalness: 0.15 });
  const oreMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 1, metalness: 0.05 });
  const supportMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });

  const carryingBelt = new THREE.Mesh(new THREE.BoxGeometry(BELT_LENGTH, 1.1, BELT_WIDTH), beltMat);
  carryingBelt.position.set(0, BELT_Y, 0);
  carryingBelt.castShadow = true;
  carryingBelt.receiveShadow = true;
  scene.add(carryingBelt);

  const ore = new THREE.Mesh(new THREE.BoxGeometry(BELT_LENGTH * 0.92, 0.5, BELT_WIDTH * 0.82), oreMat);
  ore.position.set(0, BELT_Y + 0.4, 0);
  ore.castShadow = true;
  scene.add(ore);

  const returnBelt = new THREE.Mesh(new THREE.BoxGeometry(BELT_LENGTH, 1.0, BELT_WIDTH), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }));
  returnBelt.position.set(0, BELT_Y - 4.8, 0);
  returnBelt.receiveShadow = true;
  scene.add(returnBelt);

  const pulleyGeometry = new THREE.CylinderGeometry(PULLEY_RADIUS, PULLEY_RADIUS, BELT_WIDTH + 1.5, 32);
  const pulleyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.8 });

  const headPulley = new THREE.Mesh(pulleyGeometry, pulleyMat);
  headPulley.rotation.z = Math.PI / 2;
  headPulley.position.set(BELT_LENGTH / 2, BELT_Y, 0);
  scene.add(headPulley);

  const tailPulley = new THREE.Mesh(pulleyGeometry, pulleyMat);
  tailPulley.rotation.z = Math.PI / 2;
  tailPulley.position.set(-BELT_LENGTH / 2, BELT_Y, 0);
  scene.add(tailPulley);

  for (let x = -BELT_LENGTH / 2 + 8; x < BELT_LENGTH / 2; x += 9) {
    const idler = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, BELT_WIDTH + 1.5, 20), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.45, roughness: 0.45 }));
    idler.rotation.z = Math.PI / 2;
    idler.position.set(x, BELT_Y - 0.7, 0);
    idler.castShadow = true;
    scene.add(idler);
  }

  for (let x = -BELT_LENGTH / 2 + 8; x < BELT_LENGTH / 2; x += 18) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.3, 12, 0.3), supportMat);
    truss.position.set(x, 4.4, -BELT_WIDTH / 2 - 1.5);
    truss.castShadow = true;
    scene.add(truss);

    const truss2 = truss.clone();
    truss2.position.z = BELT_WIDTH / 2 + 1.5;
    scene.add(truss2);
  }

  const gantry = new THREE.Group();
  const gantryLegLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 11, 0.45), supportMat);
  gantryLegLeft.position.set(-3.4, 4.8, -4.2);
  const gantryLegRight = gantryLegLeft.clone();
  gantryLegRight.position.x = 3.4;
  const gantryCross = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.45, 0.45), supportMat);
  gantryCross.position.set(0, 10.5, -4.2);
  const gantryCamera = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.2), new THREE.MeshStandardMaterial({ color: 0x581c87, emissive: 0x3b0764, emissiveIntensity: 0.4 }));
  gantryCamera.position.set(0, 10.1, -4.2);
  gantryCamera.castShadow = true;
  gantry.add(gantryLegLeft, gantryLegRight, gantryCross, gantryCamera);
  gantry.position.set(0, 0, 0);
  scene.add(gantry);

  const scanBeam = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 12, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  scanBeam.rotation.x = Math.PI;
  scanBeam.position.set(0, 9, -4.2);
  scene.add(scanBeam);

  const markers = new Map<SpliceId, THREE.Mesh>();
  const anomalyRings = new Map<SpliceId, THREE.Mesh>();

  Object.values(splices).forEach((splice) => {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.25, 18),
      new THREE.MeshStandardMaterial({
        color: conditionColor(splice.condition),
        emissive: conditionColor(splice.condition),
        emissiveIntensity: splice.condition === 'Warning' ? 0.45 : 0.18,
        metalness: 0.35,
        roughness: 0.45,
      })
    );
    marker.position.set(mapSpliceToBeltX(splice.baselineCoordinate, conveyor.loopLengthM), BELT_Y + 1.2, 0);
    marker.castShadow = true;
    marker.visible = layers.splices;
    scene.add(marker);
    markers.set(splice.id, marker);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.12, 12, 40),
      new THREE.MeshBasicMaterial({
        color: conditionColor(splice.condition),
        transparent: true,
        opacity: splice.condition === 'Healthy' ? 0 : 0.5,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(mapSpliceToBeltX(splice.baselineCoordinate, conveyor.loopLengthM), BELT_Y + 1.1, 0);
    ring.visible = layers.splices && layers.anomalies && splice.condition !== 'Healthy';
    scene.add(ring);
    anomalyRings.set(splice.id, ring);
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const handleClick = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(Array.from(markers.values()));
    if (hits.length > 0) {
      const hit = hits[0].object as THREE.Mesh;
      const matchedId = Array.from(markers.entries()).find(([, marker]) => marker === hit)?.[0];
      if (matchedId) onSelectSplice(matchedId);
    }
  };
  canvas.addEventListener('click', handleClick);

  let frameId = 0;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const elapsed = performance.now() / 1000;

    if (layers.anomalies) {
      anomalyRings.forEach((ring) => {
        if (ring.visible) {
          ring.scale.setScalar(1 + Math.sin(elapsed * 3.6) * 0.18);
        }
      });
    }

    markers.forEach((marker) => {
      marker.rotation.x = elapsed * 0.7;
      marker.rotation.z = elapsed * 0.9;
    });

    const beamOpacity = inspectionStatusMatches(inspectStatusString(inspectionStatus)) ? 0.14 + Math.sin(elapsed * 6) * 0.06 : 0;
    const beamMaterial = scanBeam.material as THREE.MeshBasicMaterial;
    beamMaterial.opacity = beamOpacity;

    controls.update();
    renderer.render(scene, camera);
  };
  frameId = requestAnimationFrame(animate);

  return { renderer, scene, camera, controls, markers, anomalyRings, gantry, scanBeam, frameId };
}

function inspectStatusString(value: string): string {
  return value || 'Idle';
}

function inspectionStatusMatches(value: string): boolean {
  return value === 'Scanning' || value === 'In_Inspection_Zone';
}

function applyCameraMode(camera: THREE.PerspectiveCamera, controls: OrbitControls, mode: ViewMode, selectedX: number, zoom: number) {
  const target = new THREE.Vector3(selectedX, 2.5, 0);

  if (mode === 'orbit') {
    camera.position.set(30, 18, 34);
    controls.target.copy(target);
  } else if (mode === 'walkway') {
    camera.position.set(selectedX + 12, 7, 20);
    controls.target.set(selectedX, 2.5, 0);
  } else {
    camera.position.set(selectedX + 18, 13, 20);
    controls.target.set(selectedX, 2.5, 0);
  }

  camera.zoom = Math.max(0.55, Math.min(2, zoom));
  camera.updateProjectionMatrix();
  controls.update();
}

export const DigitalTwinViewport: React.FC<DigitalTwinViewportProps> = ({
  conveyor,
  splices,
  selectedSpliceId,
  onSelectSplice,
  viewMode,
  layers,
  zoom,
  inspectionStatus,
  isCameraContaminated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneObjects | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = buildScene(canvas, conveyor, splices, layers, inspectionStatus, onSelectSplice);
    sceneRef.current = scene;

    const selectedSplice = splices[selectedSpliceId] ?? Object.values(splices)[0];
    const targetX = selectedSplice ? mapSpliceToBeltX(selectedSplice.baselineCoordinate, conveyor.loopLengthM) : 0;
    applyCameraMode(scene.camera, scene.controls, viewMode, targetX, zoom);

    return () => {
      cancelAnimationFrame(scene.frameId);
      scene.controls.dispose();
      scene.renderer.dispose();
      scene.scene.clear();
      canvas.onclick = null;
    };
  }, [conveyor, inspectionStatus, layers, onSelectSplice, selectedSpliceId, splices, viewMode, zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !sceneRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        const { renderer, camera } = sceneRef.current!;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const selectedSplice = splices[selectedSpliceId] ?? Object.values(splices)[0];
    const targetX = selectedSplice ? mapSpliceToBeltX(selectedSplice.baselineCoordinate, conveyor.loopLengthM) : 0;
    applyCameraMode(sceneRef.current.camera, sceneRef.current.controls, viewMode, targetX, zoom);
  }, [conveyor.loopLengthM, selectedSpliceId, splices, viewMode, zoom]);

  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.markers.forEach((marker, id) => {
      const splice = splices[id];
      if (!splice) return;

      const material = marker.material as THREE.MeshStandardMaterial;
      const color = conditionColor(splice.condition);
      material.color.setHex(color);
      material.emissive.setHex(color);
      material.emissiveIntensity = id === selectedSpliceId ? 1.0 : splice.condition === 'Warning' ? 0.45 : 0.18;
      marker.scale.setScalar(id === selectedSpliceId ? 1.45 : 1);
      marker.visible = layers.splices;
      marker.position.x = mapSpliceToBeltX(splice.baselineCoordinate, conveyor.loopLengthM);
    });

    sceneRef.current.anomalyRings.forEach((ring, id) => {
      const splice = splices[id];
      if (!splice) return;
      ring.visible = layers.splices && layers.anomalies && splice.condition !== 'Healthy';
      ring.position.x = mapSpliceToBeltX(splice.baselineCoordinate, conveyor.loopLengthM);
    });

    sceneRef.current.gantry.visible = layers.sensors;
  }, [conveyor.loopLengthM, layers, selectedSpliceId, splices]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const beam = sceneRef.current.scanBeam.material as THREE.MeshBasicMaterial;
    beam.opacity = inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone' ? 0.15 : 0;
  }, [inspectionStatus]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#071224] rounded-xl overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" style={{ touchAction: 'none' }} />

      {(inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone') && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-950/90 border border-violet-600/60 text-[10px] font-mono-tech text-violet-300 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
          {inspectionStatus === 'Scanning' ? 'MFL + VISION SCAN ACTIVE' : 'APPROACHING INSPECTION ZONE'}
        </div>
      )}

      {isCameraContaminated && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-600/60 text-[9px] font-mono-tech text-amber-300 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          CAMERA CONTAMINATED
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/50 text-[9px] font-mono-tech text-slate-400 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        OPC-UA LIVE · {conveyor.loopLengthM}m LOOP · {conveyor.speedMs} m/s
      </div>

      <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/50 text-[9px] font-mono-tech text-cyan-500 uppercase tracking-wider pointer-events-none">
        {viewMode === 'orbit' ? 'Orbit View' : viewMode === 'walkway' ? 'Walkway' : '35° Cross-Section'}
      </div>
    </div>
  );
};
