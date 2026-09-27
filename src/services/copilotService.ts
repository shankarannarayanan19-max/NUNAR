import { GoogleGenAI } from '@google/genai';
import { Conveyor, Splice, Alert, MaintenanceTask, SensorHealth, InspectionEvent, SpareReadiness } from '../types';

export interface CopilotContext {
  conveyor: Conveyor;
  splices: Record<string, Splice>;
  alerts: Alert[];
  maintenanceTasks: MaintenanceTask[];
  sensorHealth: SensorHealth[];
  inspectionEvents: InspectionEvent[];
  spareReadiness: Record<string, SpareReadiness>;
  activeTab: string;
  selectedSpliceId: string;
  isCameraContaminated: boolean;
}

export interface CopilotAction {
  label: string;
  type: 'navigate' | 'select_splice' | 'trigger_scan' | 'acknowledge_alert' | 'toggle_camera';
  payload?: string;
}

export interface CopilotResponse {
  text: string;
  actions?: CopilotAction[];
  source: 'gemini' | 'simulated';
  modelUsed?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Authoritative Industrial Gemini System Prompt for NUNAR AI Copilot
 */
export const GEMINI_INDUSTRIAL_SYSTEM_PROMPT = `You are NUNAR AI Copilot, an industrial conveyor-belt condition monitoring and predictive-maintenance assistant.

Your role is to assist plant engineers and maintenance personnel by interpreting structured data produced by the NUNAR system.

IMPORTANT ARCHITECTURE RULE:
You are NOT the primary safety controller.
You must NOT independently command, stop, start, or control conveyor equipment.
Safety trips and emergency shutdowns are handled by dedicated local safety/interlock logic.
Your role is to explain evidence, identify risks, support engineering decisions, and recommend maintenance actions.

==================================================
1. SYSTEM CONTEXT
==================================================

SpliceGuard monitors conveyor-belt splice health using multiple sensing modalities:

• RFID — splice identity
• Rotary encoder — belt position and movement
• MFL / DMI — internal steel-cord condition
• Line-scan / vision — external belt condition
• LWIR thermal — thermal condition
• Acoustic Emission (AE) — structural/acoustic activity
• Belt tension — mechanical operating condition
• Motor current / ore load — operating condition

The system separates:

A. EXTERNAL CONDITION
   - surface cracks
   - gouges
   - longitudinal tears
   - edge damage
   - surface wear
   - deformation

B. INTERNAL STEEL CONDITION
   - steel-cord anomaly
   - broken/ damaged cord indicators
   - magnetic flux leakage
   - cord pitch deviation
   - corrosion-related magnetic changes
   - splice internal abnormalities

C. THERMAL CONDITION
   - surface temperature
   - temperature difference from baseline
   - hotspot
   - hotspot persistence

D. OPERATIONAL CONDITION
   - belt speed
   - tension
   - load
   - motor current
   - accumulated operating time / tonnage

==================================================
2. SENSOR INTERPRETATION
==================================================

Never interpret one sensor in isolation when the system provides multimodal evidence.

Consider:
• sensor value
• sensor confidence
• healthy baseline
• deviation from baseline
• trend over time
• spatial location
• temporal relationship
• operating conditions
• agreement/disagreement with other sensors

A sensor anomaly does NOT automatically mean equipment failure.

Examples:
- MFL abnormal + Vision normal: Possible internal steel-cord degradation that is not externally visible.
- Vision abnormal + MFL normal: Possible surface-only damage.
- Thermal abnormal alone: Investigate thermal/environmental/operational causes before concluding structural failure.
- AE abnormal alone: Treat as an event requiring corroboration because acoustic signals can be affected by environmental and mechanical noise.
- MFL + thermal + spatial agreement: Stronger evidence of internal degradation.
- MFL + vision + thermal + AE with spatial and temporal agreement: Strong multimodal evidence, subject to sensor confidence and validation.

==================================================
3. NORMAL / WARNING / HIGH / CRITICAL
==================================================

Use the condition classification supplied by the SpliceGuard fusion engine.
Do NOT invent universal industrial thresholds.
Thresholds may depend on belt construction, sensor configuration, OEM specifications, commissioning baseline, operating conditions, and plant-specific historical data.
If a value is baseline-dependent, explicitly state that.

==================================================
4. SENSOR FUSION
==================================================

When explaining a risk classification, identify:
1. Which sensors are abnormal
2. Their confidence
3. Whether they refer to the same splice
4. Whether their physical locations agree
5. Whether their trends agree
6. Whether the operating conditions support the interpretation
7. Which evidence is strongest
8. Which evidence is contradictory or uncertain

Always distinguish:
- OBSERVED: What the sensors actually measured.
- INFERRED: What the fusion/model interprets from those measurements.
- PREDICTED: What the prognostic model expects to happen in the future.

==================================================
5. RFID AND LOCATION
==================================================

RFID provides splice identity. Encoder provides belt movement and spatial position.
Use these together to identify splice ID, belt position, inspection position, and historical record.
RFID is NOT a health sensor.

==================================================
6. DMI / MFL
==================================================

DMI represents spatial magnetic information derived from MFL measurements.
Explain detected magnetic anomaly, spatial position, affected region, confidence, comparison with previous inspections, and trend.
Do not claim DMI directly visually observes a physical steel-cord break. It provides magnetic evidence associated with internal steel condition.

==================================================
7. RUL (REMAINING USEFUL LIFE)
==================================================

RUL is a MODEL ESTIMATE, not a guaranteed failure date.
When RUL is available, report estimated range (e.g., "Estimated RUL: 11–16 days"), confidence, degradation trend, contributing signals, and operating conditions.
If historical failure data is insufficient, clearly say that the RUL is provisional.

==================================================
8. FINANCIAL IMPACT
==================================================

Financial impact must be presented as an estimate.
Consider production rate, expected downtime, value per tonne, repair cost, spare-part cost, labour, cleanup, and restart cost.
If required inputs are unavailable, state: "Financial exposure cannot be reliably calculated until plant-specific production and cost parameters are provided."

==================================================
9. MAINTENANCE RECOMMENDATIONS
==================================================

Actions:
- LOW: Continue monitoring.
- WARNING: Increase monitoring and inspect during next suitable maintenance opportunity.
- HIGH: Plan maintenance within predicted risk window and verify required spares.
- CRITICAL: Escalate immediately and follow plant's approved safety/interlock procedure.

Do NOT tell an engineer to bypass safety procedures. Do NOT claim the AI directly controls the motor drive.

==================================================
10. PLANNED MAINTENANCE & SPARE-PART MANAGEMENT
==================================================

Check inventory data supplied by the backend.
If available: State required spare is available.
If unavailable: Recommend creating a procurement request. Procurement requires configured engineer approval workflow.

==================================================
11. RESPONSE STYLE & DATA INTEGRITY
==================================================

Respond like an industrial engineering assistant: concise, technically precise, evidence-based, structured.
For engineering questions, use sections: Current Condition, Evidence, Interpretation, Risk, Recommended Action.
Never invent sensor readings, splice IDs, belt positions, RUL values, failure dates, financial losses, or inventory quantities.
`;

/**
 * Builds structured live telemetry payload to send alongside system context
 */
export function buildTelemetryPayload(context: CopilotContext): string {
  const {
    conveyor,
    splices,
    alerts,
    maintenanceTasks,
    sensorHealth,
    spareReadiness,
    activeTab,
    selectedSpliceId,
    isCameraContaminated,
  } = context;

  const activeAlertsStr = alerts
    .filter((a) => a.status === 'Open')
    .map(
      (a) =>
        `- [Severity: ${a.severity}] ID: ${a.id} | Splice: ${a.spliceId} | Title: ${a.title} | Trigger Pass: #${a.pass} | Message: ${a.message}`
    )
    .join('\n') || 'None';

  const splicesStr = Object.values(splices)
    .map((s) => {
      const sp = spareReadiness[s.id];
      return `• Splice ID: ${s.id}
  - Type: ${s.spliceType} | Steel Cord: ${s.cordType}
  - Belt Position: ${s.baselineCoordinate}m along 420m loop
  - Condition: ${s.condition} (Score: ${s.score}/100, Trend: ${s.trend})
  - Vision Evidence: [${s.evidence.vision.status}] ${s.evidence.vision.observedAnomaly} (Confidence: ${s.evidence.vision.confidence}%)
  - Magnetic (MFL/DMI): [${s.evidence.magnetic.status}] ${s.evidence.magnetic.observedAnomaly} (Flux Leakage: ${s.evidence.magnetic.fluxLeakageGauss} Gauss, Est Cord Breaks: ${s.evidence.magnetic.cordBreakagesEst}, Confidence: ${s.evidence.magnetic.confidence}%)
  - Operating Context: Motor Current ${s.evidence.operatingContext.motorCurrentA}A, Belt Speed ${s.evidence.operatingContext.beltSpeedMs}m/s, Load ${s.evidence.operatingContext.loadFactorPct}%
  - Spare Kit Readiness: ${sp ? `Status: ${sp.vulcanizingKitStatus}, Kit: ${sp.kitPartNumber}, Loc: ${sp.warehouseLocation}, Exposure: ${sp.estimatedProductionExposureInr}` : 'Standard Stock'}`;
    })
    .join('\n\n');

  const maintenanceStr = maintenanceTasks
    .map(
      (m) =>
        `- Work Order ${m.id} | Target Splice: ${m.spliceId} | Status: ${m.status} | Priority: ${m.priority} | Assigned: ${m.assignedTechnicianName || m.assignedTechnicianId || 'Unassigned'}`
    )
    .join('\n') || 'None';

  const sensorsStr = sensorHealth
    .map((s) => `- ${s.name} (${s.category}): ${s.status} [Confidence: ${s.confidencePct}%]`)
    .join('\n');

  return `CURRENT STRUCTURED TELEMETRY SNAPSHOT:
==================================================
Conveyor Belt: ${conveyor.name} (${conveyor.id}) - ${conveyor.location}
Status: ${conveyor.status} | Speed: ${conveyor.speedMs} m/s | Pass: #${conveyor.currentPass} | Encoder Pos: ${conveyor.currentCoordinateM}m / ${conveyor.loopLengthM}m
Reference Realignment State: ${conveyor.referenceState} (Last sync pass #${conveyor.referenceLastSyncPass})
Drive Motor: ${conveyor.driveMotorKw} kW | Motor Current: ${conveyor.motorCurrentA} A | Belt Tension: ${conveyor.beltTensionKn} kN | Load: ${conveyor.loadFactorPct}%
Optical Camera Lens Contamination: ${isCameraContaminated ? 'ALERT: Contaminated/Degraded' : 'Nominal Clean'}
Active Dashboard View: ${activeTab} | Currently Focused Splice: ${selectedSpliceId}

SPLICE MULTIMODAL EVIDENCE MATRIX:
${splicesStr}

ACTIVE ALERTS QUEUE:
${activeAlertsStr}

MAINTENANCE WORK ORDERS:
${maintenanceStr}

SENSOR DIAGNOSTIC HEALTH:
${sensorsStr}
==================================================`;
}

export interface CopilotBackendStatus {
  geminiConfigured: boolean;
  geminiReachable: boolean;
  model: string;
  memoryEnabled: boolean;
  activeSessionsCount: number;
}

/**
 * Checks backend status for Gemini connectivity and diagnostics
 */
export async function checkCopilotBackendStatus(): Promise<CopilotBackendStatus> {
  try {
    const res = await fetch('/api/copilot/status');
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('Backend copilot status endpoint offline/unreachable:', err);
  }
  return {
    geminiConfigured: false,
    geminiReachable: false,
    model: 'gemini-2.5-flash',
    memoryEnabled: true,
    activeSessionsCount: 0,
  };
}

/**
 * Query entry point for SpliceGuard Copilot - calls backend POST /api/copilot
 */
export async function queryCopilot(
  userQuery: string,
  context: CopilotContext,
  chatHistory: ChatTurn[] = [],
  sessionId: string = 'default-session'
): Promise<CopilotResponse> {
  try {
    const res = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userQuery,
        context,
        sessionId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        text: data.text,
        actions: data.actions || [],
        source: data.source === 'gemini' ? 'gemini' : 'simulated',
        modelUsed: data.modelUsed,
      };
    }
  } catch (err) {
    console.warn('Backend Copilot API call failed, falling back to frontend domain engine:', err);
  }

  // Fallback domain intelligence engine matching system prompt rules
  return generateDomainFallbackResponse(userQuery, context);
}

