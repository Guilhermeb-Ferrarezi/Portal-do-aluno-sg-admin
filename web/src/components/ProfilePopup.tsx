import React, { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Settings, Shield, User } from "lucide-react";
import { obterUsuarioAtual, type UserMe } from "../services/api";
import {
  COVER_POSITION_EVENT,
  COVER_POSITION_KEY_PREFIX,
  COVER_ZOOM_KEY_PREFIX,
  getCoverPositionY,
  getCoverZoom,
} from "../utils/coverPosition";
import { cn } from "../lib/utils";

type ProfilePopupProps = {
  name: string;
  role: string | null;
  profilePictureUrl?: string;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenSettings: () => void;
};

function roleLabel(role: string | null) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

function roleBadgeClass(role: string | null) {
  if (role === "admin") return "border-primary/25 bg-primary/10 text-primary";
  if (role === "professor") return "border-sky-400/25 bg-sky-400/10 text-sky-300";
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
}

function RoleIcon({ role }: { role: string | null }) {
  if (role === "admin") return <Shield size={12} />;
  if (role === "professor") return <User size={12} />;
  return null;
}

const popupClass =
  "fixed z-[10000] w-[300px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 text-white shadow-[0_24px_64px_rgba(0,0,0,0.48)] backdrop-blur max-md:w-[280px]";
const actionButtonClass =
  "cursor-pointer inline-flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white";

export default function ProfilePopup({
  name,
  role,
  profilePictureUrl,
  anchorRef,
  onClose,
  onOpenSettings,
}: ProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [userInfo, setUserInfo] = useState<UserMe | null>(null);
  const [position, setPosition] = useState({ bottom: 0, left: 16 });
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [, refreshCoverState] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    obterUsuarioAtual().then(setUserInfo).catch(console.error);
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      const compact = window.innerWidth <= 768;
      setIsCompactViewport(compact);

      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const clampedLeft = Math.max(16, Math.min(rect.left + 8, window.innerWidth - 316));

      setPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: clampedLeft,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleEsc);
    }, 10);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const effectiveProfilePicture = profilePictureUrl || userInfo?.profilePictureUrl || "";
  const effectiveCoverPicture = userInfo?.coverPictureUrl || "";
  const coverUserKey = userInfo?.id ?? userInfo?.email ?? userInfo?.usuario ?? null;
  const coverPositionY = getCoverPositionY(coverUserKey);
  const coverZoom = getCoverZoom(coverUserKey);

  useEffect(() => {
    const onCoverPositionChange = (event: Event) => {
      const custom = event as CustomEvent<{ userKey?: string; positionY?: number; zoom?: number }>;
      if (!custom.detail?.userKey || coverUserKey == null) return;
      if (custom.detail.userKey !== coverUserKey) return;
      const next = Number(custom.detail.positionY);
      const nextZoom = Number(custom.detail.zoom);
      if (!Number.isFinite(next) && !Number.isFinite(nextZoom)) return;
      refreshCoverState();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || coverUserKey == null) return;
      const expectedKey = `${COVER_POSITION_KEY_PREFIX}:${coverUserKey}`;
      const expectedZoomKey = `${COVER_ZOOM_KEY_PREFIX}:${coverUserKey}`;
      if (event.key !== expectedKey && event.key !== expectedZoomKey) return;
      refreshCoverState();
    };

    window.addEventListener(COVER_POSITION_EVENT, onCoverPositionChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(COVER_POSITION_EVENT, onCoverPositionChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [coverUserKey]);

  const popupStyle = isCompactViewport
    ? { left: 16, bottom: 90 }
    : { bottom: position.bottom, left: position.left };

  return (
    <AnimatePresence>
      <m.div
        ref={popupRef}
        className={popupClass}
        style={popupStyle}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div
          className="h-[68px] bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.92),rgba(var(--primary-rgb),0.58))]"
          style={
            effectiveCoverPicture
              ? {
                  backgroundImage: `linear-gradient(rgba(17,20,27,0.12), rgba(17,20,27,0.36)), url(${effectiveCoverPicture})`,
                  backgroundSize: `${coverZoom}%`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: `center ${coverPositionY}%`,
                }
              : undefined
          }
        />

        <div className="-mt-8 flex items-end gap-3 px-4">
          <div className="relative">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-slate-900 bg-primary text-2xl font-black text-white">
              {effectiveProfilePicture ? (
                <img src={effectiveProfilePicture} alt={name} className="size-full object-cover" />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="absolute bottom-1 right-0 size-4 rounded-full border-[3px] border-slate-900 bg-emerald-500" />
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="text-lg font-black tracking-[-0.02em] text-white">{name}</div>
          <div className="mt-1 text-sm text-white/50">@{userInfo?.usuario ?? "..."}</div>

          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
              roleBadgeClass(role),
            )}
          >
            <RoleIcon role={role} />
            {roleLabel(role)}
          </span>

          <div className="my-3 h-px bg-white/8" />

          <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-3">
            <div className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
              Membro desde
            </div>
            <div className="text-sm font-medium text-white/90">
              {userInfo?.createdAt
                ? new Date(userInfo.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "..."}
            </div>
          </div>

          <div className="my-3 h-px bg-white/8" />

          <div className="flex flex-col gap-2">
            <button className={actionButtonClass} onClick={onOpenSettings}>
              <Settings size={16} />
              <span>Configurações</span>
            </button>
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
