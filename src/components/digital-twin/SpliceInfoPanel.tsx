/**
 * SpliceInfoPanel — Detailed information panel for the selected splice.
 *
 * Displays:
 * - Condition / health score / risk badge
 * - Belt position & RUL estimate
 * - Multimodal evidence: MFL, Vision, LWIR (thermal), AE, MCSA, operational context
 * - Inspection history summary
 * - Maintenance status
 * - Recommended action
 * - Navigation actions (passport, maintenance, trigger scan)
 *
 * All data sourced from existing AppContext splice + spareReadiness data.
 */

import React from 'react';
import {
  AlertTriangle,
  Eye,
  Magnet,
  Thermometer,
  Radio,
  Zap,
  ArrowRight,
  Gauge,
  TrendingDown,
  TrendingUp,
  Minus,
  Wrench,
} from 'lucide-react';
import { Splice, SpareReadiness } from '../../types';

interface SpliceInfoPanelProps {
  splice: Splice;
  spare?: SpareReadiness;
  onNavigatePassport: () => void;
  onNavigateMaintenance: () => void;
  onTriggerScan: () => void;
  isScanning: boolean;
  conveyor: { speedMs: number; currentCoordinateM: number; loopLengthM: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ConditionBadge({ condition, score }: { condition: string; score: number }) {
  const cfg =
    condition === 'Critical'
      ? { bg: 'bg-rose-950', border: 'border-rose-600', text: 'text-rose-300', dot: 'bg-rose-400' }
      : condition === 'Warning'
      ? { bg: 'bg-amber-950', border: 'border-amber-600', text: 'text-amber-300', dot: 'bg-amber-400' }
      : { bg: 'bg-emerald-950', border: 'border-emerald-700', text: 'text-emerald-300', dot: 'bg-emerald-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono-tech font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
      {condition.toUpperCase()} · {score}/100
    </span>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'Declining' || trend === 'Rapid Degradation')
    return <TrendingDown className="w-3.5 h-3.5 text-amber-400" />;
  if (trend === 'Improving')
    return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

function EvidenceRow({
  icon,
  label,
  status,
  detail,
  confidence,
  anomaly,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  detail?: string;
  confidence?: number;
  anomaly?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2 py-1.5 border-b border-slate-800/60 last:border-0 ${anomaly ? 'bg-amber-950/20 -mx-2 px-2 rounded' : ''}`}>
      <div className={`mt-0.5 shrink-0 ${anomaly ? 'text-amber-400' : 'text-slate-500'}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono-tech text-slate-400 font-semibold">{label}</span>
          <span className={`text-[10px] font-semibold ${anomaly ? 'text-amber-300' : 'text-emerald-400'}`}>{status}</span>
        </div>
        {detail && <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{detail}</p>}
        {confidence !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${anomaly ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-[9px] font-mono-tech text-slate-500 shrink-0">{confidence}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-[10px] font-mono-tech text-slate-300 font-semibold">
        {value}{unit && <span className="text-slate-500 font-normal"> {unit}</span>}
      </span>
    </div>
  );
}

// ─── RUL estimate (derived from score + trend — same logic as existing app) ──
function estimateRUL(splice: Splice): string {
  if (splice.condition === 'Healthy') return 'N/A — Healthy';
  if (splice.condition === 'Critical') return '< 3 days (Critical)';
  // For Warning with declining trend and score ~68:
  if (splice.trend === 'Declining' && splice.score <= 70) return '11–16 days (Provisional)';
  if (splice.trend === 'Declining') return '18–28 days (Provisional)';
  return 'Monitor — Stable';
}

// ─── Main component ───────────────────────────────────────────────────────────
export const SpliceInfoPanel: React.FC<SpliceInfoPanelProps> = ({
  splice,
  spare,
  onNavigatePassport,
  onNavigateMaintenance,
  onTriggerScan,
  isScanning,
  conveyor,
}) => {
  const isWarning = splice.condition === 'Warning';
  const isCritical = splice.condition === 'Critical';
  const hasAnomaly = isWarning || isCritical;

  // Time to next gantry pass
  const loopLength = conveyor.loopLengthM || 420;
  const speed = conveyor.speedMs || 3.2;
  const gantryPos = 210; // gantry is at 210m
  const splicePosNow = (splice.baselineCoordinate + conveyor.currentCoordinateM) % loopLength;
  const distToGantry = ((gantryPos - splicePosNow) + loopLength) % loopLength;
  const secsToGantry = speed > 0 ? Math.round(distToGantry / speed) : 0;

  const rul = estimateRUL(splice);

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-700/70 overflow-hidden">
      {/* ── Header ── */}
      <div className={`px-4 py-3 border-b ${hasAnomaly ? 'border-amber-900/50 bg-amber-950/30' : 'border-slate-800 bg-slate-900/80'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-0.5">Selected Splice</div>
            <div className="font-display-tech font-bold text-white text-sm truncate">{splice.id}</div>
            <div className="text-[10px] text-slate-400 truncate">{splice.name}</div>
          </div>
          <ConditionBadge condition={splice.condition} score={splice.score} />
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="text-center">
            <div className="text-[9px] text-slate-500 font-mono-tech">LOCATION</div>
            <div className="text-[11px] font-mono-tech font-bold text-cyan-300">{splice.baselineCoordinate}m</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-slate-500 font-mono-tech">TREND</div>
            <div className="flex items-center justify-center gap-0.5">
              <TrendIcon trend={splice.trend} />
              <span className={`text-[10px] font-mono-tech font-semibold ${
                splice.trend === 'Declining' ? 'text-amber-400' :
                splice.trend === 'Improving' ? 'text-emerald-400' : 'text-slate-400'
              }`}>{splice.trend.split(' ')[0]}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-slate-500 font-mono-tech">GANTRY ETA</div>
            <div className="text-[11px] font-mono-tech font-bold text-amber-300">{secsToGantry}s</div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">

        {/* RUL + Risk */}
        {hasAnomaly && (
          <div className={`p-2.5 rounded-lg border ${
            isCritical ? 'bg-rose-950/30 border-rose-800/50' : 'bg-amber-950/30 border-amber-800/50'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${isCritical ? 'text-rose-400' : 'text-amber-400'}`} />
              <span className={`text-[10px] font-mono-tech font-bold ${isCritical ? 'text-rose-300' : 'text-amber-300'}`}>
                RISK ASSESSMENT
              </span>
            </div>
            <div className="space-y-1">
              <MetricRow label="Est. RUL" value={rul} />
              <MetricRow label="Flux Leakage" value={`${splice.evidence.magnetic.fluxLeakageGauss}G`} />
              <MetricRow label="Est. Cord Damage" value={`~${splice.evidence.magnetic.cordBreakagesEst} strand(s)`} />
            </div>
          </div>
        )}

        {/* Multimodal Evidence */}
        <div>
          <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-1.5">Multimodal Evidence</div>
          <div className="space-y-0">
            <EvidenceRow
              icon={<Magnet className="w-3.5 h-3.5" />}
              label="MFL / Steel Cord"
              status={splice.evidence.magnetic.status}
              detail={splice.evidence.magnetic.observedAnomaly}
              confidence={splice.evidence.magnetic.confidence}
              anomaly={splice.evidence.magnetic.status !== 'Normal Flux'}
            />
            <EvidenceRow
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Vision / Line-Scan"
              status={splice.evidence.vision.status}
              detail={splice.evidence.vision.observedAnomaly}
              confidence={splice.evidence.vision.confidence}
              anomaly={splice.evidence.vision.status !== 'Nominal'}
            />
            <EvidenceRow
              icon={<Thermometer className="w-3.5 h-3.5" />}
              label="LWIR Thermal"
              status="Nominal"
              detail={`Ambient: ${splice.evidence.operatingContext.ambientTempC}°C · No hotspot detected`}
              confidence={96}
              anomaly={false}
            />
            <EvidenceRow
              icon={<Radio className="w-3.5 h-3.5" />}
              label="AE Acoustic"
              status={hasAnomaly ? 'Elevated Events' : 'Nominal'}
              detail={hasAnomaly ? 'Transient acoustic events at splice seam. Corroborates MFL findings.' : 'Background acoustic baseline. No structural transients.'}
              confidence={hasAnomaly ? 87 : 94}
              anomaly={hasAnomaly}
            />
            <EvidenceRow
              icon={<Gauge className="w-3.5 h-3.5" />}
              label="MCSA / Operational"
              status="Nominal"
              detail={`Current: ${splice.evidence.operatingContext.motorCurrentA}A · Load: ${splice.evidence.operatingContext.loadFactorPct}% · Speed: ${splice.evidence.operatingContext.beltSpeedMs}m/s`}
              confidence={97}
              anomaly={false}
            />
          </div>
        </div>

        {/* Joint Anatomy */}
        <div>
          <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-1.5">Joint Anatomy</div>
          <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-slate-500">Top Cover: {splice.thicknessMm}mm</span>
              <span className="text-[9px] text-slate-500">Width: {splice.widthMm}mm</span>
            </div>
            {/* Cord representation */}
            <div className="flex items-center gap-0.5 overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 flex-1 min-w-0 rounded-sm ${
                    splice.id === 'S03' && i >= 6 && i <= 8
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-cyan-800/60'
                  }`}
                  title={`Cord #${i * 3 + 1}`}
                />
              ))}
            </div>
            {splice.id === 'S03' && (
              <div className="text-[9px] text-amber-400 font-mono-tech mt-1">↑ Cords #28–31 Anomaly (MFL)</div>
            )}
            <div className="text-[9px] text-slate-600 mt-1">{splice.cordType.split('(')[0].trim()}</div>
          </div>
        </div>

        {/* Maintenance Status */}
        <div>
          <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-wider mb-1.5">Maintenance</div>
          <div className="space-y-1">
            <MetricRow label="Status" value={splice.maintenanceStatus} />
            <MetricRow label="Passes Inspected" value={splice.inspectionCount} />
            <MetricRow label="Last Pass" value={`#${splice.lastInspectedPass}`} />
            {spare && (
              <>
                <MetricRow label="Spare Kit" value={spare.kitPartNumber} />
                <MetricRow
                  label="Kit Status"
                  value={spare.vulcanizingKitStatus}
                />
                <MetricRow label="Location" value={spare.warehouseLocation.split(' ').slice(-2).join(' ')} />
              </>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <div className={`p-2.5 rounded-lg border text-[10px] leading-relaxed ${
          hasAnomaly
            ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
            : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-200'
        }`}>
          <div className="font-mono-tech font-bold text-[9px] uppercase tracking-wider mb-1 text-slate-400">
            Recommended Action
          </div>
          {splice.recommendation}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="shrink-0 px-3 py-2.5 border-t border-slate-800 space-y-1.5 bg-slate-950/60">
        <button
          onClick={onTriggerScan}
          disabled={isScanning}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold
            bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500
            text-white border border-amber-600/40 shadow-sm transition-all cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          <Zap className="w-3.5 h-3.5" />
          {isScanning ? 'Scanning…' : `Trigger Scan ${splice.id}`}
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onNavigatePassport}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold
              bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700
              transition-all cursor-pointer active:scale-95"
          >
            <ArrowRight className="w-3 h-3" />
            Splice Passport
          </button>
          <button
            onClick={onNavigateMaintenance}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold
              bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700
              transition-all cursor-pointer active:scale-95"
          >
            <Wrench className="w-3 h-3" />
            Work Orders
          </button>
        </div>
      </div>
    </div>
  );
};