/**
 * Extracts executable dashboard actions from query and context
 */
function extractActionsFromQueryAndContext(
  query: string,
  responseText: string,
  context: CopilotContext
): CopilotAction[] {
  const actions: CopilotAction[] = [];
  const q = (query + ' ' + responseText).toLowerCase();

  if (q.includes('live inspection') || q.includes('live scan') || q.includes('camera view')) {
    actions.push({ label: '📡 Open Live Inspection', type: 'navigate', payload: 'live' });
  }

  if (q.includes('digital twin') || q.includes('3d model') || q.includes('3d view')) {
    actions.push({ label: '🌐 Open Digital Twin', type: 'navigate', payload: 'digital-twin' });
  }

  if (q.includes('passport') || q.includes('splice s03') || q.includes('s03 history')) {
    actions.push({ label: '📄 View Splice S03 Passport', type: 'navigate', payload: 'passports' });
    actions.push({ label: '🔍 Select Splice S03', type: 'select_splice', payload: 'S03' });
  }

  if (q.includes('alert') || q.includes('high severity') || q.includes('critical') || q.includes('alt-001')) {
    actions.push({ label: '🚨 Open Alerts Center', type: 'navigate', payload: 'alerts' });
  }

  if (q.includes('maintenance') || q.includes('work order') || q.includes('technician')) {
    actions.push({ label: '🔧 Open Maintenance Page', type: 'navigate', payload: 'maintenance' });
  }

  if (q.includes('scan') || q.includes('trigger scan') || q.includes('inspect s03')) {
    actions.push({ label: '⚡ Trigger High-Res Scan S03', type: 'trigger_scan', payload: 'S03' });
  }

  return actions;
}

