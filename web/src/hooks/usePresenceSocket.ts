import { useEffect, useRef, useSyncExternalStore } from "react";
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
  const mapRef = useRef(new Map<string, PresenceState>());

  const map = new Map<string, PresenceState>();
  for (const entry of snapshot) {
    map.set(entry.userId, entry);
  }
  mapRef.current = map;

  return mapRef.current;
}

export { isPresenceStillOnline } from "../utils/presence";

export function usePresenceNowTick(intervalMs = 30_000) {
  const tickRef = useRef(Date.now());
  const setTick = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickRef.current = Date.now();
      setTick.current?.();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return useSyncExternalStore(
    (cb) => {
      setTick.current = cb;
      return () => {
        setTick.current = undefined;
      };
    },
    () => tickRef.current,
    () => tickRef.current
  );
}
