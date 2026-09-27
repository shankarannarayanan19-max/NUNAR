/**
 * DigitalTwinCanvas — The main visual canvas for the NUNAR Digital Twin.
 *
 * Renders an advanced SVG-based industrial visualization of the conveyor belt loop.
 * Supports three view modes:
 *   - 'orbit'    : Full 420m loop bird's-eye perspective (default)
 *   - 'walkway'  : Linear 2D chainage schematic (belt as horizontal line with stations)
 *   - 'cross'    : Cross-section view of belt at selected splice location
 *
 * All data comes from AppContext — no independent data model.
 * Splice markers, anomaly highlights, sensor positions all driven by live context.
 */

import React, { useRef } from 'react';
import { Splice, SpliceId, Conveyor } from '../../types';

// ─── View mode type ───────────────────────────────────────────────────────────
export type ViewMode = 'orbit' | 'walkway' | 'cross';

// ─── Layer visibility toggles ─────────────────────────────────────────────────
export interface LayerVisibility {
  splices: boolean;
  sensors: boolean;
  alerts: boolean;
  anomalies: boolean;
}

interface DigitalTwinCanvasProps {
  conveyor: Conveyor;
  splices: Record<string, Splice>;
  selectedSpliceId: SpliceId;
  onSelectSplice: (id: SpliceId) => void;
  viewMode: ViewMode;
  layers: LayerVisibility;
  zoom: number; // 0.5 – 2.0
  inspectionStatus: string;
  isCameraContaminated: boolean;
}

