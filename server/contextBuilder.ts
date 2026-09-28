import { CopilotIntent } from './intentClassifier';

export interface CopilotContextPayload {
  conveyor: {
    id: string;
    name: string;
    location: string;
    status: string;
    speedMs: number;
    loopLengthM: number;
    currentPass: number;
    currentCoordinateM: number;
    driveMotorKw: number;
    motorCurrentA: number;
    loadFactorPct: number;
    beltTensionKn: number;
    referenceState: string;
  };
  splices: Record<
    string,
    {
      id: string;
      name: string;
      baselineCoordinate: number;
      condition: string;
      score: number;
      trend: string;
      spliceType: string;
      cordType: string;
      inspectionCount: number;
      lastInspectedPass: number;
      maintenanceStatus: string;
      evidence: {
        vision: { status: string; description: string; confidence: number; observedAnomaly: string };
        magnetic: {
          status: string;
          description: string;
          cordBreakagesEst: number;
          fluxLeakageGauss: number;
          confidence: number;
          observedAnomaly: string;
        };
        operatingContext: { loadFactorPct: number; beltSpeedMs: number; motorCurrentA: number };
      };
      conditionHistory?: Array<{ pass: number; timestamp: string; score: number }>;
      recommendation: string;
    }
  >;
  alerts: Array<{
    id: string;
    spliceId: string;
    severity: string;
    title: string;
    message: string;
    evidence: string;
    recommendation: string;
    status: string;
    timestamp: string;
    pass: number;
  }>;
  maintenanceTasks: Array<{
    id: string;
    spliceId: string;
    title: string;
    priority: string;
    status: string;
    assignedTechnicianName?: string;
    recommendedWindow: string;
  }>;
  sensorHealth: Array<{
    name: string;
    category: string;
    status: string;
    confidencePct: number;
    diagnostics: string;
  }>;
  spareReadiness: Record<
    string,
    {
      spliceId: string;
      vulcanizingKitStatus: string;
      kitPartNumber: string;
      warehouseLocation: string;
      leadTimeHours: number;
      estimatedDowntimeHours: number;
      estimatedProductionExposureInr: string;
      estimatedMaintenanceCostInr: string;
    }
  >;
  activeTab?: string;
  selectedSpliceId?: string;
  isCameraContaminated?: boolean;
}

export const SENSOR_ENGINEERING_MANUAL = `
SPLICEGUARD SENSING MODALITIES & ENGINEERING REFERENCE:

1. MFL (Magnetic Flux Leakage):
   - Measures internal steel cord condition by detecting leakage flux caused by cord breaks, corrosion, or pitch displacement.
   - Normal: Baseline flux leakage (<0.5 Gauss).
   - Elevated: >1.5 Gauss indicates internal steel cord anomaly.

2. DMI (Digital Magnetic Image):
   - Spatial magnetic profile generated from multi-channel MFL sensor array.
   - Maps exact longitudinal and lateral coordinates of internal cord breaks across splice zone.

3. VISION (Line-Scan Optical Camera):
   - High-resolution top & bottom surface cover monitoring (cracks, cuts, gouges, edge wear).

4. LWIR (Thermal Infrared):
   - Surface temperature differentials across belt width & splice transition zones. Detects hotspot persistence.

5. AE (Acoustic Emission):
   - Detects high-frequency elastic stress waves (cord snap events, micro-friction). Requires corroboration.

6. ROTARY ENCODER:
   - Tracks belt position along 420m loop relative to 0.00m reference mark.

7. RFID TAGS:
   - Physical splice identity markers (S01, S02, S03, S04). Absolute spatial location reference.
`;

/**
 * Selective context builder ensuring target queries get exact required context without unnecessary flooding
 */
