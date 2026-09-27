import React from 'react';
import { useApp, NavigationTab } from '../context/AppContext';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Shield,
  Bell,
  Wrench,
  Users,
  Cpu,
  Coins,
  Radio,
  Eye,
  ScanLine,
  Sliders,
  Bot,
} from 'lucide-react';

interface HeaderProps {
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleCopilot, isCopilotOpen }) => {
  const {
    activeTab,
    setActiveTab,
    conveyor,
    alerts,
    maintenanceTasks,
    isDemoRunning,
    demoSpeedMultiplier,
    toggleDemoRunning,
    setDemoSpeedMultiplier,
    resetSimulation,
    triggerScanSequence,
    isCameraContaminated,
  } = useApp();

  const openAlertsCount = alerts.filter((a) => a.status === 'Open').length;
  const pendingMaintenanceCount = maintenanceTasks.filter(
    (m) => m.status === 'Pending' || m.status === 'Assigned'
  ).length;

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'live', label: 'Live Inspection', icon: <ScanLine className="w-4 h-4" /> },
    { id: 'digital-twin', label: 'Digital Twin', icon: <Cpu className="w-4 h-4" /> },
    { id: 'passports', label: 'Splice Passports', icon: <Shield className="w-4 h-4" /> },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: <Bell className="w-4 h-4" />,
      badge: openAlertsCount,
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: <Wrench className="w-4 h-4" />,
      badge: pendingMaintenanceCount,
      badgeColor: 'bg-cyan-500 text-slate-950',
    },
    { id: 'personnel', label: 'Personnel', icon: <Users className="w-4 h-4" /> },
    {
      id: 'system-health',
      label: 'System Health',
      icon: <Radio className="w-4 h-4" />,
      badge: isCameraContaminated ? 1 : undefined,
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    { id: 'readiness', label: 'Financial & Spares', icon: <Coins className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 border-b border-slate-200 backdrop-blur-md shadow-sm">
      {/* Top Context & Telemetry Bar */}
      <div className="px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Brand & SIH Problem Statement metadata */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 p-0.5 flex items-center justify-center shadow-sm">
              <div className="w-full h-full bg-white rounded-[7px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-cyan-600" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display-tech font-bold text-base text-slate-900 tracking-wider">
                  NU<span className="text-cyan-600">NAR</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SIH 2026 | PS 26008
                </span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-2">
                <span>Ministry of Steel / NMDC Heavy-Duty Ore Handling</span>
                <span className="text-slate-300">•</span>
                <span className="text-cyan-700 font-mono-tech font-medium">Kirandul Complex CV-01</span>
              </div>
            </div>
          </div>
        </div>

        {/* Prototype Honesty Badge & Interactive Demo Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-mono-tech text-amber-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold">SIMULATED PROTOTYPE DATA</span>
          </div>

          {/* Quick Demo Controls */}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
            <button
              onClick={toggleDemoRunning}
              title={isDemoRunning ? 'Pause Simulation' : 'Run Simulation'}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                isDemoRunning
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
              }`}
            >
              {isDemoRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isDemoRunning ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={() => setDemoSpeedMultiplier(demoSpeedMultiplier === 1 ? 2 : demoSpeedMultiplier === 2 ? 4 : 1)}
              title="Simulation Speed Multiplier"
              className="px-2 py-1 rounded text-xs font-mono-tech bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border border-slate-300 shadow-xs font-semibold"
            >
              {demoSpeedMultiplier}x
            </button>

            <button
              onClick={resetSimulation}
              title="Reset Simulation State"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => triggerScanSequence('S03')}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-700 transition-colors cursor-pointer border border-cyan-600 flex items-center gap-1 shadow-xs"
            >
              <Zap className="w-3 h-3 text-white" />
              <span>Scan S03</span>
            </button>
          </div>

          {/* AI Copilot Toggle Button */}
          {onToggleCopilot && (
            <button
              onClick={onToggleCopilot}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${
                isCopilotOpen
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500 ring-2 ring-cyan-400/30'
                  : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-300 hover:text-white border-cyan-700/60 hover:border-cyan-400'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="font-display-tech tracking-wide">AI COPILOT</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono-tech bg-cyan-400 text-slate-950 font-bold">
                LLM
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="px-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                isActive
                  ? 'text-cyan-700 border-cyan-600 bg-cyan-50/70 font-semibold'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-tech font-bold ${
                    item.badgeColor || 'bg-cyan-600 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
