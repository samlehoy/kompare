'use client';

import { useEffect } from 'react';
import DesktopShell from './DesktopShell.jsx';
import { useWindowStore } from '@/store/useWindowStore';

export default function RouteShell({ windowId }) {
  const openWindow = useWindowStore((state) => state.openWindow);

  useEffect(() => {
    openWindow(windowId);
  }, [openWindow, windowId]);

  return <DesktopShell />;
}
