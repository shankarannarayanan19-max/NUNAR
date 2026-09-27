/**
 * CopilotDrawer — Floating, draggable, resizable SpliceGuard AI Copilot panel.
 *
 * Architecture:
 * - useCopilotLayout  → drag / resize / localStorage persistence
 * - CopilotMessage    → per-message rendering (user bubble / AI card)
 * - CopilotMarkdown   → safe markdown renderer (no dangerouslySetInnerHTML)
 *
 * What changed vs the original:
 * - Panel is now freely draggable (pointer-event drag on header)
 * - Panel is resizable from all edges / corners
 * - Position + size saved to localStorage under "spliceguard-copilot-layout"
 * - Header shows real connection state, memory turn count, Reset Layout button
 * - Messages use CopilotMessage → no more raw ** or ### in output
 * - Raw SVG / HTML artifacts are stripped before rendering
 * - Loading state shows animated "Analyzing live context…" indicator
 * - Source badge (Gemini / Domain Fallback) on every AI message
 * - All existing actions, navigation, scan triggers preserved unchanged
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  queryCopilot,
  checkCopilotBackendStatus,
  CopilotResponse,
  CopilotAction,
  CopilotBackendStatus,
} from '../services/copilotService';
import {
  Send,
  X,
  Minimize2,
  Maximize2,
  Brain,
  RotateCcw,
  Zap,
} from 'lucide-react';

import { CopilotMessage } from './copilot/CopilotMessage';
import { useCopilotLayout, ResizeEdge } from './copilot/useCopilotLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  actions?: CopilotAction[];
  source?: 'gemini' | 'simulated';
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Quick action chips
// ---------------------------------------------------------------------------
const QUICK_ACTIONS = [
  { label: 'Plant Status', prompt: 'whats the plant status' },
  { label: 'Active Alerts', prompt: 'show active alerts' },
  { label: 'Digital Twin', prompt: 'digital twin' },
  { label: 'Maintenance', prompt: 'maintenance' },
  { label: 'Sensor Health', prompt: 'sensor diagnostics' },
  { label: 'Scan S03', prompt: 'analyze splice S03' },
];

// ---------------------------------------------------------------------------
// Resize handle component
// ---------------------------------------------------------------------------
// Edges we actually render — subset of the full ResizeEdge union from the hook
type VisibleEdge = 'bottom-right' | 'bottom' | 'right' | 'bottom-left' | 'left';

function ResizeEdgeHandle({
  edge,
  resizeHandleProps,
}: {
  edge: VisibleEdge;
  resizeHandleProps: (edge: ResizeEdge) => object;
}) {
  const edgeStyles: Record<VisibleEdge, string> = {
    'bottom-right': 'absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10',
    bottom: 'absolute bottom-0 left-4 right-4 h-1.5 cursor-s-resize z-10',
    right: 'absolute right-0 top-10 bottom-4 w-1.5 cursor-e-resize z-10',
    'bottom-left': 'absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-10',
    left: 'absolute left-0 top-10 bottom-4 w-1.5 cursor-w-resize z-10',
  };

  return (
    <div
      className={`${edgeStyles[edge]} select-none`}
      {...resizeHandleProps(edge)}
    >
      {/* Visual grip only on bottom-right corner */}
      {edge === 'bottom-right' && (
        <svg
          viewBox="0 0 12 12"
          className="absolute bottom-1 right-1 w-3 h-3 text-slate-600 hover:text-cyan-600 transition-colors pointer-events-none"
          fill="currentColor"
        >
          {/* Three diagonal dots — classic resize grip */}
          <circle cx="10" cy="10" r="1.2" />
          <circle cx="7" cy="10" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    activeTab,
    setActiveTab,
    selectedSpliceId,
    setSelectedSpliceId,
    conveyor,
    splices,
    alerts,
    maintenanceTasks,
    sensorHealth,
    inspectionEvents,
    spareReadiness,
    isCameraContaminated,
    triggerScanSequence,
    toggleCameraContamination,
    acknowledgeAlert,
  } = useApp();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [backendStatus, setBackendStatus] =
    useState<CopilotBackendStatus | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Layout: drag + resize + localStorage
  const { layout, dragHandleProps, resizeHandleProps, resetLayout } =
    useCopilotLayout();

  // Initial welcome message — built once using live conveyor data
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-1',
      sender: 'copilot',
      text: [
        '### NUNAR AI Copilot Ready',
        '',
        `**Conveyor:** ${conveyor.name} — ${conveyor.status} at ${conveyor.speedMs} m/s`,
        `**Primary Risk:** Splice S03 — Condition 68/100 (Warning)`,
        `**Open Alerts:** ${alerts.filter((a) => a.status === 'Open').length} active`,
        '',
        'Select a quick action or ask me about plant status, splice conditions, maintenance, or sensor health.',
      ].join('\n'),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      source: 'simulated',
      actions: [
        { label: 'Trigger Scan S03', type: 'trigger_scan', payload: 'S03' },
        { label: 'View Active Alerts', type: 'navigate', payload: 'alerts' },
        { label: 'Open Digital Twin', type: 'navigate', payload: 'digital-twin' },
      ],
    },
  ]);

  // -------------------------------------------------------------------------
  // Backend status
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      checkCopilotBackendStatus().then((s) => setBackendStatus(s));
    }
  }, [isOpen]);

  const isGeminiConnected =
    backendStatus?.geminiConfigured && backendStatus?.geminiReachable;

  // -------------------------------------------------------------------------
  // Auto-scroll
  // -------------------------------------------------------------------------
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      // Small delay so the DOM has painted the new message
      const t = setTimeout(scrollToBottom, 60);
      return () => clearTimeout(t);
    }
  }, [messages, isOpen, isMinimized, scrollToBottom]);

  // -------------------------------------------------------------------------
  // Action handler — unchanged from original
  // -------------------------------------------------------------------------
  const handleActionClick = useCallback(
    (action: CopilotAction) => {
      switch (action.type) {
        case 'navigate':
          if (action.payload) setActiveTab(action.payload as any);
          break;
        case 'select_splice':
          if (action.payload) setSelectedSpliceId(action.payload as any);
          break;
        case 'trigger_scan':
          triggerScanSequence((action.payload as any) || 'S03');
          break;
        case 'toggle_camera':
          toggleCameraContamination();
          break;
        case 'acknowledge_alert':
          if (action.payload) acknowledgeAlert(action.payload);
          break;
      }
    },
    [
      setActiveTab,
      setSelectedSpliceId,
      triggerScanSequence,
      toggleCameraContamination,
      acknowledgeAlert,
    ]
  );

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------
  const handleSend = useCallback(
    async (queryText?: string) => {
      const textToSend = (queryText ?? input).trim();
      if (!textToSend || isLoading) return;

      const ts = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: ts,
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!queryText) setInput('');
      setIsLoading(true);

      try {
        const copilotCtx = {
          conveyor,
          splices,
          alerts,
          maintenanceTasks,
          sensorHealth,
          inspectionEvents,
          spareReadiness,
          activeTab,
          selectedSpliceId,
          isCameraContaminated,
        };

        const historyTurns = messages.map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
          timestamp: m.timestamp,
        }));

        const response: CopilotResponse = await queryCopilot(
          textToSend,
          copilotCtx,
          historyTurns
        );

        // Auto-navigate if backend returns a navigation action
        if (response.actions) {
          const navAction = response.actions.find(
            (a) => a.type === 'navigate' && a.payload
          );
          if (navAction) handleActionClick(navAction);
        }

        const botMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'copilot',
          text: response.text,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          actions: response.actions,
          source: response.source,
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            sender: 'copilot',
            text: '**Communication error.** Unable to reach NUNAR AI Copilot service. Please try again.',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            source: 'simulated',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      isLoading,
      conveyor,
      splices,
      alerts,
      maintenanceTasks,
      sensorHealth,
      inspectionEvents,
      spareReadiness,
      activeTab,
      selectedSpliceId,
      isCameraContaminated,
      messages,
      handleActionClick,
    ]
  );

  // -------------------------------------------------------------------------
  // Keyboard shortcut: Shift+Enter = newline, Enter = send
  // -------------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // -------------------------------------------------------------------------
  // Render guard
  // -------------------------------------------------------------------------
  if (!isOpen) return null;

  // -------------------------------------------------------------------------
  // Panel style — positioned via layout state
  // -------------------------------------------------------------------------
  const panelStyle: React.CSSProperties = isMinimized
    ? {
        position: 'fixed',
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: 52,
        zIndex: 50,
      }
    : {
        position: 'fixed',
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 320,
        minHeight: 400,
      };

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------
  return (
    <div
      style={panelStyle}
      className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden select-none"
    >
      {/* ================================================================
          HEADER — drag handle
      ================================================================ */}
      <div
        {...dragHandleProps}
        className="
          flex items-center justify-between gap-2
          px-3 py-2.5
          bg-slate-950/95 border-b border-slate-800
          shrink-0
        "
      >
        {/* Left: identity + status */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon badge */}
          <div className="relative shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 p-px flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-cyan-400" />
              </div>
            </div>
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-[1.5px] ring-slate-950 ${
                isGeminiConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
          </div>

          {/* Text */}
          <div className="min-w-0">
            <div className="font-display-tech font-bold text-[11px] text-white tracking-wide leading-none truncate">
              NU<span className="text-cyan-400">NAR</span>{' '}
              <span className="text-slate-300">AI Copilot</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 font-mono-tech text-[9px] leading-none">
              {/* Connection state */}
              {isGeminiConnected ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Gemini Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Domain Fallback
                </span>
              )}
              <span className="text-slate-700">·</span>
              {/* Memory count */}
              <span className="text-slate-500">
                Memory: {messages.length} turns
              </span>
              <span className="text-slate-700">·</span>
              {/* Live context badge */}
              <span className="text-cyan-600">Live Context</span>
            </div>
          </div>
        </div>

        {/* Right: controls — pointerDown must NOT propagate to drag handle */}
        <div
          className="flex items-center gap-0.5 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Reset layout */}
          <button
            onClick={resetLayout}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Reset panel position & size"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Minimize / restore */}
          <button
            onClick={() => setIsMinimized((v) => !v)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close Copilot"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ================================================================
          BODY — only rendered when not minimized
      ================================================================ */}
      {!isMinimized && (
        <>
          {/* ============================================================
              MESSAGES AREA — this is the ONLY scrollable region
          ============================================================ */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-3 bg-slate-900/70"
            style={{ overscrollBehavior: 'contain' }}
          >
            {messages.map((msg) => (
              <CopilotMessage
                key={msg.id}
                sender={msg.sender}
                text={msg.text}
                timestamp={msg.timestamp}
                actions={msg.actions}
                source={msg.source}
                onAction={handleActionClick}
              />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                {/* Avatar */}
                <div className="shrink-0 w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center mt-0.5">
                  <Brain className="w-3 h-3 text-cyan-400" />
                </div>
                {/* Pulse card */}
                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl rounded-tl-none px-3 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1 items-center">
                    <span
                      className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                  <span className="text-[10px] font-mono-tech text-slate-400">
                    Analyzing live context…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ============================================================
              QUICK ACTIONS BAR — sticky above input
          ============================================================ */}
          <div className="shrink-0 px-2.5 py-1.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
            {QUICK_ACTIONS.map((qa, i) => (
              <button
                key={i}
                onClick={() => handleSend(qa.prompt)}
                disabled={isLoading}
                className="
                  shrink-0 flex items-center gap-1
                  px-2.5 py-1
                  rounded-full
                  bg-slate-800/80 hover:bg-slate-700
                  border border-slate-700/60 hover:border-slate-600
                  text-slate-400 hover:text-slate-200
                  font-mono-tech text-[10px]
                  whitespace-nowrap
                  transition-all duration-150
                  disabled:opacity-40 disabled:cursor-not-allowed
                  cursor-pointer
                "
              >
                <Zap className="w-2.5 h-2.5 text-cyan-600 shrink-0" />
                {qa.label}
              </button>
            ))}
          </div>

          {/* ============================================================
              CHAT INPUT — fixed at panel bottom
          ============================================================ */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-slate-950 border-t border-slate-800"
            // Stop pointer events propagating to drag/resize handlers
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask about plant status, alerts, maintenance…"
              autoComplete="off"
              className="
                flex-1 min-w-0
                bg-slate-900 border border-slate-700/80 rounded-lg
                px-3 py-1.5
                text-[11px] text-white placeholder:text-slate-600
                font-sans
                focus:outline-none focus:border-cyan-600/70 focus:ring-1 focus:ring-cyan-600/30
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="
                shrink-0 p-2
                bg-gradient-to-r from-cyan-600 to-indigo-600
                hover:from-cyan-500 hover:to-indigo-500
                text-white rounded-lg shadow
                transition-all duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
                cursor-pointer active:scale-95
              "
              title="Send (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}

      {/* ================================================================
          RESIZE HANDLES — only when fully expanded
      ================================================================ */}
      {!isMinimized && (
        <>
          <ResizeEdgeHandle edge="bottom-right" resizeHandleProps={resizeHandleProps} />
          <ResizeEdgeHandle edge="bottom" resizeHandleProps={resizeHandleProps} />
          <ResizeEdgeHandle edge="right" resizeHandleProps={resizeHandleProps} />
          <ResizeEdgeHandle edge="bottom-left" resizeHandleProps={resizeHandleProps} />
          <ResizeEdgeHandle edge="left" resizeHandleProps={resizeHandleProps} />
        </>
      )}
    </div>
  );
};
