const COVER_POSITION_KEY_PREFIX = "profile-cover-position-v1";
const COVER_ZOOM_KEY_PREFIX = "profile-cover-zoom-v1";
const COVER_POSITION_EVENT = "profile-cover-position-changed";

function clampPosition(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildStorageKey(userKey: string | null | undefined) {
  return `${COVER_POSITION_KEY_PREFIX}:${(userKey || "me").trim()}`;
}

function buildZoomStorageKey(userKey: string | null | undefined) {
  return `${COVER_ZOOM_KEY_PREFIX}:${(userKey || "me").trim()}`;
}

function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(100, Math.min(400, Math.round(value)));
}

export function getCoverPositionY(userKey: string | null | undefined) {
  try {
    const raw = localStorage.getItem(buildStorageKey(userKey));
    if (!raw) return 50;
    return clampPosition(Number(raw));
  } catch {
    return 50;
  }
}

export function setCoverPositionY(userKey: string | null | undefined, positionY: number) {
  const next = clampPosition(positionY);
  const normalizedUserKey = (userKey || "me").trim();
  const key = buildStorageKey(normalizedUserKey);
  try {
    localStorage.setItem(key, String(next));
  } catch {
    // ignore storage write errors
  }
  window.dispatchEvent(
    new CustomEvent(COVER_POSITION_EVENT, {
      detail: {
        userKey: normalizedUserKey,
        positionY: next,
      },
    })
  );
  return next;
}

export function getCoverZoom(userKey: string | null | undefined) {
  try {
    const raw = localStorage.getItem(buildZoomStorageKey(userKey));
    if (!raw) return 100;
    return clampZoom(Number(raw));
  } catch {
    return 100;
  }
}

export function setCoverZoom(userKey: string | null | undefined, zoom: number) {
  const next = clampZoom(zoom);
  const normalizedUserKey = (userKey || "me").trim();
  const key = buildZoomStorageKey(normalizedUserKey);
  try {
    localStorage.setItem(key, String(next));
  } catch {
    // ignore storage write errors
  }
  window.dispatchEvent(
    new CustomEvent(COVER_POSITION_EVENT, {
      detail: {
        userKey: normalizedUserKey,
        zoom: next,
      },
    })
  );
  return next;
}

export { COVER_POSITION_EVENT, COVER_POSITION_KEY_PREFIX, COVER_ZOOM_KEY_PREFIX };
