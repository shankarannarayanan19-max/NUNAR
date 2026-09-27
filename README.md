# NUNAR

### Multimodal AI-Powered Conveyor Belt Condition Monitoring & Predictive Maintenance System

NUNAR is an industrial AI platform designed for continuous conveyor belt condition monitoring, splice-level anomaly detection, predictive maintenance, and maintenance intelligence.

The system combines multiple sensing modalities with AI-based analysis to identify developing belt and splice failures before they become critical.

---

## 🚨 Problem

Conveyor belt failures, especially around splices and internal steel-cord structures, can result in:

- Unplanned conveyor downtime
- Production losses
- Safety risks
- Difficult-to-diagnose internal damage
- Reactive maintenance instead of predictive maintenance

Conventional inspection methods often depend on periodic manual inspection and individual sensing technologies, which may not provide continuous, multimodal condition awareness.

---

## 💡 NUNAR Solution

NUNAR combines multiple sensing technologies and operational data to create a unified digital representation of the conveyor.

### Multimodal Sensing

| Technology | Primary Function |
|---|---|
| 📷 Vision Camera | Surface wear, cuts, gouges, punctures, edge damage, cracks and visible splice damage |
| 🌡️ LWIR Thermal Camera | Thermal anomalies and abnormal heat patterns |
| 🧲 MFL / DMI | Internal steel-cord breakage, degradation and structural anomalies |
| 🎙️ Acoustic Emission (AE) | Dynamic crack and structural activity |
| ⚡ MCSA | Motor/load behaviour and mechanical-condition evidence |
| 📍 Encoder | Belt position and anomaly localization |
| 🏷️ RFID | Splice identification |
| 📊 Operational Sensors | Speed, tension, load and operating context |

---

## 🧠 Multimodal AI

NUNAR correlates evidence from different sensing modalities rather than relying on a single sensor.

The system can:

1. Acquire conveyor telemetry
2. Identify belt and splice location
3. Detect anomalies from individual sensors
4. Correlate multimodal evidence
5. Assess splice/belt condition
6. Estimate developing failure risk
7. Generate maintenance intelligence
8. Connect maintenance requirements with spare readiness

---

## 📚 Research Study

NUNAR was developed following a study of conveyor-belt monitoring, failure mechanisms, inspection methodologies, sensing technologies, and predictive maintenance practices relevant to large-scale iron-ore conveyor systems.

The research study covers:

- Conveyor belt construction and operating principles
- Conveyor splice and joint structures
- Common belt damage and failure mechanisms
- Surface and structural belt defects
- Internal steel-cord degradation
- Splice-related failures
- Longitudinal and transverse belt failures
- Conventional inspection methodologies
- Vision-based inspection
- Thermal inspection
- Magnetic Flux Leakage (MFL) / DMI
- Acoustic Emission (AE)
- Motor Current Signature Analysis (MCSA)
- Conveyor position and splice identification
- Condition monitoring and predictive maintenance
- Digital Twin-based monitoring
- Maintenance and spare-part planning
- ERP-oriented maintenance workflows

### 🔬 Research Reference

The detailed conveyor research study/manual used as a reference during the development of NUNAR is available here:

**[NMDC Conveyor Research & Technical Manual](https://nmdc-conveyor-manual.vercel.app/#research)**

The research provides the technical foundation for identifying which conveyor failure modes can be addressed by each sensing technology and how these observations can be integrated into a predictive-maintenance workflow.

### 🔗 Research → NUNAR

```text
Conveyor Research
       ↓
Failure Mechanism Study
       ↓
Current Inspection Methods
       ↓
Sensor & Technology Mapping
       ↓
Multimodal Monitoring
       ↓
AI-Based Condition Assessment
       ↓
NUNAR Digital Twin
       ↓
Predictive Maintenance
       ↓
ERP / Maintenance Workflow
```
---

## 🛰️ Digital Twin

The NUNAR Digital Twin provides an interactive visualization of the conveyor system.

It represents:

- Conveyor route
- Material-flow stations
- Splice locations
- Sensor locations
- Detected anomalies
- Condition status
- Conveyor operating information
- Digital inspection context

The Digital Twin is integrated into the NUNAR application and acts as the visual layer for condition monitoring and anomaly investigation.

---

## 🔍 Targeted Failure Modes

NUNAR addresses multiple conveyor and splice failure modes, including:

- Surface Wear
- Gouge / Deep Cut
- Puncture
- Edge Damage
- Surface Cracking / Delamination
- Steel-Cord Breakage
- Steel-Cord Corrosion / Degradation
- Longitudinal Rip
- Transverse Tear
- Splice Degradation
- Splice Separation / Opening
- Splice Rupture
- Belt Rupture

---

## 🏭 Predictive Maintenance Workflow

```text
CONVEYOR
   │
   ▼
MULTIMODAL SENSORS
   │
   ├── Vision
   ├── LWIR Thermal
   ├── MFL / DMI
   ├── Acoustic Emission
   ├── MCSA
   ├── Encoder
   └── RFID
   │
   ▼
DATA FUSION
   │
   ▼
AI / CONDITION ANALYSIS
   │
   ├── Anomaly Detection
   ├── Splice Condition Assessment
   ├── Risk Assessment
   └── RUL Estimation
   │
   ▼
NUNAR DIGITAL TWIN
   │
   ▼
ALERT + MAINTENANCE INTELLIGENCE
   │
   ▼
ERP / MAINTENANCE WORKFLOW
   │
   ▼
SPARE PART + MAINTENANCE READINESS