// ─── Station definitions (from second HTML implementation, adapted to NUNAR) ──
const STATIONS = [
  { id: '01', label: 'Rotary Tippler', shortLabel: 'TIPPLER', x: 0, color: '#06b6d4' },
  { id: '02', label: 'Primary Crusher', shortLabel: 'CRUSHER', x: 70, color: '#8b5cf6' },
  { id: '03', label: 'Stockyard Stacker', shortLabel: 'STACKER', x: 210, color: '#10b981' },
  { id: '04', label: 'Defect Gantry', shortLabel: 'GANTRY', x: 315, color: '#f59e0b' },
  { id: '05', label: 'Head Drive', shortLabel: 'DRIVE', x: 390, color: '#0284c7' },
  { id: '06', label: 'Secondary Sizer', shortLabel: 'SIZER', x: 420, color: '#64748b' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function conditionColor(condition: string): string {
  if (condition === 'Critical') return '#ef4444';
  if (condition === 'Warning') return '#f59e0b';
  return '#10b981';
}

function conditionGlow(condition: string): string {
  if (condition === 'Critical') return 'url(#glowRed)';
  if (condition === 'Warning') return 'url(#glowAmber)';
  return 'url(#glowGreen)';
}

// ─── Orbit View (bird's-eye loop) ─────────────────────────────────────────────
const OrbitView: React.FC<{
  conveyor: Conveyor;
  splices: Record<string, Splice>;
  selectedSpliceId: SpliceId;
  onSelectSplice: (id: SpliceId) => void;
  layers: LayerVisibility;
  inspectionStatus: string;
  isCameraContaminated: boolean;
}> = ({ conveyor, splices, selectedSpliceId, onSelectSplice, layers, inspectionStatus, isCameraContaminated }) => {
  const isScanning = inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone';

  // Map belt distance ratio → SVG position on the oval loop
  // SVG viewBox: 0 0 900 380
  // Oval: center (450,190), rx=330, ry=130
  const CX = 450, CY = 190, RX = 320, RY = 130;

  const getSplicePos = (baselineCoordinate: number) => {
    const dist = (baselineCoordinate + conveyor.currentCoordinateM) % conveyor.loopLengthM;
    const ratio = dist / conveyor.loopLengthM;
    // Full ellipse: 0=right, goes counter-clockwise (top = carrying run)
    // We want 0m = left (tail), then top carrying run goes left→right
    const angle = ratio * 2 * Math.PI - Math.PI; // start at left (-PI)
    return {
      x: CX + RX * Math.cos(angle),
      y: CY + RY * Math.sin(angle),
    };
  };

  // Inspection gantry is at belt coordinate 210m — draw it at that position on loop
  const gantryBeltRatio = 210 / conveyor.loopLengthM;
  const gantryAngle = gantryBeltRatio * 2 * Math.PI - Math.PI;
  const gantryX = CX + RX * Math.cos(gantryAngle);
  const gantryY = CY + RY * Math.sin(gantryAngle);

  return (
    <svg viewBox="0 0 900 380" className="w-full h-full" style={{ minHeight: 340 }}>
      <defs>
        {/* Filters */}
        <filter id="glowAmber" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowGreen" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowRed" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Gradients */}
        <linearGradient id="beltGradOrbit" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <radialGradient id="scanBeam" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="oreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
      </defs>

      {/* ── Ambient Background Grid ── */}
      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.6" />
      </pattern>
      <rect width="900" height="380" fill="#0a1628" rx="12" />
      <rect width="900" height="380" fill="url(#grid)" rx="12" opacity="0.4" />

      {/* ── Ambient glow blobs ── */}
      <ellipse cx="450" cy="190" rx="360" ry="150" fill="none" stroke="#0284c7" strokeWidth="0.5" opacity="0.15" />
      <ellipse cx="450" cy="190" rx="310" ry="110" fill="#0c1a2e" opacity="0.5" />

      {/* ── Belt outer shadow/track ── */}
      <ellipse cx={CX} cy={CY} rx={RX + 18} ry={RY + 18}
        fill="none" stroke="#0f172a" strokeWidth="36" />

      {/* ── Belt rubber body ── */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY}
        fill="none" stroke="#1e293b" strokeWidth="22" />

      {/* ── Ore burden on top carrying run (approx top half of ellipse) ── */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY}
        fill="none"
        stroke="url(#oreGrad)"
        strokeWidth="10"
        strokeDasharray={`${Math.PI * RX} ${Math.PI * RX + 2 * Math.PI * RY}`}
        strokeDashoffset={Math.PI * RX / 2}
        opacity="0.7"
      />

      {/* ── Belt center-line animation indicator ── */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY}
        fill="none" stroke="#0284c7" strokeWidth="1.5"
        strokeDasharray="16 12" opacity="0.5" />

      {/* ── Direction arrow on carrying run (top) ── */}
      <path d={`M ${CX - 30},${CY - RY} L ${CX + 10},${CY - RY}`}
        stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrowBlue)" opacity="0.6" />
      <defs>
        <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#38bdf8" />
        </marker>
      </defs>

      {/* ── Tail Pulley (left) ── */}
      <g transform={`translate(${CX - RX}, ${CY})`}>
        <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#10b981" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="8" fill="#10b981" opacity="0.7" />
        <text x="0" y="-28" fill="#a7f3d0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TAIL · 0m</text>
        <text x="0" y="-18" fill="#6ee7b7" fontSize="7.5" fontFamily="monospace" textAnchor="middle">REF DATUM</text>
      </g>

      {/* ── Head Pulley (right) ── */}
      <g transform={`translate(${CX + RX}, ${CY})`}>
        <circle cx="0" cy="0" r="26" fill="#0f172a" stroke="#0284c7" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="9" fill="#0284c7" opacity="0.8" />
        <text x="0" y="-32" fill="#bae6fd" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">HEAD DRIVE</text>
        <text x="0" y="-21" fill="#7dd3fc" fontSize="7.5" fontFamily="monospace" textAnchor="middle">{conveyor.driveMotorKw} kW</text>
        <text x="0" y="-11" fill="#5eead4" fontSize="7" fontFamily="monospace" textAnchor="middle">{conveyor.motorCurrentA} A</text>
      </g>

      {/* ── Inspection Gantry ── */}
      {layers.sensors && (
        <g transform={`translate(${gantryX}, ${gantryY})`}>
          {isScanning && (
            <ellipse cx="0" cy="0" rx="28" ry="28" fill="#a855f7" opacity="0.15" className="animate-ping" />
          )}
          <rect x="-26" y="-14" width="52" height="28" rx="5"
            fill="#1a0a2e" stroke={isCameraContaminated ? '#f59e0b' : '#a855f7'} strokeWidth="2" />
          <text x="0" y="-2" fill={isCameraContaminated ? '#fbbf24' : '#d8b4fe'}
            fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">GANTRY</text>
          <text x="0" y="9" fill="#c084fc" fontSize="6.5" fontFamily="monospace" textAnchor="middle">MFL+VIS+LWIR</text>
          {isScanning && (
            <text x="0" y="26" fill="#a855f7" fontSize="7" fontFamily="monospace" textAnchor="middle"
              className="animate-pulse">SCANNING</text>
          )}
        </g>
      )}

      {/* ── Sensor labels around the loop (from supplied HTML) ── */}
      {layers.sensors && (
        <g opacity="0.75">
          <g transform={`translate(${CX - 60}, ${CY + RY + 22})`}>
            <rect x="-28" y="-9" width="56" height="18" rx="3" fill="#082f49" stroke="#0284c7" strokeWidth="1" />
            <text x="0" y="4" fill="#38bdf8" fontSize="7" fontFamily="monospace" textAnchor="middle">MFL-RET-04</text>
          </g>
          <g transform={`translate(${CX + 100}, ${CY + RY + 22})`}>
            <rect x="-20" y="-9" width="40" height="18" rx="3" fill="#1a0a2e" stroke="#a855f7" strokeWidth="1" />
            <text x="0" y="4" fill="#c084fc" fontSize="7" fontFamily="monospace" textAnchor="middle">AE-IDLER</text>
          </g>
          <g transform={`translate(${CX - 60}, ${CY - RY - 22})`}>
            <rect x="-26" y="-9" width="52" height="18" rx="3" fill="#1a1a2e" stroke="#8b5cf6" strokeWidth="1" />
            <text x="0" y="4" fill="#a78bfa" fontSize="7" fontFamily="monospace" textAnchor="middle">RGB-CAM-TOP</text>
          </g>
          <g transform={`translate(${CX + 80}, ${CY - RY - 22})`}>
            <rect x="-22" y="-9" width="44" height="18" rx="3" fill="#1a0a0a" stroke="#f97316" strokeWidth="1" />
            <text x="0" y="4" fill="#fb923c" fontSize="7" fontFamily="monospace" textAnchor="middle">LWIR-THERM</text>
          </g>
        </g>
      )}

      {/* ── Splice Markers (moving with belt) ── */}
      {layers.splices && (Object.values(splices) as Splice[]).map((splice) => {
        const pos = getSplicePos(splice.baselineCoordinate);
        const isSelected = selectedSpliceId === splice.id;
        const col = conditionColor(splice.condition);
        const isAnomaly = splice.condition !== 'Healthy';

        return (
          <g key={`orbit-splice-${splice.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
            className="cursor-pointer"
            onClick={() => onSelectSplice(splice.id as SpliceId)}>

            {/* Anomaly pulse ring */}
            {isAnomaly && layers.anomalies && (
              <circle cx="0" cy="0" r="20" fill={col} opacity="0.2" className="animate-ping" />
            )}

            {/* Selection ring */}
            {isSelected && (
              <circle cx="0" cy="0" r="18" fill="none" stroke="#38bdf8" strokeWidth="2"
                strokeDasharray="4 3" opacity="0.9" />
            )}

            {/* Main marker dot */}
            <circle cx="0" cy="0" r={isSelected ? 9 : 7}
              fill={col} stroke="#0f172a" strokeWidth="1.5"
              filter={isAnomaly ? conditionGlow(splice.condition) : undefined} />

            {/* ID label */}
            <rect x="-13" y="-24" width="26" height="14" rx="3"
              fill="#0f172a" stroke={col} strokeWidth="1.2" opacity="0.95" />
            <text x="0" y="-13" fill={col} fontSize="8" fontFamily="monospace"
              fontWeight="bold" textAnchor="middle">{splice.id}</text>

            {/* Score badge on selected */}
            {isSelected && (
              <>
                <rect x="-16" y="12" width="32" height="13" rx="3"
                  fill="#0f172a" stroke={col} strokeWidth="1" opacity="0.9" />
                <text x="0" y="22" fill={col} fontSize="7.5" fontFamily="monospace"
                  fontWeight="bold" textAnchor="middle">{splice.score}/100</text>
              </>
            )}
          </g>
        );
      })}

      {/* ── Live telemetry overlay ── */}
      <g transform="translate(14, 14)">
        <rect x="0" y="0" width="210" height="52" rx="6" fill="#0f172a" stroke="#1e3a5f" strokeWidth="1" opacity="0.9" />
        <text x="10" y="15" fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold">
          {conveyor.id} · {conveyor.status.toUpperCase()}
        </text>
        <text x="10" y="28" fill="#94a3b8" fontSize="8" fontFamily="monospace">
          Speed: <tspan fill="#67e8f9">{conveyor.speedMs} m/s</tspan>
          {'  '}Pass: <tspan fill="#67e8f9">#{conveyor.currentPass}</tspan>
        </text>
        <text x="10" y="42" fill="#94a3b8" fontSize="8" fontFamily="monospace">
          Pos: <tspan fill="#67e8f9">{conveyor.currentCoordinateM.toFixed(1)}m</tspan>
          {'  '}Load: <tspan fill="#67e8f9">{conveyor.loadFactorPct}%</tspan>
        </text>
      </g>

      {/* ── NUNAR Digital Twin watermark ── */}
      <text x="450" y="368" fill="#1e3a5f" fontSize="9" fontFamily="monospace"
        textAnchor="middle" opacity="0.6">NUNAR DIGITAL TWIN · ORBIT VIEW · KIRANDUL CV-01</text>
    </svg>
  );
};

// ─── Walkway View (linear 2D chainage) ────────────────────────────────────────
const WalkwayView: React.FC<{
  conveyor: Conveyor;
  splices: Record<string, Splice>;
  selectedSpliceId: SpliceId;
  onSelectSplice: (id: SpliceId) => void;
  layers: LayerVisibility;
}> = ({ conveyor, splices, selectedSpliceId, onSelectSplice, layers }) => {
  const TRACK_Y = 180;
  const LEFT_X = 50;
  const RIGHT_X = 850;
  const TRACK_W = RIGHT_X - LEFT_X; // 800px = 420m

  // Convert metres → SVG x
  const mToX = (m: number) => LEFT_X + (m / conveyor.loopLengthM) * TRACK_W;

  return (
    <svg viewBox="0 0 900 360" className="w-full h-full" style={{ minHeight: 320 }}>
      <defs>
        <filter id="wlGlowAmber" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="wlGlowGreen" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="wlOreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id="wlTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="30%" stopColor="#1e3a5f" />
          <stop offset="70%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect width="900" height="360" fill="#070f1a" rx="12" />

      {/* Grid lines */}
      {[0, 70, 140, 210, 280, 350, 420].map((m) => (
        <g key={`grid-${m}`}>
          <line x1={mToX(m)} y1="30" x2={mToX(m)} y2="330"
            stroke="#1e293b" strokeWidth="1" strokeDasharray="4 6" opacity="0.5" />
          <text x={mToX(m)} y="345" fill="#475569" fontSize="8" fontFamily="monospace" textAnchor="middle">{m}m</text>
        </g>
      ))}

      {/* ── Structural support trusses ── */}
      {[100, 200, 300, 400, 500, 600, 700, 800].map((x) => (
        <line key={`truss-${x}`} x1={x} y1={TRACK_Y + 18} x2={x} y2={TRACK_Y + 50}
          stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      ))}
      <line x1={LEFT_X} y1={TRACK_Y + 50} x2={RIGHT_X} y2={TRACK_Y + 50}
        stroke="#1e293b" strokeWidth="3" />

      {/* ── Belt / Track body ── */}
      <rect x={LEFT_X} y={TRACK_Y - 12} width={TRACK_W} height="24" rx="4"
        fill="url(#wlTrackGrad)" stroke="#334155" strokeWidth="1.5" />
      {/* Ore burden */}
      <path d={`M ${LEFT_X + 10},${TRACK_Y - 12}
        Q ${LEFT_X + 200},${TRACK_Y - 20}
          ${LEFT_X + 400},${TRACK_Y - 18}
        T ${RIGHT_X - 10},${TRACK_Y - 12}
        L ${RIGHT_X - 10},${TRACK_Y - 12}
        L ${LEFT_X + 10},${TRACK_Y - 12} Z`}
        fill="url(#wlOreGrad)" opacity="0.7" />
      {/* Motion dash */}
      <rect x={LEFT_X} y={TRACK_Y - 2} width={TRACK_W} height="4" rx="2"
        fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="20 15" opacity="0.6" />

      {/* ── Tail / Head pulley circles ── */}
      <circle cx={LEFT_X} cy={TRACK_Y} r="18" fill="#0f172a" stroke="#10b981" strokeWidth="2.5" />
      <text x={LEFT_X} y={TRACK_Y - 24} fill="#6ee7b7" fontSize="8" fontFamily="monospace" textAnchor="middle">TAIL</text>
      <text x={LEFT_X} y={TRACK_Y - 14} fill="#a7f3d0" fontSize="7" fontFamily="monospace" textAnchor="middle">0m REF</text>

      <circle cx={RIGHT_X} cy={TRACK_Y} r="20" fill="#0f172a" stroke="#0284c7" strokeWidth="2.5" />
      <text x={RIGHT_X} y={TRACK_Y - 26} fill="#7dd3fc" fontSize="8" fontFamily="monospace" textAnchor="middle">HEAD</text>
      <text x={RIGHT_X} y={TRACK_Y - 16} fill="#bae6fd" fontSize="7" fontFamily="monospace" textAnchor="middle">{conveyor.driveMotorKw}kW</text>

      {/* ── Stations from second HTML ── */}
      {layers.sensors && STATIONS.slice(0, 5).map((st) => {
        const sx = mToX(st.x);
        return (
          <g key={`wl-station-${st.id}`} transform={`translate(${sx}, 0)`}>
            <line x1="0" y1={TRACK_Y - 40} x2="0" y2={TRACK_Y - 12} stroke={st.color} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
            <rect x="-24" y={TRACK_Y - 70} width="48" height="26" rx="4"
              fill="#0f172a" stroke={st.color} strokeWidth="1.2" opacity="0.9" />
            <text x="0" y={TRACK_Y - 57} fill={st.color} fontSize="7.5" fontFamily="monospace"
              fontWeight="bold" textAnchor="middle">{st.id}</text>
            <text x="0" y={TRACK_Y - 48} fill="#94a3b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle">{st.shortLabel}</text>
          </g>
        );
      })}

      {/* ── Gantry / Defect inspection box (at 210m) ── */}
      {layers.sensors && (
        <g transform={`translate(${mToX(210)}, 0)`}>
          <rect x="-32" y={TRACK_Y - 100} width="64" height="34" rx="5"
            fill="#1a0a2e" stroke="#a855f7" strokeWidth="1.8" />
          <text x="0" y={TRACK_Y - 85} fill="#c084fc" fontSize="8" fontFamily="monospace"
            fontWeight="bold" textAnchor="middle">INSPECTION</text>
          <text x="0" y={TRACK_Y - 75} fill="#a78bfa" fontSize="7" fontFamily="monospace" textAnchor="middle">MFL+VIS+LWIR</text>
          <line x1="0" y1={TRACK_Y - 66} x2="0" y2={TRACK_Y - 12} stroke="#a855f7" strokeWidth="1.5" />
        </g>
      )}

      {/* ── Splice Markers on chainage ── */}
      {layers.splices && (Object.values(splices) as Splice[]).map((splice) => {
        const sx = mToX(splice.baselineCoordinate);
        const isSelected = selectedSpliceId === splice.id;
        const col = conditionColor(splice.condition);
        const isAnomaly = splice.condition !== 'Healthy';

        return (
          <g key={`wl-splice-${splice.id}`} transform={`translate(${sx}, 0)`}
            className="cursor-pointer" onClick={() => onSelectSplice(splice.id as SpliceId)}>

            {/* Anomaly beam */}
            {isAnomaly && layers.anomalies && (
              <line x1="0" y1={TRACK_Y + 12} x2="0" y2={TRACK_Y + 60}
                stroke={col} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
            )}

            {/* Vertical tick on track */}
            <line x1="0" y1={TRACK_Y - 12} x2="0" y2={TRACK_Y + 12}
              stroke={col} strokeWidth={isSelected ? 3 : 2} opacity="0.9" />

            {/* Diamond marker below track */}
            <polygon points={`0,${TRACK_Y + 16} 8,${TRACK_Y + 24} 0,${TRACK_Y + 32} -8,${TRACK_Y + 24}`}
              fill={isSelected ? col : '#0f172a'} stroke={col} strokeWidth="1.5"
              filter={isAnomaly && layers.anomalies ? 'url(#wlGlowAmber)' : undefined} />

            {/* ID label above track */}
            <rect x="-16" y={TRACK_Y - 42} width="32" height="20" rx="3"
              fill="#0f172a" stroke={col} strokeWidth={isSelected ? 1.5 : 1} />
            <text x="0" y={TRACK_Y - 27} fill={col} fontSize="9" fontFamily="monospace"
              fontWeight="bold" textAnchor="middle">{splice.id}</text>

            {/* Score on selected */}
            {isSelected && (
              <>
                <rect x="-20" y={TRACK_Y + 34} width="40" height="14" rx="3"
                  fill="#0f172a" stroke={col} strokeWidth="1" />
                <text x="0" y={TRACK_Y + 44} fill={col} fontSize="7.5" fontFamily="monospace"
                  fontWeight="bold" textAnchor="middle">{splice.score}/100</text>
              </>
            )}

            {/* Anomaly label */}
            {isAnomaly && layers.anomalies && (
              <>
                <rect x="-22" y={TRACK_Y + 52} width="44" height="14" rx="3"
                  fill="#450a0a" stroke={col} strokeWidth="1" opacity="0.9" />
                <text x="0" y={TRACK_Y + 62} fill={col} fontSize="7" fontFamily="monospace"
                  fontWeight="bold" textAnchor="middle">
                  {splice.condition.toUpperCase()}
                </text>
              </>
            )}

            {/* Belt coordinate label */}
            <text x="0" y={TRACK_Y + 88} fill="#475569" fontSize="7.5" fontFamily="monospace" textAnchor="middle">
              {splice.baselineCoordinate}m
            </text>
          </g>
        );
      })}

      {/* ── Belt travel position indicator ── */}
      {(() => {
        const bx = mToX(conveyor.currentCoordinateM);
        return (
          <g transform={`translate(${bx}, 0)`}>
            <line x1="0" y1={TRACK_Y - 12} x2="0" y2={TRACK_Y - 55}
              stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
            <rect x="-18" y={TRACK_Y - 72} width="36" height="16" rx="3"
              fill="#0c1a2e" stroke="#38bdf8" strokeWidth="1" />
            <text x="0" y={TRACK_Y - 60} fill="#38bdf8" fontSize="7.5" fontFamily="monospace"
              fontWeight="bold" textAnchor="middle">
              {conveyor.currentCoordinateM.toFixed(0)}m
            </text>
          </g>
        );
      })()}

      <text x="450" y="352" fill="#1e3a5f" fontSize="9" fontFamily="monospace"
        textAnchor="middle" opacity="0.6">NUNAR DIGITAL TWIN · LINEAR CHAINAGE VIEW · 420m LOOP</text>
    </svg>
  );
};

// ─── Cross-Section View (selected splice anatomy) ─────────────────────────────
const CrossSectionView: React.FC<{
  splice: Splice;
}> = ({ splice }) => {
  const isWarning = splice.condition === 'Warning';
  const isCritical = splice.condition === 'Critical';
  const hasAnomaly = isWarning || isCritical;

  return (
    <svg viewBox="0 0 900 380" className="w-full h-full" style={{ minHeight: 340 }}>
      <defs>
        <filter id="csGlowAmber" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="csBeltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="csCoverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect width="900" height="380" fill="#070f1a" rx="12" />

      {/* Title */}
      <text x="450" y="30" fill="#e2e8f0" fontSize="12" fontFamily="monospace"
        fontWeight="bold" textAnchor="middle">
        CROSS-SECTION ANALYSIS · {splice.id} · {splice.name.split('(')[1]?.replace(')', '') || splice.id}
      </text>
      <text x="450" y="46" fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="middle">
        Baseline: {splice.baselineCoordinate}m · Width: {splice.widthMm}mm · Thickness: {splice.thicknessMm}mm
      </text>

      {/* ── Belt cross section at y=120 ── */}
      {/* Top cover rubber */}
      <rect x="80" y="80" width="740" height="30" rx="3"
        fill={hasAnomaly && splice.id === 'S03' ? '#422006' : '#1e293b'}
        stroke={isWarning ? '#f59e0b' : '#334155'} strokeWidth="1.5" />
      <text x="450" y="100" fill="#94a3b8" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
        TOP COVER RUBBER · {splice.thicknessMm}mm
      </text>

      {/* Steel cord layer */}
      <rect x="80" y="110" width="740" height="50" rx="0"
        fill="#0f172a" stroke="#334155" strokeWidth="1" />

      {/* Individual steel cords (16 representative channels for 64 cords) */}
      {Array.from({ length: 20 }).map((_, i) => {
        const cx = 100 + i * 36;
        const isAnomalyCord = hasAnomaly && splice.id === 'S03' && i >= 6 && i <= 8;
        const cordColor = isAnomalyCord ? '#f59e0b' : '#0284c7';
        return (
          <g key={`cord-${i}`}>
            <circle cx={cx} cy={135} r={isAnomalyCord ? 8 : 6}
              fill={isAnomalyCord ? '#451a03' : '#0c1a2e'}
              stroke={cordColor} strokeWidth={isAnomalyCord ? 2 : 1.2}
              filter={isAnomalyCord ? 'url(#csGlowAmber)' : undefined} />
            {isAnomalyCord && (
              <circle cx={cx} cy={135} r="12" fill="#f59e0b" opacity="0.15" className="animate-pulse" />
            )}
            <text x={cx} y={139} fill={cordColor} fontSize="5.5" fontFamily="monospace"
              textAnchor="middle" fontWeight={isAnomalyCord ? 'bold' : 'normal'}>
              {(i * 3 + 1)}
            </text>
          </g>
        );
      })}

      {/* Anomaly annotation for S03 */}
      {hasAnomaly && splice.id === 'S03' && (
        <g>
          <line x1="316" y1="115" x2="316" y2="80" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="388" y1="115" x2="388" y2="80" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
          <rect x="310" y="55" width="90" height="22" rx="4" fill="#451a03" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="355" y="70" fill="#fbbf24" fontSize="8" fontFamily="monospace"
            fontWeight="bold" textAnchor="middle">CORDS #28-31</text>
          <text x="355" y="78" fill="#f59e0b" fontSize="7" fontFamily="monospace" textAnchor="middle">MFL ANOMALY</text>
        </g>
      )}

      {/* Bottom cover rubber */}
      <rect x="80" y="160" width="740" height="22" rx="3"
        fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
      <text x="450" y="175" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">
        BOTTOM COVER · RETURN SIDE
      </text>

      {/* ── MFL Flux Spectrum (bottom) — from supplied HTML concept ── */}
      <text x="450" y="220" fill="#38bdf8" fontSize="10" fontFamily="monospace"
        fontWeight="bold" textAnchor="middle">MFL FLUX LEAKAGE SPECTRUM (64 CHANNELS)</text>

      {/* Spectrum bars */}
      {Array.from({ length: 32 }).map((_, i) => {
        const bx = 100 + i * 22;
        const isAnomalyChan = splice.id === 'S03' && (i === 13 || i === 14 || i === 15);
        const baseHeight = 8 + Math.sin(i * 0.7) * 6 + Math.random() * 4;
        const height = isAnomalyChan
          ? 35 + Math.random() * 12 // spike for anomaly
          : baseHeight;
        const barColor = isAnomalyChan ? '#f59e0b' : i % 3 === 0 ? '#0284c7' : '#1e40af';

        return (
          <g key={`spectrum-${i}`}>
            <rect x={bx - 7} y={320 - height} width="14" height={height} rx="2"
              fill={barColor} opacity={isAnomalyChan ? 1 : 0.7}
              filter={isAnomalyChan ? 'url(#csGlowAmber)' : undefined} />
            {i % 4 === 0 && (
              <text x={bx} y="332" fill="#475569" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
                {(i * 2 + 1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Threshold line */}
      <line x1="95" y1="288" x2="810" y2="288"
        stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.5" />
      <text x="820" y="291" fill="#f59e0b" fontSize="7.5" fontFamily="monospace">THRESHOLD</text>

      {/* ── Evidence summary ── */}
      <g transform="translate(680, 80)">
        <rect x="0" y="0" width="200" height="100" rx="6"
          fill="#0f172a" stroke={isWarning ? '#f59e0b' : '#1e3a5f'} strokeWidth="1.5" />
        <text x="10" y="16" fill={isWarning ? '#fbbf24' : '#10b981'} fontSize="9"
          fontFamily="monospace" fontWeight="bold">
          {splice.condition.toUpperCase()} · {splice.score}/100
        </text>
        <text x="10" y="30" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
          MFL: {splice.evidence.magnetic.status}
        </text>
        <text x="10" y="42" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
          Flux: {splice.evidence.magnetic.fluxLeakageGauss}G
        </text>
        <text x="10" y="54" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
          Vision: {splice.evidence.vision.status}
        </text>
        <text x="10" y="66" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
          Confidence: {splice.evidence.magnetic.confidence}%
        </text>
        <text x="10" y="80" fill="#64748b" fontSize="7" fontFamily="monospace">
          Trend: {splice.trend}
        </text>
        <text x="10" y="92" fill="#64748b" fontSize="7" fontFamily="monospace">
          Install: {splice.installDate}
        </text>
      </g>

      <text x="450" y="372" fill="#1e3a5f" fontSize="9" fontFamily="monospace"
        textAnchor="middle" opacity="0.6">NUNAR DIGITAL TWIN · CROSS-SECTION VIEW · {splice.id} @ {splice.baselineCoordinate}m</text>
    </svg>
  );
};

// ─── Main DigitalTwinCanvas component ─────────────────────────────────────────
export const DigitalTwinCanvas: React.FC<DigitalTwinCanvasProps> = ({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSplice = splices[selectedSpliceId] || splices['S03'] || Object.values(splices)[0];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-xl overflow-hidden bg-slate-950"
      style={{ minHeight: 340 }}
    >
      {/* Zoom wrapper */}
      <div
        className="w-full h-full transition-transform duration-300 origin-center"
        style={{ transform: `scale(${zoom})` }}
      >
        {viewMode === 'orbit' && (
          <OrbitView
            conveyor={conveyor}
            splices={splices}
            selectedSpliceId={selectedSpliceId}
            onSelectSplice={onSelectSplice}
            layers={layers}
            inspectionStatus={inspectionStatus}
            isCameraContaminated={isCameraContaminated}
          />
        )}
        {viewMode === 'walkway' && (
          <WalkwayView
            conveyor={conveyor}
            splices={splices}
            selectedSpliceId={selectedSpliceId}
            onSelectSplice={onSelectSplice}
            layers={layers}
          />
        )}
        {viewMode === 'cross' && selectedSplice && (
          <CrossSectionView
            splice={selectedSplice}
          />
        )}
      </div>

      {/* View mode badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700/60 text-[9px] font-mono-tech text-cyan-500 uppercase tracking-wider pointer-events-none">
        {viewMode === 'orbit' ? 'Orbit View' : viewMode === 'walkway' ? 'Linear Chainage' : 'Cross-Section'}
      </div>

      {/* Scanning active indicator */}
      {(inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone') && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-950/90 border border-violet-600/60 text-[9px] font-mono-tech text-violet-300 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span>{inspectionStatus === 'Scanning' ? 'SCANNING' : 'INSPECTION ZONE'}</span>
        </div>
      )}
    </div>
  );
};