export function buildRelevantContext(
  intent: CopilotIntent,
  fullContext: CopilotContextPayload,
  targetEntity?: string
): string {
  const { conveyor, splices, alerts, maintenanceTasks, sensorHealth, spareReadiness, isCameraContaminated } = fullContext;

  const targetSpliceId = targetEntity || fullContext.selectedSpliceId || 'S03';
  const targetSplice = splices[targetSpliceId] || splices['S03'];
  const targetSpare = spareReadiness[targetSpliceId] || spareReadiness['S03'];
  const openAlerts = alerts.filter((a) => a.status === 'Open');

  switch (intent) {
    case 'GREETING':
    case 'CONVERSATIONAL':
      return `CONVERSATIONAL CONTEXT:
Plant: ${conveyor.name || 'CV-01'} | Status: ${conveyor.status || 'Running'} (${conveyor.speedMs || 3.2} m/s)
User greeted the copilot. Reply politely and state readiness to assist with conveyor telemetry and monitoring.`;

    case 'PLANT_STATUS':
      return `PLANT OVERVIEW & CONVEYOR STATUS:
Conveyor: ${conveyor.name} (${conveyor.id}) | Location: ${conveyor.location}
Status: ${conveyor.status} | Speed: ${conveyor.speedMs} m/s | Pass #${conveyor.currentPass} | Pos: ${conveyor.currentCoordinateM}m/${conveyor.loopLengthM}m
Drive Load: ${conveyor.loadFactorPct}% | Motor Current: ${conveyor.motorCurrentA}A | Tension: ${conveyor.beltTensionKn} kN
Primary Risk Target: Splice ${targetSplice.id} at ${targetSplice.baselineCoordinate}m (Score: ${targetSplice.score}/100, Condition: ${targetSplice.condition}, RUL: 11–16 days)
Open Active Alerts: ${openAlerts.length} Open Alerts (${openAlerts.map((a) => `${a.id}: ${a.title}`).join(', ')})
Sensor Health Summary: ${isCameraContaminated ? 'Camera dust contamination alert' : 'All primary sensors nominal'}
Pending Maintenance: Work Order pending for ${targetSplice.id}`;

    case 'ACTIVE_ALERTS':
      return `ACTIVE ALERTS QUEUE (${openAlerts.length} Open Alerts):
${openAlerts
  .map(
    (a) =>
      `• [${a.severity}] Alert ID: ${a.id} | Splice: ${a.spliceId} (Pass #${a.pass})
  Title: ${a.title}
  Observed Evidence: ${a.message}
  Recommendation: ${a.recommendation}`
  )
  .join('\n\n')}`;

    case 'MAINTENANCE_SCHEDULE':
    case 'MAINTENANCE_TASK':
    case 'INVENTORY':
      return `MAINTENANCE WORK ORDERS & SPARE READINESS:
Work Orders:
${maintenanceTasks
  .map(
    (m) =>
      `• Work Order ${m.id} | Splice: ${m.spliceId} | Priority: ${m.priority} | Status: ${m.status} | Assigned: ${m.assignedTechnicianName || 'Unassigned'} | Window: ${m.recommendedWindow}`
  )
  .join('\n')}

Spare Part Readiness:
${Object.entries(spareReadiness)
  .map(
    ([spId, sp]) =>
      `• Splice ${spId}: Kit ${sp.kitPartNumber} | Status: ${sp.vulcanizingKitStatus} | Location: ${sp.warehouseLocation} | Lead Time: ${sp.leadTimeHours}h | Downtime: ${sp.estimatedDowntimeHours}h | Exposure: ${sp.estimatedProductionExposureInr}`
  )
  .join('\n')}`;

    case 'SENSOR_HEALTH':
      return `MULTIMODAL SENSOR DIAGNOSTIC HEALTH:
Camera Lens State: ${isCameraContaminated ? '⚠️ Optical Lens Contaminated (Dust build-up, optical confidence 74%)' : '✅ Nominal Clean (98% confidence)'}
Sensor Diagnostics:
${sensorHealth.map((s) => `• ${s.name} (${s.category}): ${s.status} [Confidence: ${s.confidencePct}%] - ${s.diagnostics}`).join('\n')}`;

    case 'SENSOR_MANUAL':
      return SENSOR_ENGINEERING_MANUAL;

    case 'FINANCIAL_IMPACT':
      return `FINANCIAL READINESS & PRODUCTION EXPOSURE MODEL:
Affected Splice: ${targetSplice.id} (${targetSplice.condition} Condition)
Vulcanizing Kit: ${targetSpare?.kitPartNumber || 'K-800'} (Status: ${targetSpare?.vulcanizingKitStatus || 'READY'})
Estimated Production Exposure: ${targetSpare?.estimatedProductionExposureInr || '₹4,80,000'}
Estimated Repair Cost: ${targetSpare?.estimatedMaintenanceCostInr || '₹1,20,000'}
Estimated Downtime Window: ${targetSpare?.estimatedDowntimeHours || 6} hours`;

    case 'SPLICE_STATUS':
    case 'SPLICE_ANALYSIS':
    case 'RUL':
      return `TARGET SPLICE DETAIL (${targetSplice.id}):
Splice ID: ${targetSplice.id} | Location: ${targetSplice.baselineCoordinate}m | Type: ${targetSplice.spliceType} | Cord: ${targetSplice.cordType}
Condition: ${targetSplice.condition} (Score: ${targetSplice.score}/100, Trend: ${targetSplice.trend})
Estimated RUL: 11–16 days (Provisional model estimate under current operating load)
Vision Evidence: [${targetSplice.evidence.vision.status}] ${targetSplice.evidence.vision.observedAnomaly} (${targetSplice.evidence.vision.confidence}% confidence)
Magnetic (MFL/DMI) Evidence: [${targetSplice.evidence.magnetic.status}] ${targetSplice.evidence.magnetic.observedAnomaly} (Flux Leakage: ${targetSplice.evidence.magnetic.fluxLeakageGauss} Gauss, Cord Breaks: ${targetSplice.evidence.magnetic.cordBreakagesEst}, ${targetSplice.evidence.magnetic.confidence}% confidence)
Operating Context: Motor Current ${targetSplice.evidence.operatingContext.motorCurrentA}A, Speed ${targetSplice.evidence.operatingContext.beltSpeedMs} m/s, Load ${targetSplice.evidence.operatingContext.loadFactorPct}%
Linked Alerts: ${openAlerts.filter((a) => a.spliceId === targetSplice.id).map((a) => `[${a.severity}] ${a.id}: ${a.message}`).join('; ') || 'None'}
Spare Kit: Kit ${targetSpare?.kitPartNumber || 'K-800'} status is ${targetSpare?.vulcanizingKitStatus || 'READY'} in ${targetSpare?.warehouseLocation || 'Warehouse B3'}`;

    default:
      return `GENERAL TELEMETRY SUMMARY:
Conveyor: ${conveyor.name || 'CV-01'} | Speed: ${conveyor.speedMs || 3.2} m/s | Pass: #${conveyor.currentPass || 147}
Highest Risk Splice: ${targetSplice.id} (${targetSplice.condition} condition, score ${targetSplice.score}/100)`;
  }
}