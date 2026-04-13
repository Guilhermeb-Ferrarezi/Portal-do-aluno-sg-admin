import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getPresenceSnapshot,
  subscribeToPresence,
} from "../services/presenceSocket";

type PresenceState = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
};

let snapshotCache: PresenceState[] = getPresenceSnapshot();

function subscribe(onStoreChange: () => void) {
  const unsubscribe = subscribeToPresence(() => {
    snapshotCache = getPresenceSnapshot();
    onStoreChange();
  });
  return unsubscribe;
}

function getSnapshot() {
  return snapshotCache;
}

export function usePresenceSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePresenceMap() {
  const snapshot = usePresenceSnapshot();

  return useMemo(() => {
    const map = new Map<string, PresenceState>();
    for (const entry of snapshot) {
      map.set(entry.userId, entry);
    }
    return map;
  }, [snapshot]);
}

export { isPresenceStillOnline } from "../utils/presence";

export function usePresenceNowTick(intervalMs = 30_000) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return tick;
}
