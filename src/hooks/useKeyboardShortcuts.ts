'use client';

import { useEffect } from 'react';
import { useDashboardStore } from '@/store';
import { clearEngine } from '@/simulation/engine';

/**
 * Global keyboard shortcuts:
 *   Space — toggle play/pause
 *   R     — reset simulation
 *   S     — step forward (when paused)
 */
export function useKeyboardShortcuts(stepForward: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in form fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const store = useDashboardStore.getState();

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          if (store.running) {
            store.setRunning(false);
          } else if (store.publisherNodeId && !store.simulationDone) {
            store.setRunning(true);
          }
          break;
        }
        case 'KeyR': {
          e.preventDefault();
          clearEngine();
          store.resetSimulation();
          break;
        }
        case 'KeyS': {
          e.preventDefault();
          if (store.publisherNodeId && !store.running && !store.simulationDone) {
            stepForward();
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [stepForward]);
}