/**
 * Structured fallback response engine enforcing system prompt rules
 */
function generateDomainFallbackResponse(userQuery: string, context: CopilotContext): CopilotResponse {
  const q = userQuery.toLowerCase();
  const { splices, alerts, maintenanceTasks, conveyor, spareReadiness, isCameraContaminated } = context;

  const s03 = splices['S03'];
  const openAlerts = alerts.filter((a) => a.status === 'Open');
  const s03Spare = spareReadiness['S03'];

  let text = '';
  const actions: CopilotAction[] = [];

  if (q.includes('s03') || q.includes('anomaly') || q.includes('magnetic') || q.includes('degradation')) {
    text = `### Current Condition (Splice S03)
**Classification:** ${s03?.condition || 'Warning'} (Score: **${s03?.score || 68}/100**)
- **Position:** ${s03?.baselineCoordinate || 210}m along 420m conveyor loop (RFID: ${s03?.id || 'S03'})
- **Estimated RUL:** **11–16 days** (Provisional model estimate under current 3.2 m/s, 78% load)

### Multimodal Evidence
1. **OBSERVED (Magnetic / MFL):** 1.85 Gauss Flux Leakage detected across steel cords #7–9.
2. **OBSERVED (Vision / Line-Scan):** Minor surface micro-cracking (42mm length, 94% confidence).
3. **OBSERVED (Operating Context):** Motor current 342A, belt speed 3.2 m/s, ambient temp 34°C.

### Interpretation & Fusion
- **MFL Abnormal + Vision Micro-cracking:** Indicates internal steel-cord degradation corroborated by minor surface stress propagation. 
- **Location & Spatial Alignment:** Magnetic leakage peak aligns spatially with baseline coordinate 210.4m.
- **Evidence Weight:** Magnetic flux leakage provides primary evidence of internal structural degradation.

### Risk & Financial Exposure
- **Risk State:** Warning (Elevated degradation velocity of +1.4% per 1,000 passes).
- **Financial Exposure:** Estimated ${s03Spare?.estimatedProductionExposureInr || '₹4,80,000'} in potential unscheduled downtime if unmitigated.

### Recommended Action
- **WARNING Level:** Increase monitoring frequency. Schedule physical inspection during next planned downtime window.
- **Spare Verification:** Kit **${s03Spare?.kitPartNumber || 'K-800'}** status is **${s03Spare?.vulcanizingKitStatus || 'READY'}** in ${s03Spare?.warehouseLocation || 'Kirandul B3'}.`;

    actions.push({ label: '⚡ Trigger High-Res Scan S03', type: 'trigger_scan', payload: 'S03' });
    actions.push({ label: '📄 View S03 Passport', type: 'navigate', payload: 'passports' });
    actions.push({ label: '🔧 Go to Maintenance Work Orders', type: 'navigate', payload: 'maintenance' });
  } else if (q.includes('alert') || q.includes('high priority') || q.includes('critical') || q.includes('warning')) {
    text = `### Active Alerts Summary (${openAlerts.length} Open Alerts)

${openAlerts
  .map(
    (a) =>
      `#### [${a.severity}] ${a.id}: ${a.title}
- **Splice Target:** ${a.spliceId} at ${splices[a.spliceId]?.baselineCoordinate || 0}m
- **Observed Reading:** ${a.message}
- **Recommendation:** ${a.recommendation}`
  )
  .join('\n\n')}

### Risk Classification
- **Primary Failure Risk:** **ALT-001** on Splice S03 due to internal magnetic anomaly.
- **Recommended Response:** Escalate **ALT-001** to Shift B Maintenance Engineer for scheduled window alignment.`;

    actions.push({ label: '🚨 Open Alerts Center', type: 'navigate', payload: 'alerts' });
    actions.push({ label: '🔧 Review Maintenance Schedule', type: 'navigate', payload: 'maintenance' });
  } else if (q.includes('maintenance') || q.includes('schedule') || q.includes('repair') || q.includes('technician') || q.includes('spare')) {
    text = `### Planned Maintenance & Spare Parts Status

- **Work Orders Active:** ${maintenanceTasks.length} Work Orders
- **Critical Task:** Maintenance Task for Splice S03 (Priority: Urgent / Interlock)
- **Assigned Technician:** Ramesh Kumar (Level 3 Vulcanizing Specialist)

### Spare-Part Management
- **Vulcanizing Kit (S03):** Kit **${s03Spare?.kitPartNumber || 'K-800'}**
- **Inventory Status:** **${s03Spare?.vulcanizingKitStatus || 'READY'}** in ${s03Spare?.warehouseLocation || 'Kirandul Warehouse B3'}
- **Estimated Lead Time:** ${s03Spare?.leadTimeHours || 2} hours standby

### Recommended Action
- Perform repair during planned maintenance window. Spares confirmed in stock. Do not bypass plant safety interlock procedures.`;

    actions.push({ label: '🔧 Go to Maintenance Tasks', type: 'navigate', payload: 'maintenance' });
    actions.push({ label: '📦 View Spares & Financials', type: 'navigate', payload: 'readiness' });
  } else if (q.includes('health') || q.includes('camera') || q.includes('sensor') || q.includes('status')) {
    text = `### Multimodal Sensor Diagnostic Health

- **Conveyor Belt Status:** ${conveyor.status} (${conveyor.speedMs} m/s | Pass #${conveyor.currentPass})
- **Optical Line-Scan Camera:** ${isCameraContaminated ? '⚠️ Degraded (Dust Contamination Alert)' : '✅ Nominal (98% Confidence)'}
- **Magnetic Flux (MFL/DMI) Array:** ✅ Active & Calibrated
- **Laser Profilometer:** ✅ Operational
- **Rotary Shaft Encoder:** ✅ Synchronized at 0.00m reference mark

### Sensor Quality & Corroboration
${isCameraContaminated ? '- **Camera Contamination:** Optical confidence lowered to 74%. MFL sensor array remains fully operational and reliable.' : '- All primary sensor modalities operating within baseline tolerances.'}`;

    if (isCameraContaminated) {
      actions.push({ label: '🧼 Simulate Lens Cleaning', type: 'toggle_camera' });
    }
    actions.push({ label: '📡 View System Health Page', type: 'navigate', payload: 'system-health' });
  } else {
    text = `### NUNAR AI Copilot (Kirandul Complex CV-01)

I am your industrial conveyor-belt condition monitoring assistant, interpreting structured multimodal telemetry.

### Current Operating Summary
- **Conveyor State:** ${conveyor.status} | Belt Speed: ${conveyor.speedMs} m/s | Pass #${conveyor.currentPass}
- **Primary Risk Area:** **Splice S03** (Condition Score: ${s03?.score}/100 [Warning], Est RUL: 11–16 days)
- **Active Open Alerts:** ${openAlerts.length} Open Alerts

### What would you like to inspect?
1. **Splice S03 Multimodal Evidence** (MFL vs Vision vs Thermal)
2. **Open Alerts & Mitigation**
3. **Maintenance Schedule & Spare-Part Inventory**
4. **Sensor System Calibration & Health**`;

    actions.push({ label: '⚡ Scan Splice S03', type: 'trigger_scan', payload: 'S03' });
    actions.push({ label: '🌐 Open Digital Twin', type: 'navigate', payload: 'digital-twin' });
    actions.push({ label: '🚨 View Active Alerts', type: 'navigate', payload: 'alerts' });
  }

  return {
    text,
    actions,
    source: 'simulated',
  };
}
