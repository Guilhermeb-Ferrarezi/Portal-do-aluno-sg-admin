import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, User, Shield } from "lucide-react";
import { obterUsuarioAtual, type UserMe } from "../services/api";
import "./ProfilePopup.css";

type ProfilePopupProps = {
  name: string;
  role: string | null;
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
  anchorRef,
  onClose,
  onOpenSettings,
}: ProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [userInfo, setUserInfo] = useState<UserMe | null>(null);
  const [position, setPosition] = useState({ bottom: 0, left: 0 });

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

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={popupRef}
        className="profilePopup"
        style={{ bottom: position.bottom, left: position.left }}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Banner */}
        <div className="ppBanner" />

        {/* Avatar */}
        <div className="ppAvatarWrap">
          <div className="ppAvatar">{name.slice(0, 1).toUpperCase()}</div>
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
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
