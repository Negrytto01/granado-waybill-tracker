import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const useInactivityTimeout = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      supabase.auth.signOut();
    }, TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
};
