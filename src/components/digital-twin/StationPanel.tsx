/**
 * StationPanel — Left sidebar panel for the NUNAR Digital Twin.
 *
 * Shows:
 * - Material flow stations (6 nodes from the second HTML implementation,
 *   adapted to the NMDC Kirandul plant topology)
 * - Splice selector with condition badges
 * - Compact sensor health summary (from existing AppContext SensorHealth data)
 *
 * All data comes from AppContext — no independent state.
 */

import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Activity,
  Eye,
  Magnet,
  Radio,
  Cpu,
  Thermometer,
  Settings,
} from 'lucide-react';
import { Splice, SpliceId, SensorHealth } from '../../types';

interface StationPanelProps {
  splices: Record<string, Splice>;
  selectedSpliceId: SpliceId;
  onSelectSplice: (id: SpliceId) => void;
  sensorHealth: SensorHealth[];
  conveyor: {
    status: string;
    speedMs: number;
    currentCoordinateM: number;
    loopLengthM: number;
    motorCurrentA: number;
    loadFactorPct: number;
    driveMotorKw: number;
  };
  inspectionStatus: string;
  distanceToStation: number;
  approachingSplice: Splice | null;
}

// ─── Station definitions (adapted from supplied HTML for NMDC plant) ──────────
const PLANT_STATIONS = [
  {
    id: '01',
    name: 'Rotary Tippler & Track Hopper',
    shortName: 'Rotary Tippler',
    desc: 'Continuous Wagon Dumping Cycle',
    status: 'DUMPING',
    statusColor: 'text-cyan-400',
    dotColor: 'bg-cyan-400',
    borderColor: 'border-cyan-900/50',
    coord: '0m',
  },
  {
    id: '02',
    name: 'Apron Feeder & Primary Crusher',
    shortName: 'Primary Crusher',
    desc: '60×89 Superior Crusher Chute',
    status: 'OK',
    statusColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
    borderColor: 'border-emerald-900/40',
    coord: '70m',
  },
  {
    id: '03',
    name: 'Stockyard Radial Stacker',
    shortName: 'Stockyard Stacker',
    desc: '2.5Mt Hematite Blending Bed',
    status: 'ACTIVE',
    statusColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
    borderColor: 'border-emerald-900/40',
    coord: '210m',
  },
  {
    id: '04',
    name: 'Defect Diagnostic Gantry',
    shortName: 'Inspection Gantry',
    desc: 'MFL, AE, Splice Tags, Dual Cams',
    status: 'MONITOR',
    statusColor: 'text-violet-400',
    dotColor: 'bg-violet-400',
    borderColor: 'border-violet-900/50',
    coord: '210m',
  },
  {
    id: '05',
    name: 'Head Drive & Discharge Chute',
    shortName: 'Head Drive',
    desc: 'Dual 850 kW Drive & Wrap',
    status: 'OK',
    statusColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
    borderColor: 'border-emerald-900/40',
    coord: '390m',
  },
  {
    id: '06',
    name: 'Secondary Sizing Tower',
    shortName: 'Secondary Sizer',
    desc: 'Secondary Cone Crusher & Screens',
    status: 'OK',
    statusColor: 'text-slate-400',
    dotColor: 'bg-slate-400',
    borderColor: 'border-slate-700/40',
    coord: '420m',
  },
];

// ─── Sensor icon lookup ───────────────────────────────────────────────────────
function SensorIcon({ category }: { category: string }) {
  if (category.includes('Vision')) return <Eye className="w-3 h-3 text-violet-400" />;
  if (category.includes('MFL') || category.includes('Magnetic')) return <Magnet className="w-3 h-3 text-cyan-400" />;
  if (category.includes('Encoder')) return <Activity className="w-3 h-3 text-emerald-400" />;
  if (category.includes('Reference')) return <Radio className="w-3 h-3 text-amber-400" />;
  if (category.includes('SCADA')) return <Cpu className="w-3 h-3 text-slate-400" />;
  return <Settings className="w-3 h-3 text-slate-400" />;
}

