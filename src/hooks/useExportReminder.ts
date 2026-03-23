/**
 * src/hooks/useExportReminder.ts
 *
 * Every INTERVAL_MS, if the catalogue has unsaved changes
 * (lastModifiedAt > lastExportedAt, or lastModifiedAt set and never exported),
 * sets showReminder=true.
 *
 * The reminder is dismissed when:
 *   - the user clicks "Exporter" (lastModifiedAt becomes null)
 *   - the user explicitly dismisses it (snoozes until next interval)
 */

import { useState, useEffect, useRef } from 'react';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface UseExportReminderReturn {
  showReminder: boolean;
  /** Call when user dismisses without exporting — snoozes until next interval */
  dismissReminder: () => void;
}

export function useExportReminder(
  lastModifiedAt: number | null,
  lastExportedAt: number | null
): UseExportReminderReturn {
  const [showReminder, setShowReminder] = useState(false);
  // Tracks when the user last dismissed, to avoid re-showing within the same interval
  const dismissedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const check = () => {
      // Nothing modified — hide and reset
      if (lastModifiedAt === null) {
        setShowReminder(false);
        return;
      }

      // Already exported after last modification
      if (lastExportedAt !== null && lastExportedAt >= lastModifiedAt) {
        setShowReminder(false);
        return;
      }

      // Dismissed recently — wait for next interval
      if (dismissedAtRef.current !== null) {
        const timeSinceDismiss = Date.now() - dismissedAtRef.current;
        if (timeSinceDismiss < INTERVAL_MS) return;
        // Interval elapsed since dismiss — show again
        dismissedAtRef.current = null;
      }

      // Has unsaved changes older than INTERVAL_MS
      const age = Date.now() - lastModifiedAt;
      if (age >= INTERVAL_MS) {
        setShowReminder(true);
      }
    };

    check(); // run immediately on mount / dep change
    const id = setInterval(check, 30_000); // re-check every 30 s (cheap)
    return () => clearInterval(id);
  }, [lastModifiedAt, lastExportedAt]);

  const dismissReminder = () => {
    setShowReminder(false);
    dismissedAtRef.current = Date.now();
  };

  return { showReminder, dismissReminder };
}
