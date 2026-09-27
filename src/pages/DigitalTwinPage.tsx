/**
 * DigitalTwinPage — NUNAR Digital Twin workspace.
 *
 * Integrates the new 3-view canvas (Orbit, Walkway, Cross-Section) from the
 * second implementation with all existing NUNAR data and functionality.
 *
 * Layout:
 *   ┌──────────────┬─────────────────────────────────┬───────────────────┐
 *   │ StationPanel │   DigitalTwinCanvas              │ SpliceInfoPanel   │
 *   │ (left)       │   + DigitalTwinControls (top)    │ (right)           │
 *   └──────────────┴─────────────────────────────────┴───────────────────┘
 *
 * All data consumed from AppContext — no independent data model.
 * No Three.js required — uses the existing SVG-based visualization approach
 * extended with the industrial design concepts from the second implementation.
 */

import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Splice, SpliceId } from '../types';
import { createFallbackSplice } from '../data/mockData';

import { DigitalTwinCanvas, ViewMode, LayerVisibility } from '../components/digital-twin/DigitalTwinCanvas';
import { DigitalTwinControls } from '../components/digital-twin/DigitalTwinControls';
import { SpliceInfoPanel } from '../components/digital-twin/SpliceInfoPanel';
import { StationPanel } from '../components/digital-twin/StationPanel';

// ─── Zoom bounds ─────────────────────────────────────────────────────────────
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const DEFAULT_ZOOM = 1.0;
const DEFAULT_VIEW: ViewMode = 'orbit';
const DEFAULT_LAYERS: LayerVisibility = {
  splices: true,
  sensors: true,
  alerts: true,
  anomalies: true,
};

export const DigitalTwinPage: React.FC = () => {
  const {
    conveyor,
    splices,
    selectedSpliceId,
    setSelectedSpliceId,
    setActiveTab,
    sensorHealth,
    spareReadiness,
    inspectionStatus,
    distanceToStation,
    approachingSplice,
    triggerScanSequence,
    isCameraContaminated,
  } = useApp();

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);

  // ── Derived data ────────────────────────────────────────────────────────────
  const selectedSplice: Splice =
    splices[selectedSpliceId] ||
    splices['S03'] ||
    createFallbackSplice(selectedSpliceId);

  const selectedSpare = spareReadiness[selectedSpliceId];
  const isScanning =
    inspectionStatus === 'Scanning' || inspectionStatus === 'In_Inspection_Zone';

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleZoom = useCallback((delta: number) => {
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((prev + delta).toFixed(1)))));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setViewMode(DEFAULT_VIEW);
    setLayers(DEFAULT_LAYERS);
  }, []);

  const handleToggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleSelectSplice = useCallback(
    (id: SpliceId) => {
      setSelectedSpliceId(id);
      // Auto-switch to cross-section on splice click if already in walkway
      if (viewMode === 'walkway') {
        setViewMode('cross');
      }
    },
    [setSelectedSpliceId, viewMode]
  );

  const handleTriggerScan = useCallback(() => {
    triggerScanSequence(selectedSpliceId);
  }, [triggerScanSequence, selectedSpliceId]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 pb-8" style={{ height: 'calc(100vh - 120px)', minHeight: 600 }}>

      {/* ── Page title row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="font-display-tech text-cyan-700">NUNAR</span>
            <span className="text-slate-400 font-normal">·</span>
            <span>Digital Twin</span>
            <span className="text-slate-400 font-normal text-sm">— Kirandul CV-01</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Live belt coordinate model · multimodal splice tracking · {conveyor.loopLengthM}m loop · OPC-UA telemetry
          </p>
        </div>

        {/* Live status pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono-tech text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{conveyor.status.toUpperCase()} · {conveyor.speedMs} m/s · Pass #{conveyor.currentPass}</span>
          </div>
          {isScanning && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-[10px] font-mono-tech text-violet-800">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
              <span>SCANNING {approachingSplice?.id}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div className="shrink-0">
        <DigitalTwinControls
          viewMode={viewMode}
          onViewMode={setViewMode}
          zoom={zoom}
          onZoom={handleZoom}
          onResetView={handleResetView}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onTriggerScan={handleTriggerScan}
          isScanning={isScanning}
        />
      </div>

      {/* ── Main 3-column workspace ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-3">

        {/* ── Left: Station & splice panel ── */}
        <div className="hidden lg:block min-h-0">
          <StationPanel
            splices={splices}
            selectedSpliceId={selectedSpliceId}
            onSelectSplice={handleSelectSplice}
            sensorHealth={sensorHealth}
            conveyor={conveyor}
            inspectionStatus={inspectionStatus}
            distanceToStation={distanceToStation}
            approachingSplice={approachingSplice}
          />
        </div>

        {/* ── Center: Digital Twin canvas ── */}
        <div className="min-h-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-950 shadow-lg">
          <DigitalTwinCanvas
            conveyor={conveyor}
            splices={splices}
            selectedSpliceId={selectedSpliceId}
            onSelectSplice={handleSelectSplice}
            viewMode={viewMode}
            layers={layers}
            zoom={zoom}
            inspectionStatus={inspectionStatus}
            isCameraContaminated={isCameraContaminated}
          />
        </div>

        {/* ── Right: Splice info panel ── */}
        <div className="min-h-0">
          <SpliceInfoPanel
            splice={selectedSplice}
            spare={selectedSpare}
            onNavigatePassport={() => setActiveTab('passports')}
            onNavigateMaintenance={() => setActiveTab('maintenance')}
            onTriggerScan={handleTriggerScan}
            isScanning={isScanning}
            conveyor={conveyor}
          />
        </div>
      </div>

      {/* ── Mobile: Station panel collapsed below canvas ── */}
      <div className="lg:hidden shrink-0">
        <div className="grid grid-cols-2 gap-2">
          {/* Splice quick-select on mobile */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-2">Splices</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.values(splices) as Splice[]).map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSplice(s.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono-tech font-bold cursor-pointer transition-colors ${
                    selectedSpliceId === s.id
                      ? s.condition === 'Warning' ? 'bg-amber-500 text-white' : 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {s.id} · {s.score}
                </button>
              ))}
            </div>
          </div>

          {/* Sensor health on mobile */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-2">Sensors</div>
            <div className="space-y-1">
              {sensorHealth.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 truncate flex-1">{s.category}</span>
                  <span className={`text-[10px] font-mono-tech font-bold ${
                    s.status === 'Nominal' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>{s.confidencePct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
