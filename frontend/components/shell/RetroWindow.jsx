"use client";

import { useId, useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useWindowStore } from '@/store/useWindowStore';

export default function RetroWindow({
  windowId,
  title,
  children,
  as: Element = 'section',
  className = '',
  style = {},
  onClose,
  onMinimize,
  onMaximize,
}) {
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
    if (onMinimize) onMinimize(e);
    else if (windowId) toggleMinimize(windowId);
  };

  const handleMaximize = (e) => {
    e.stopPropagation();
    if (onMaximize) onMaximize(e);
    else if (windowId) toggleMaximize(windowId);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (onClose) onClose(e);
    else if (windowId) closeWindow(windowId);
  };

  const hasMinimize = Boolean(onMinimize || windowId);
  const hasMaximize = Boolean(onMaximize || (windowId && isDesktop));
  const hasClose = Boolean(onClose || windowId);
  const hasControls = hasMinimize || hasMaximize || hasClose;

  const renderControls = () => {
    if (!hasControls) return null;
    return (
      <div className="window-controls">
        {hasMinimize && (
          <button
            type="button"
            aria-label="Minimize window"
            className="retro-window-control-btn retro-window-control-btn--minimize"
            onClick={handleMinimize}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMinimize(e);
              }
            }}
          >
            <span className="retro-window-control-glyph" aria-hidden="true" />
          </button>
        )}
        {hasMaximize && (
          <button
            type="button"
            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
            className={`retro-window-control-btn retro-window-control-btn--maximize${isMaximized ? ' is-restore' : ''}`}
            onClick={handleMaximize}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMaximize(e);
              }
            }}
          >
            <span className="retro-window-control-glyph" aria-hidden="true" />
          </button>
        )}
        {hasClose && (
          <button
            type="button"
            aria-label="Close window"
            className="retro-window-control-btn retro-window-control-btn--close"
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClose(e);
              }
            }}
          >
            <span className="retro-window-control-glyph" aria-hidden="true" />
          </button>
        )}
      </div>
    );
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
            {renderControls()}
          </div>
          <div className="retro-window-body" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        </Rnd>
      ) : (
        <Element style={{ ...style, display: isMinimized ? 'none' : 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 42px)' }} className={`retro-window ${className}`.trim()} aria-labelledby={titleId}>
          <div className="retro-window-titlebar" style={{ flexShrink: 0 }}>
            <h1 id={titleId}>{title}</h1>
            {renderControls()}
          </div>
          <div className="retro-window-body" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        </Element>
      )}
    </>
  );
}
