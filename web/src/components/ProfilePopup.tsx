import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { Settings, User, Shield } from "lucide-react";
import { obterUsuarioAtual, type UserMe } from "../services/api";
import { COVER_POSITION_EVENT, COVER_POSITION_KEY_PREFIX, COVER_ZOOM_KEY_PREFIX, getCoverPositionY, getCoverZoom } from "../utils/coverPosition";
import "./ProfilePopup.css";

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

function roleBadgeColor(role: string | null) {
  if (role === "admin") return "#e11d2e";
  if (role === "professor") return "#3b82f6";
  return "#10b981";
}

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
  const [position, setPosition] = useState({ bottom: 0, left: 0 });
  const [coverStateVersion, refreshCoverState] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    obterUsuarioAtual().then(setUserInfo).catch(console.error);
  }, []);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left + 8,
      });
    }
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
    // Delay adding listener to avoid immediate close from the triggering click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleEsc);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const color = roleBadgeColor(role);
  const effectiveProfilePicture = profilePictureUrl || userInfo?.profilePictureUrl || "";
  const effectiveCoverPicture = userInfo?.coverPictureUrl || "";
  const coverUserKey = userInfo?.id ?? userInfo?.email ?? userInfo?.usuario ?? null;
  const coverState = useMemo(
    () => ({
      positionY: getCoverPositionY(coverUserKey),
      zoom: getCoverZoom(coverUserKey),
    }),
    [coverUserKey, coverStateVersion]
  );
  const coverPositionY = coverState.positionY;
  const coverZoom = coverState.zoom;

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

  return createPortal(
    <AnimatePresence>
      <m.div
        ref={popupRef}
        className="profilePopup"
        style={{ bottom: position.bottom, left: position.left }}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Banner */}
        <div
          className="ppBanner"
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

        {/* Avatar */}
        <div className="ppAvatarWrap">
          <div className="ppAvatar">
            {effectiveProfilePicture ? (
              <img src={effectiveProfilePicture} alt={name} className="ppAvatarImg" />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="ppStatusDot" />
        </div>

        {/* Body */}
        <div className="ppBody">
          <div className="ppDisplayName">{name}</div>
          <div className="ppUsername">
            @{userInfo?.usuario ?? "..."}
          </div>
          <span
            className="ppRoleBadge"
            style={{ background: `${color}22`, color }}
          >
            {role === "admin" ? (
              <><Shield size={12} style={{ marginRight: 4 }} />{roleLabel(role)}</>
            ) : role === "professor" ? (
              <><User size={12} style={{ marginRight: 4 }} />{roleLabel(role)}</>
            ) : (
              roleLabel(role)
            )}
          </span>

          <div className="ppDivider" />

          {/* Info */}
          <div className="ppInfoSection">
            <div className="ppInfoLabel">Membro desde</div>
            <div className="ppInfoValue">
              {userInfo?.createdAt
                ? new Date(userInfo.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "..."}
            </div>
          </div>

          <div className="ppDivider" />

          {/* Actions */}
          <div className="ppActions">
            <button className="ppActionBtn" onClick={onOpenSettings}>
              <Settings size={16} />
              <span>Configurações</span>
            </button>
          </div>
        </div>
      </m.div>
    </AnimatePresence>,
    document.body
  );
}
