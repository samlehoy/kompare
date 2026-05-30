"use client";

import { useId, useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useWindowStore } from '@/store/useWindowStore';

export default function RetroWindow({ windowId, title, children, as: Element = 'section', className = '', style = {} }) {
  const titleId = `${useId()}-title`;
  const [isDesktop, setIsDesktop] = useState(true);

  const windows = useWindowStore(state => state.windows);
  const focusWindow = useWindowStore(state => state.focusWindow);
  const closeWindow = useWindowStore(state => state.closeWindow);
  const toggleMinimize = useWindowStore(state => state.toggleMinimize);
  const toggleMaximize = useWindowStore(state => state.toggleMaximize);

  const win = windowId ? windows.find(w => w.id === windowId) : null;
  const zIndex = win ? win.zIndex : 100;
  const isMinimized = win?.isMinimized || false;
  const isMaximized = win?.isMaximized || false;

  useEffect(() => {
    const checkWidth = () => setIsDesktop(window.innerWidth >= 768);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const handleFocus = () => {
    if (windowId && !isMinimized) focusWindow(windowId);
  };

  const handleMinimize = (e) => {
    e.stopPropagation();
    if (windowId) toggleMinimize(windowId);
  };

  const handleMaximize = (e) => {
    e.stopPropagation();
    if (windowId) toggleMaximize(windowId);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (windowId) closeWindow(windowId);
  };

  return (
    <>
      {(isMaximized || (!isDesktop && windowId)) && (
        <style>{`[aria-labelledby="${titleId}"] { transform: none !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: calc(100vh - 42px) !important; margin: 0 !important; }`}</style>
      )}
      {windowId ? (
        <Rnd
          default={{
            x: 50,
            y: 50,
            width: style.width || 600,
            height: 'auto'
          }}
          minWidth={300}
          minHeight={200}
          maxWidth="100vw"
          maxHeight="calc(100vh - 42px)"
          bounds="window"
          dragHandleClassName="retro-window-titlebar"
          disableDragging={!isDesktop || isMaximized}
          enableResizing={isDesktop && !isMaximized}
          onMouseDown={handleFocus}
          style={{ zIndex, display: isMinimized ? 'none' : 'flex', flexDirection: 'column' }}
          className={`retro-window ${className}`.trim()}
          aria-labelledby={titleId}
        >
          <div className="retro-window-titlebar" style={{ cursor: (isDesktop && !isMaximized) ? 'move' : 'default', flexShrink: 0 }}>
            <h1 id={titleId}>{title}</h1>
            <div className="window-controls" aria-hidden="true">
              <span onClick={handleMinimize} style={{ cursor: 'pointer' }}>_</span>
              {isDesktop && <span onClick={handleMaximize} style={{ cursor: 'pointer' }}>[]</span>}
              <span onClick={handleClose} style={{ cursor: 'pointer' }}>x</span>
            </div>
          </div>
          <div className="retro-window-body" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        </Rnd>
      ) : (
        <Element style={{ ...style, display: isMinimized ? 'none' : 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 42px)' }} className={`retro-window ${className}`.trim()} aria-labelledby={titleId}>
          <div className="retro-window-titlebar" style={{ flexShrink: 0 }}>
            <h1 id={titleId}>{title}</h1>
          </div>
          <div className="retro-window-body" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        </Element>
      )}
    </>
  );
}
