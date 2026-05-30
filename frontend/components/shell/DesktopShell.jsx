"use client";

import { useState, useEffect } from 'react';
import { useWindowStore } from '@/store/useWindowStore';
import { WINDOW_REGISTRY } from './windowRegistry';
import RetroWindow from './RetroWindow';

const DESKTOP_ICONS = [
  { id: 'builder', label: 'Build PC', icon: <img src="/icons/Computer3_32x32_4.png" alt="Build PC" width="32" height="32" /> },
  { id: 'upgrade', label: 'Upgrade', icon: <img src="/icons/HardwareDiag_32x32_4.png" alt="Upgrade" width="32" height="32" /> },
  { id: 'audit', label: 'Audit', icon: <img src="/icons/ComputerFind_32x32_4.png" alt="Audit" width="32" height="32" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <img src="/icons/Explorer100_32x32_4.png" alt="Marketplace" width="32" height="32" /> },
  { id: 'readme', label: 'Readme', icon: <img src="/icons/HelpBook_32x32_4.png" alt="Readme" width="32" height="32" /> },
];

function TaskbarClock() {
  const [time, setTime] = useState(null);

  useEffect(() => {
    const updateClock = () => setTime(new Date());
    updateClock();
    const intervalId = setInterval(updateClock, 10000); // Update every 10s so it doesn't lag a full minute behind
    return () => clearInterval(intervalId);
  }, []);

  if (!time) return <time className="taskbar-clock">--:--</time>;

  return (
    <time className="taskbar-clock">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

export default function DesktopShell({ children }) {
  const { windows, activeWindowId, openWindow, focusWindow, toggleMinimize } = useWindowStore();

  const handleTaskbarClick = (id) => {
    if (activeWindowId === id) {
      toggleMinimize(id);
    } else {
      focusWindow(id);
    }
  };

  return (
    <div className="desktop-shell" data-testid="desktop-shell">
      <nav className="desktop-icons" aria-label="Desktop applications">
        {DESKTOP_ICONS.map((icon) => (
          <button key={icon.label} onClick={() => openWindow(icon.id)} className="desktop-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white' }}>
            <span className="desktop-icon-glyph" aria-hidden="true">{icon.icon || icon.glyph}</span>
            <span>{icon.label}</span>
          </button>
        ))}
      </nav>
      <main className="desktop-stage">
        {children}
        {windows.map(win => {
          const meta = WINDOW_REGISTRY[win.componentId];
          if (!meta) return null;
          const Component = meta.component;
          
          return (
            <RetroWindow key={win.id} windowId={win.id} title={meta.title} style={{ width: meta.defaultWidth || '600px', maxWidth: 'calc(100vw - 16px)' }}>
              <Component />
            </RetroWindow>
          );
        })}
      </main>
      <nav className="taskbar" aria-label="Taskbar">
        <button className="start-button">START</button>
        <div className="taskbar-programs">
          {windows.map((win) => {
            const meta = WINDOW_REGISTRY[win.componentId];
            return (
              <button
                key={win.id}
                onClick={() => handleTaskbarClick(win.id)}
                className={`taskbar-button ${activeWindowId === win.id ? 'is-active' : ''}`}
              >
                {meta ? meta.title : 'PROGRAM'}
              </button>
            );
          })}
        </div>
        <TaskbarClock />
      </nav>
    </div>
  );
}
