import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';

// Pages
import { OverviewPage } from './pages/OverviewPage';
import { LiveInspectionPage } from './pages/LiveInspectionPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { SplicePassportsPage } from './pages/SplicePassportsPage';
import { AlertsPage } from './pages/AlertsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { PersonnelPage } from './pages/PersonnelPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { FinancialReadinessPage } from './pages/FinancialReadinessPage';

import { CopilotDrawer } from './components/CopilotDrawer';
import { Bot, Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();
  const [isCopilotOpen, setIsCopilotOpen] = React.useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-cyan-200 selection:text-cyan-950 relative">
      {/* Top Cyber-Industrial Header & Navigation */}
      <Header
        onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
        isCopilotOpen={isCopilotOpen}
      />

      {/* Main Responsive Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        {activeTab === 'overview' && <OverviewPage />}
        {activeTab === 'live' && <LiveInspectionPage />}
        {activeTab === 'digital-twin' && <DigitalTwinPage />}
        {activeTab === 'passports' && <SplicePassportsPage />}
        {activeTab === 'alerts' && <AlertsPage />}
        {activeTab === 'maintenance' && <MaintenancePage />}
        {activeTab === 'personnel' && <PersonnelPage />}
        {activeTab === 'system-health' && <SystemHealthPage />}
        {activeTab === 'readiness' && <FinancialReadinessPage />}
      </main>

      {/* Floating Copilot Launcher Button when closed */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-2xl border border-cyan-500/50 hover:border-cyan-400 flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer group"
          title="Open AI Copilot"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Bot className="w-4 h-4 text-cyan-400 group-hover:animate-bounce" />
              </div>
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-950 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold font-display-tech tracking-wide flex items-center gap-1.5 text-cyan-300">
              <span>AI COPILOT</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-[10px] text-slate-400 font-mono-tech">NUNAR AI Copilot</div>
          </div>
        </button>
      )}

      {/* Global Copilot Drawer Component */}
      <CopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