// ─── Main component ───────────────────────────────────────────────────────────
export const StationPanel: React.FC<StationPanelProps> = ({
  splices,
  selectedSpliceId,
  onSelectSplice,
  sensorHealth,
  conveyor,
  inspectionStatus,
  distanceToStation,
  approachingSplice,
}) => {
  const spliceList = Object.values(splices) as Splice[];

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-700/70 overflow-hidden">

      {/* ── Header ── */}
      <div className="px-3 py-2.5 bg-slate-950/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-display-tech font-bold text-[11px] text-white tracking-wide">
            NU<span className="text-cyan-400">NAR</span> Digital Twin
          </span>
        </div>
        <div className="text-[9px] font-mono-tech text-slate-500 mt-0.5">
          Kirandul CV-01 · {conveyor.status} · {conveyor.speedMs} m/s
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Live conveyor stats */}
        <div className="px-3 py-2 border-b border-slate-800/60">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {[
              { label: 'Motor', value: `${conveyor.driveMotorKw} kW` },
              { label: 'Current', value: `${conveyor.motorCurrentA} A` },
              { label: 'Load', value: `${conveyor.loadFactorPct}%` },
              { label: 'Position', value: `${conveyor.currentCoordinateM.toFixed(0)}m` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[9px] text-slate-600 font-mono-tech">{label}</span>
                <span className="text-[9px] text-slate-300 font-mono-tech font-bold">{value}</span>
              </div>
            ))}
          </div>

          {/* Inspection status */}
          {inspectionStatus !== 'Idle' && (
            <div className={`mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-mono-tech ${
              inspectionStatus === 'Scanning'
                ? 'bg-violet-950/60 text-violet-300 border border-violet-800/50'
                : 'bg-amber-950/40 text-amber-300 border border-amber-900/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                inspectionStatus === 'Scanning' ? 'bg-violet-400 animate-ping' : 'bg-amber-400 animate-pulse'
              }`} />
              <span>{inspectionStatus === 'Scanning' ? 'SCANNING' : inspectionStatus.replace('_', ' ')}</span>
              {approachingSplice && (
                <span className="ml-auto font-bold">{approachingSplice.id} · {distanceToStation}m</span>
              )}
            </div>
          )}
        </div>

        {/* ── Material Flow Stations ── */}
        <div className="px-3 py-2 border-b border-slate-800/60">
          <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Material Flow Stations</span>
            <span className="text-slate-600">6 NODES</span>
          </div>
          <div className="space-y-1">
            {PLANT_STATIONS.map((station) => (
              <div
                key={station.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-slate-950/40 ${station.borderColor}`}
              >
                <div className="shrink-0 w-5 h-5 rounded-md bg-slate-800/80 border border-slate-700/50
                  flex items-center justify-center">
                  <span className="text-[8px] font-mono-tech font-bold text-slate-400">{station.id}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-semibold text-slate-300 truncate">{station.shortName}</div>
                  <div className="text-[8px] text-slate-600 truncate">{station.desc}</div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${station.dotColor}`} />
                  <span className={`text-[8px] font-mono-tech font-bold ${station.statusColor}`}>
                    {station.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Splice Selector ── */}
        <div className="px-3 py-2 border-b border-slate-800/60">
          <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-1.5">
            Splice Registry
          </div>
          <div className="space-y-1">
            {spliceList.map((splice) => {
              const isSelected = selectedSpliceId === splice.id;
              const isWarning = splice.condition === 'Warning';
              const isCritical = splice.condition === 'Critical';
              const col = isCritical ? 'border-rose-700/60 bg-rose-950/30'
                : isWarning ? 'border-amber-700/60 bg-amber-950/30'
                : 'border-slate-700/40 bg-slate-950/40';
              const ringCol = isSelected ? 'ring-1 ring-cyan-500/50' : '';

              return (
                <button
                  key={splice.id}
                  onClick={() => onSelectSplice(splice.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${col} ${ringCol} hover:brightness-110 text-left`}
                >
                  {/* Condition indicator */}
                  <div className="shrink-0">
                    {isCritical
                      ? <AlertTriangle className="w-3 h-3 text-rose-400" />
                      : isWarning
                      ? <AlertTriangle className="w-3 h-3 text-amber-400" />
                      : <CheckCircle className="w-3 h-3 text-emerald-400" />
                    }
                  </div>

                  {/* ID + position */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono-tech font-bold text-slate-200">{splice.id}</span>
                      <span className="text-[8px] text-slate-500 font-mono-tech">{splice.baselineCoordinate}m</span>
                    </div>
                    <div className="text-[8px] text-slate-500 truncate">{splice.trend} · {splice.spliceType.split('-')[0].trim()}</div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <div className={`text-[12px] font-mono-tech font-bold ${
                      isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{splice.score}</div>
                    <div className="text-[8px] text-slate-600 font-mono-tech">/100</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sensor Health Summary ── */}
        <div className="px-3 py-2">
          <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-1.5">
            Sensor Array Health
          </div>

          {/* Fixed sensor matrix from HTML */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[
              { id: 'MFL-RET-04', label: 'MFL Scanner', icon: <Magnet className="w-2.5 h-2.5" />, color: 'text-cyan-400', ok: true },
              { id: 'AE-IDLER', label: 'AE Acoustic', icon: <Radio className="w-2.5 h-2.5" />, color: 'text-violet-400', ok: true },
              { id: 'RGB-CAM', label: 'RGB Camera', icon: <Eye className="w-2.5 h-2.5" />, color: 'text-emerald-400', ok: true },
              { id: 'LWIR-IR', label: 'Thermal IR', icon: <Thermometer className="w-2.5 h-2.5" />, color: 'text-orange-400', ok: true },
            ].map((s) => (
              <div key={s.id}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-950/60 border border-slate-800/50">
                <span className={s.color}>{s.icon}</span>
                <span className="text-[8px] font-mono-tech text-slate-400 truncate">{s.label}</span>
                <span className="ml-auto text-[7px] text-emerald-400">●</span>
              </div>
            ))}
          </div>

          {/* System sensors from AppContext */}
          <div className="space-y-0.5">
            {sensorHealth.map((sensor) => (
              <div key={sensor.id}
                className="flex items-center gap-1.5 py-0.5">
                <SensorIcon category={sensor.category} />
                <span className="text-[9px] text-slate-500 truncate flex-1 min-w-0">{sensor.category}</span>
                <span className={`text-[8px] font-mono-tech font-bold shrink-0 ${
                  sensor.status === 'Nominal' ? 'text-emerald-400'
                    : sensor.status === 'Degraded' ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  {sensor.confidencePct}%
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  sensor.status === 'Nominal' ? 'bg-emerald-500'
                    : sensor.status === 'Degraded' ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500 animate-pulse'
                }`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
