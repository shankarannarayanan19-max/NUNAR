/**
 * DigitalTwinControls — Toolbar for the NUNAR Digital Twin canvas.
 *
 * Controls:
 * - View mode: Orbit / Walkway / Cross-Section
 * - Zoom in / out / reset
 * - Layer toggles: Splices, Sensors, Alerts, Anomalies
 * - Reset view (resets zoom + restores default view)
 * - Trigger scan shortcut
 */

import React from 'react';
import {
  Globe,
  AlignJustify,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Magnet,
  Bell,
  Zap,
  Activity,
  Scan,
} from 'lucide-react';
import { ViewMode, LayerVisibility } from './DigitalTwinCanvas';

interface DigitalTwinControlsProps {
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  zoom: number;
  onZoom: (delta: number) => void;
  onResetView: () => void;
  layers: LayerVisibility;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
  onTriggerScan: () => void;
  isScanning: boolean;
}

// ─── View mode button ─────────────────────────────────────────────────────────
function ViewBtn({
  mode,
  current,
  icon,
  label,
  onClick,
}: {
  mode: ViewMode;
  current: ViewMode;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const isActive = mode === current;
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
        isActive
          ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/70 shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─── Layer toggle button ──────────────────────────────────────────────────────
function LayerBtn({
  active,
  icon,
  label,
  color,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`${active ? 'Hide' : 'Show'} ${label}`}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono-tech transition-all cursor-pointer border ${
        active
          ? `${color} opacity-100`
          : 'text-slate-600 border-slate-700/50 opacity-60 hover:opacity-80'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export const DigitalTwinControls: React.FC<DigitalTwinControlsProps> = ({
  viewMode,
  onViewMode,
  zoom,
  onZoom,
  onResetView,
  layers,
  onToggleLayer,
  onTriggerScan,
  isScanning,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-sm">

      {/* ── Left: View mode selector ── */}
      <div className="flex items-center gap-0.5 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
        <ViewBtn
          mode="orbit"
          current={viewMode}
          icon={<Globe className="w-3.5 h-3.5" />}
          label="Orbit"
          onClick={() => onViewMode('orbit')}
        />
        <ViewBtn
          mode="walkway"
          current={viewMode}
          icon={<AlignJustify className="w-3.5 h-3.5" />}
          label="Chainage"
          onClick={() => onViewMode('walkway')}
        />
        <ViewBtn
          mode="cross"
          current={viewMode}
          icon={<Layers className="w-3.5 h-3.5" />}
          label="Cross-Section"
          onClick={() => onViewMode('cross')}
        />
      </div>

      {/* ── Center: Layer toggles ── */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-mono-tech text-slate-600 mr-0.5 hidden lg:block">LAYERS:</span>
        <LayerBtn
          active={layers.splices}
          icon={<Activity className="w-3 h-3" />}
          label="Splices"
          color="text-cyan-400 border-cyan-800/60 bg-cyan-950/40"
          onClick={() => onToggleLayer('splices')}
        />
        <LayerBtn
          active={layers.sensors}
          icon={<Scan className="w-3 h-3" />}
          label="Sensors"
          color="text-violet-400 border-violet-800/60 bg-violet-950/40"
          onClick={() => onToggleLayer('sensors')}
        />
        <LayerBtn
          active={layers.alerts}
          icon={<Bell className="w-3 h-3" />}
          label="Alerts"
          color="text-amber-400 border-amber-800/60 bg-amber-950/40"
          onClick={() => onToggleLayer('alerts')}
        />
        <LayerBtn
          active={layers.anomalies}
          icon={<Magnet className="w-3 h-3" />}
          label="Anomalies"
          color="text-rose-400 border-rose-800/60 bg-rose-950/40"
          onClick={() => onToggleLayer('anomalies')}
        />
      </div>

      {/* ── Right: Zoom + Reset + Scan ── */}
      <div className="flex items-center gap-1.5">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => onZoom(-0.1)}
            disabled={zoom <= 0.5}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-30"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 text-[10px] font-mono-tech text-slate-400 min-w-[32px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoom(0.1)}
            disabled={zoom >= 2.0}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-30"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reset view */}
        <button
          onClick={onResetView}
          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-slate-800"
          title="Reset view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Trigger scan */}
        <button
          onClick={onTriggerScan}
          disabled={isScanning}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
            isScanning
              ? 'bg-violet-950 text-violet-300 border-violet-700 opacity-80'
              : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-amber-600/50 shadow-sm'
          } disabled:cursor-not-allowed`}
          title="Trigger S03 gantry scan"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isScanning ? 'Scanning…' : 'Scan S03'}</span>
        </button>
      </div>
    </div>
  );
};
