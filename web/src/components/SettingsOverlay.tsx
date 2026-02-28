import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { getRole } from "../auth/auth";
import {
  alterarMinhaSenha,
  atualizarMeuPerfil,
  obterUsuarioAtual,
  listarTurmas,
  todasMinhasSubmissoes,
  uploadMinhaFotoPerfil,
  uploadMeuBannerPerfil,
  type Submissao,
  type UserMe,
  type Turma,
} from "../services/api";
import {
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
  AnimatedToggle,
} from "./animate-ui";
import ConfirmModal from "./ConfirmModal";
import { getCoverPositionY, getCoverZoom, setCoverPositionY, setCoverZoom } from "../utils/coverPosition";
import {
  Users,
  Flame,
  BookOpen,
  User as UserIcon,
  Laptop,
  Monitor,
  CheckCircle,
  XCircle,
  Circle,
  Loader2,
  Shield,
  Settings,
  BarChart3,
  Palette,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  Eye,
  Camera,
  FolderOpen,
  Trash2,
  X,
} from "lucide-react";
import "../pages/Perfil.css";

type SettingsSection = "conta" | "seguranca" | "configuracoes" | "aparencia" | "desempenho" | "turmas";

type UserStats = {
  exerciciosFeitos: number;
  notaMedia: number | null;
  turmasInscritas: number;
  diasSequencia: number;
};

type ProfileSettings = {
  emailNotificacoes: boolean;
  pushNotificacoes: boolean;
  perfilPublico: boolean;
  modoCompacto: boolean;
  temaPreferido: "sistema" | "claro" | "escuro";
  corPreferida: string;
};

const SETTINGS_KEY = "perfil_settings";

const iconLabel = (icon: React.ReactNode, label: string) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    {icon}
    <span>{label}</span>
  </span>
);

const defaultSettings: ProfileSettings = {
  emailNotificacoes: true,
  pushNotificacoes: true,
  perfilPublico: false,
  modoCompacto: false,
  temaPreferido: "sistema",
  corPreferida: "#e11d2e",
};

function normalizeHexColor(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return "#e11d2e";
}

function loadSettings(): ProfileSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      corPreferida: normalizeHexColor(parsed.corPreferida),
    };
  } catch {
    return defaultSettings;
  }
}

function roleLabelText(role: string | null | undefined) {
  if (role === "admin") return "Administrador";
  if (role === "professor") return "Professor";
  return "Aluno";
}

function toDayStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function calcularSequencia(submissoes: Submissao[]) {
  const daySet = new Set<number>();
  for (const s of submissoes) {
    const stamp = toDayStamp(s.createdAt);
    if (stamp !== null) daySet.add(stamp);
  }
  if (daySet.size === 0) return 0;
  const diasOrdenados = Array.from(daySet).sort((a, b) => a - b);
  let streak = 1;
  let cursor = diasOrdenados[diasOrdenados.length - 1];
  const oneDay = 24 * 60 * 60 * 1000;
  while (daySet.has(cursor - oneDay)) {
    cursor -= oneDay;
    streak += 1;
  }
  return streak;
}

function calcularStats(submissoes: Submissao[], turmasInscritas: number): UserStats {
  const exercicios = new Set(submissoes.map((s) => s.exercicioId));
  const notas = submissoes
    .map((s) => s.nota)
    .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  const notaMedia = notas.length ? notas.reduce((acc, n) => acc + n, 0) / notas.length : null;
  const diasSequencia = calcularSequencia(submissoes);
  return {
    exerciciosFeitos: exercicios.size,
    notaMedia,
    turmasInscritas,
    diasSequencia,
  };
}

const NAV_ITEMS: { key: SettingsSection; label: string; icon: React.ReactNode; group: string }[] = [
  { key: "conta", label: "Minha Conta", icon: <UserIcon size={16} />, group: "CONTA" },
  { key: "seguranca", label: "Segurança", icon: <Shield size={16} />, group: "CONTA" },
  { key: "configuracoes", label: "Preferências", icon: <Settings size={16} />, group: "CONFIG. DO APLICATIVO" },
  { key: "aparencia", label: "Aparência", icon: <Palette size={16} />, group: "CONFIG. DO APLICATIVO" },
  { key: "desempenho", label: "Desempenho", icon: <BarChart3 size={16} />, group: "ATIVIDADE" },
  { key: "turmas", label: "Turmas", icon: <Users size={16} />, group: "ATIVIDADE" },
];

type SettingsOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
};

export default function SettingsOverlay({ isOpen, onClose, onLogout }: SettingsOverlayProps) {
  const roleLocal = getRole();

  const [activeSection, setActiveSection] = React.useState<SettingsSection>("conta");
  const [mobileSection, setMobileSection] = React.useState<SettingsSection | null>(null);
  const [mobileQuery, setMobileQuery] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(false);
  const [modalSenha, setModalSenha] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState<UserMe | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [savingSenha, setSavingSenha] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [feedback, setFeedback] = React.useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [toastMsg, setToastMsg] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pictureLoadError, setPictureLoadError] = React.useState(false);
  const [coverLoadError, setCoverLoadError] = React.useState(false);
  const profilePictureFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const coverPictureFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const profileCameraVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const profileCameraCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [pictureMenuOpen, setPictureMenuOpen] = React.useState(false);
  const [pictureViewerOpen, setPictureViewerOpen] = React.useState(false);
  const [coverViewerOpen, setCoverViewerOpen] = React.useState(false);
  const [pendingCoverFile, setPendingCoverFile] = React.useState<File | null>(null);
  const [pendingCoverPreviewUrl, setPendingCoverPreviewUrl] = React.useState<string | null>(null);
  const [coverPositionY, setCoverPositionYState] = React.useState(50);
  const [coverDraftPositionY, setCoverDraftPositionY] = React.useState(50);
  const [coverZoom, setCoverZoomState] = React.useState(100);
  const [coverDraftZoom, setCoverDraftZoom] = React.useState(100);
  const [coverMinZoom, setCoverMinZoom] = React.useState(100);
  const coverEditorViewportRef = React.useRef<HTMLDivElement | null>(null);
  const coverPreviewBannerRef = React.useRef<HTMLDivElement | null>(null);
  const [coverAspectRatio, setCoverAspectRatio] = React.useState(16 / 9);
  const coverDragRef = React.useRef<{ startClientY: number; startPositionY: number; viewportHeight: number } | null>(null);
  const [pictureActionLoading, setPictureActionLoading] = React.useState(false);
  const [cameraModalOpen, setCameraModalOpen] = React.useState(false);
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [formData, setFormData] = React.useState({
    nome: "",
    usuario: "",
    bio: "",
    profilePictureUrl: "",
    coverPictureUrl: "",
  });
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [settings, setSettings] = React.useState<ProfileSettings>(() => loadSettings());
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [stats, setStats] = React.useState<UserStats>({
    exerciciosFeitos: 0,
    notaMedia: null,
    turmasInscritas: 0,
    diasSequencia: 0,
  });
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [statsError, setStatsError] = React.useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);

  async function buildCroppedCoverFile(
    file: File,
    zoomPercent: number,
    positionYPercent: number,
    viewportRatio: number
  ) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Nao foi possivel carregar a imagem do banner."));
      };
      image.src = url;
    });

    // Usa a mesma proporcao da area visivel no editor para o resultado ser identico ao preview.
    const safeRatio = Number.isFinite(viewportRatio) && viewportRatio > 0 ? viewportRatio : 16 / 9;
    const canvasWidth = 2000;
    const canvasHeight = Math.max(1, Math.round(canvasWidth / safeRatio));
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Nao foi possivel preparar o recorte do banner.");
    }

    const scale = Math.max(1, zoomPercent / 100);
    const drawWidth = canvasWidth * scale;
    const drawHeight = drawWidth * (img.naturalHeight / img.naturalWidth);
    const x = (canvasWidth - drawWidth) * 0.5;
    const y = (canvasHeight - drawHeight) * (positionYPercent / 100);
    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      throw new Error("Nao foi possivel gerar o recorte do banner.");
    }

    return new File([blob], `banner-crop-${Date.now()}.jpg`, { type: "image/jpeg" });
  }

  const role = userInfo?.role ?? roleLocal;
  const coverUserKey = userInfo?.id ?? userInfo?.email ?? userInfo?.usuario ?? formData.usuario ?? "me";
  const mobileTitle = mobileSection
    ? NAV_ITEMS.find((item) => item.key === mobileSection)?.label || "Configurações"
    : "Configurações";
  const logoutAction = () => setLogoutConfirmOpen(true);
  const refreshCoverAspectRatio = React.useCallback(() => {
    const rect = coverPreviewBannerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nextRatio = rect.width / rect.height;
    if (!Number.isFinite(nextRatio) || nextRatio <= 0) return;
    setCoverAspectRatio(nextRatio);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true);
        setErro(null);
        setStatsLoading(true);
        setStatsError(null);
        const data = await obterUsuarioAtual();
        setUserInfo(data);
        setFormData({
          nome: data.nome ?? "",
          usuario: data.usuario ?? data.email ?? "",
          bio: data.bio ?? "",
          profilePictureUrl: data.profilePictureUrl ?? "",
          coverPictureUrl: data.coverPictureUrl ?? "",
        });
        setPictureLoadError(false);
        setCoverLoadError(false);
        setPictureMenuOpen(false);
        setPictureViewerOpen(false);
        setCoverViewerOpen(false);
        setPendingCoverFile(null);
        setPendingCoverPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setCoverPositionYState(getCoverPositionY(data.id ?? data.email ?? data.usuario ?? "me"));
        setCoverZoomState(getCoverZoom(data.id ?? data.email ?? data.usuario ?? "me"));
        localStorage.setItem("nome", data.nome ?? "");

        try {
          const todasTurmas = await listarTurmas();
          let turmasUsuario = todasTurmas;
          if (data.role === "aluno") {
            turmasUsuario = todasTurmas;
          } else {
            turmasUsuario = todasTurmas;
          }
          setTurmas(turmasUsuario);
          const submissoes = await todasMinhasSubmissoes();
          setStats(calcularStats(submissoes, turmasUsuario.length));
        } catch (e) {
          console.error("Erro ao carregar turmas:", e);
          setStatsError("Erro ao carregar estatísticas.");
        }
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar usuário");
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    })();
  }, [isOpen]);

  React.useEffect(() => {
    if (profileCameraVideoRef.current && cameraStream) {
      profileCameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraModalOpen]);

  React.useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  React.useEffect(() => {
    return () => {
      if (pendingCoverPreviewUrl) {
        URL.revokeObjectURL(pendingCoverPreviewUrl);
      }
    };
  }, [pendingCoverPreviewUrl]);

  React.useEffect(() => {
    if (isOpen) return;
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
    setPictureMenuOpen(false);
    setPictureViewerOpen(false);
    setCoverViewerOpen(false);
    setPendingCoverFile(null);
    if (pendingCoverPreviewUrl) URL.revokeObjectURL(pendingCoverPreviewUrl);
    setPendingCoverPreviewUrl(null);
  }, [isOpen, cameraStream, pendingCoverPreviewUrl]);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    if (isMobile) {
      setMobileSection(null);
      setMobileQuery("");
    } else {
      setMobileSection(null);
    }
  }, [isOpen, isMobile]);

  React.useEffect(() => {
    if (!isOpen || activeSection !== "conta") return;
    refreshCoverAspectRatio();
    const target = coverPreviewBannerRef.current;
    if (!target) return;

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => refreshCoverAspectRatio());
      observer.observe(target);
      return () => observer.disconnect();
    }

    const onResize = () => refreshCoverAspectRatio();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, activeSection, refreshCoverAspectRatio]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modalSenha && !logoutConfirmOpen) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, modalSenha, logoutConfirmOpen, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  const handleChangeSenha = async () => {
    if (!senhaAtual?.trim()) { setFeedback({ type: "error", message: "Preencha a senha atual." }); return; }
    if (!novaSenha?.trim()) { setFeedback({ type: "error", message: "Preencha a nova senha." }); return; }
    if (!confirmarSenha?.trim()) { setFeedback({ type: "error", message: "Preencha a confirmação da senha." }); return; }
    if (novaSenha.trim().length < 6) { setFeedback({ type: "error", message: "A nova senha deve ter ao menos 6 caracteres." }); return; }
    if (novaSenha.trim() !== confirmarSenha.trim()) { setFeedback({ type: "error", message: "As senhas não coincidem." }); return; }

    setSavingSenha(true);
    setFeedback(null);
    try {
      const result = await alterarMinhaSenha({ senhaAtual: senhaAtual.trim(), novaSenha: novaSenha.trim() });
      closeSenhaModal();
      setFeedback({ type: "success", message: result.message || "Senha alterada com sucesso!" });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erro ao alterar senha" });
    } finally {
      setSavingSenha(false);
    }
  };

  const closeSenhaModal = () => {
    setModalSenha(false);
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
  };

  const applyUserProfileUpdate = (updatedUser: UserMe) => {
    setUserInfo(updatedUser);
    setFormData((prev) => ({
      ...prev,
      nome: updatedUser.nome ?? prev.nome,
      usuario: updatedUser.usuario ?? updatedUser.email ?? prev.usuario,
      bio: updatedUser.bio ?? "",
      profilePictureUrl: updatedUser.profilePictureUrl ?? "",
      coverPictureUrl: updatedUser.coverPictureUrl ?? "",
    }));
    localStorage.setItem("nome", updatedUser.nome ?? "");
    setPictureLoadError(false);
    setCoverLoadError(false);
  };

  const handleSaveProfile = async () => {
    setSavingSettings(true);
    setFeedback(null);
    try {
      const result = await atualizarMeuPerfil({
        nome: formData.nome.trim(),
        bio: formData.bio,
      });
      applyUserProfileUpdate(result.user);
      setFeedback({
        type: "success",
        message: result.message || "Perfil atualizado com sucesso!",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao salvar perfil",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChoosePictureClick = () => {
    setPictureMenuOpen(false);
    profilePictureFileInputRef.current?.click();
  };

  const handleChooseCoverClick = () => {
    coverPictureFileInputRef.current?.click();
  };

  const handleOpenCover = () => {
    if (!currentCoverSrc) {
      handleChooseCoverClick();
      return;
    }
    refreshCoverAspectRatio();
    setCoverDraftPositionY(coverPositionY);
    setCoverDraftZoom(Math.max(coverZoom, coverMinZoom));
    setCoverViewerOpen(true);
  };

  const handleCloseCoverEditor = () => {
    setCoverViewerOpen(false);
    setPendingCoverFile(null);
    if (pendingCoverPreviewUrl) URL.revokeObjectURL(pendingCoverPreviewUrl);
    setPendingCoverPreviewUrl(null);
  };

  const handleApplyCoverPosition = async () => {
    setPictureActionLoading(true);
    setFeedback(null);
    try {
      if (pendingCoverFile) {
        const viewportRect = coverEditorViewportRef.current?.getBoundingClientRect();
        const viewportRatio =
          viewportRect && viewportRect.height > 0
            ? viewportRect.width / viewportRect.height
            : coverAspectRatio;
        const croppedFile = await buildCroppedCoverFile(
          pendingCoverFile,
          coverDraftZoom,
          coverDraftPositionY,
          viewportRatio
        );
        const result = await uploadMeuBannerPerfil(croppedFile);
        const refreshedUser = await obterUsuarioAtual();
        if (!refreshedUser?.coverPictureUrl) {
          throw new Error("Upload concluido, mas o banner nao foi confirmado no perfil.");
        }
        applyUserProfileUpdate(refreshedUser);
        const saved = setCoverPositionY(coverUserKey, 50);
        const savedZoom = setCoverZoom(coverUserKey, 100);
        setCoverPositionYState(saved);
        setCoverZoomState(savedZoom);
        setFeedback({
          type: "success",
          message: result.message || "Banner recortado e atualizado com sucesso!",
        });
      } else {
        const saved = setCoverPositionY(coverUserKey, coverDraftPositionY);
        const savedZoom = setCoverZoom(coverUserKey, coverDraftZoom);
        setCoverPositionYState(saved);
        setCoverZoomState(savedZoom);
      }
      handleCloseCoverEditor();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao atualizar banner",
      });
    } finally {
      setPictureActionLoading(false);
    }
  };

  const handleResetCoverPosition = () => {
    setCoverDraftPositionY(50);
    setCoverDraftZoom(coverMinZoom);
  };

  const handleCoverDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!coverEditorViewportRef.current) return;
    const rect = coverEditorViewportRef.current.getBoundingClientRect();
    if (!rect.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    coverDragRef.current = {
      startClientY: event.clientY,
      startPositionY: coverDraftPositionY,
      viewportHeight: rect.height,
    };
  };

  const handleCoverDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!coverDragRef.current) return;
    const deltaY = event.clientY - coverDragRef.current.startClientY;
    const deltaPct = (deltaY / coverDragRef.current.viewportHeight) * 100;
    const next = Math.max(0, Math.min(100, coverDragRef.current.startPositionY + deltaPct));
    setCoverDraftPositionY(Math.round(next));
  };

  const handleCoverDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    coverDragRef.current = null;
  };

  const handlePictureSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", message: "Selecione um arquivo de imagem válido." });
      return;
    }

    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({ type: "error", message: "A imagem deve ter no máximo 3MB." });
      return;
    }

    event.target.value = "";
    setPictureActionLoading(true);
    try {
      const result = await uploadMinhaFotoPerfil(file);
      applyUserProfileUpdate(result.user);
      setPictureMenuOpen(false);
      setFeedback({
        type: "success",
        message: result.message || "Foto atualizada com sucesso!",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao atualizar foto",
      });
    } finally {
      setPictureActionLoading(false);
    }
  };

  const handleTakePictureClick = () => {
    setPictureMenuOpen(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedback({ type: "error", message: "Câmera não suportada neste navegador." });
      return;
    }
    setCameraModalOpen(true);
    setCameraLoading(true);
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })
      .then((stream) => {
        setCameraStream(stream);
      })
      .catch(() => {
        setCameraModalOpen(false);
        setFeedback({
          type: "error",
          message: "Não foi possível acessar a câmera. Verifique a permissão no navegador.",
        });
      })
      .finally(() => {
        setCameraLoading(false);
      });
  };

  const closeCameraModal = () => {
    setCameraModalOpen(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  const handleCaptureFromCamera = async () => {
    const video = profileCameraVideoRef.current;
    const canvas = profileCameraCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setFeedback({ type: "error", message: "A câmera ainda não está pronta." });
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setFeedback({ type: "error", message: "Falha ao processar imagem da câmera." });
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      setFeedback({ type: "error", message: "Não foi possível capturar a foto." });
      return;
    }

    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPictureActionLoading(true);
    try {
      const result = await uploadMinhaFotoPerfil(file);
      applyUserProfileUpdate(result.user);
      closeCameraModal();
      setFeedback({
        type: "success",
        message: result.message || "Foto atualizada com sucesso!",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao atualizar foto",
      });
    } finally {
      setPictureActionLoading(false);
    }
  };

  const handleRemovePicture = async () => {
    setPictureActionLoading(true);
    try {
      const result = await atualizarMeuPerfil({ profilePictureUrl: "" });
      applyUserProfileUpdate(result.user);
      setPictureMenuOpen(false);
      setFeedback({
        type: "success",
        message: result.message || "Foto removida com sucesso!",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao remover foto",
      });
    } finally {
      setPictureActionLoading(false);
    }
  };

  const handleCoverSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", message: "Selecione um arquivo de imagem válido para o banner." });
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({ type: "error", message: "O banner deve ter no máximo 5MB." });
      return;
    }

    if (pendingCoverPreviewUrl) URL.revokeObjectURL(pendingCoverPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setPendingCoverFile(file);
    setPendingCoverPreviewUrl(previewUrl);
    setCoverDraftPositionY(50);
    setCoverDraftZoom(100);
    refreshCoverAspectRatio();
    setCoverViewerOpen(true);
    event.target.value = "";
  };

  const handleRemoveCover = async () => {
    setPictureActionLoading(true);
    try {
      const result = await atualizarMeuPerfil({ coverPictureUrl: "" });
      applyUserProfileUpdate(result.user);
      const saved = setCoverPositionY(coverUserKey, 50);
      const savedZoom = setCoverZoom(coverUserKey, 100);
      setCoverPositionYState(saved);
      setCoverZoomState(savedZoom);
      handleCloseCoverEditor();
      setFeedback({
        type: "success",
        message: result.message || "Banner removido com sucesso!",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao remover banner",
      });
    } finally {
      setPictureActionLoading(false);
    }
  };

  const handleSaveSettings = () => {
    try {
      setSavingSettings(true);
      const normalizedSettings = {
        ...settings,
        corPreferida: normalizeHexColor(settings.corPreferida),
      };
      setSettings(normalizedSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizedSettings));
      window.dispatchEvent(new CustomEvent('perfil-settings-changed', { detail: normalizedSettings }));
      setFeedback({ type: "success", message: "Configurações salvas com sucesso!" });
    } catch {
      setFeedback({ type: "error", message: "Não foi possível salvar as configurações." });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    setSettings(defaultSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    window.dispatchEvent(new CustomEvent('perfil-settings-changed', { detail: defaultSettings }));
    setFeedback({ type: "success", message: "Configurações restauradas." });
  };

  // Group nav items
  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    setMobileSection(section);
  };

  const filteredGroups = Object.entries(groups)
    .map(([group, items]) => {
      const filtered = items.filter((item) =>
        item.label.toLowerCase().includes(mobileQuery.trim().toLowerCase())
      );
      return [group, filtered] as const;
    })
    .filter(([, items]) => items.length > 0);

  const currentPictureSrc = !pictureLoadError
    ? (formData.profilePictureUrl || userInfo?.profilePictureUrl || "")
    : "";
  const currentCoverSrc = !coverLoadError
    ? (formData.coverPictureUrl || userInfo?.coverPictureUrl || "")
    : "";
  const editorCoverSrc = pendingCoverPreviewUrl || currentCoverSrc;
  const coverZoomMax = Math.max(220, Math.ceil(coverMinZoom) + 180);
  const profileInitial = (formData.nome || formData.usuario || "?").trim().charAt(0).toUpperCase();

  React.useEffect(() => {
    if (!coverViewerOpen || !editorCoverSrc) {
      setCoverMinZoom(100);
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const imageRatio = image.naturalHeight / image.naturalWidth;
      const viewportRect = coverEditorViewportRef.current?.getBoundingClientRect();
      const viewportRatio =
        viewportRect && viewportRect.width > 0 && viewportRect.height > 0
          ? viewportRect.height / viewportRect.width
          : (coverAspectRatio > 0 ? 1 / coverAspectRatio : 9 / 16);
      const safeViewportRatio = Number.isFinite(viewportRatio) && viewportRatio > 0 ? viewportRatio : 9 / 16;
      const computedMin = Math.max(100, Math.ceil((safeViewportRatio / imageRatio) * 100));
      setCoverMinZoom(computedMin);
      setCoverDraftZoom((prev) => Math.max(prev, computedMin));
    };
    image.onerror = () => {
      if (!active) return;
      setCoverMinZoom(100);
    };
    image.src = editorCoverSrc;
    return () => {
      active = false;
    };
  }, [coverViewerOpen, editorCoverSrc, coverAspectRatio]);

  const buildDismissOverlayClickHandler =
    (onDismiss: () => void) => (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      onDismiss();
    };

  const buildDismissOverlayKeyDownHandler =
    (onDismiss: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onDismiss();
    };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <m.div
          className="settingsOverlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <m.div
            className="settingsPanel"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Close button */}
            <button className="settingsCloseBtn" onClick={onClose} aria-label="Fechar configurações">
              <X size={20} />
              <span className="settingsCloseHint">ESC</span>
            </button>

            <div className="settingsMobileHeader">
              {mobileSection ? (
                <button
                  className="settingsBackBtn"
                  onClick={() => setMobileSection(null)}
                  aria-label="Voltar"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <span className="settingsBackSpacer" />
              )}
              <h2 className="settingsMobileTitle">{mobileTitle}</h2>
              <span className="settingsBackSpacer" />
            </div>

            <AnimatedToast
              message={toastMsg?.msg || null}
              type={toastMsg?.type || 'success'}
              duration={3000}
              onClose={() => setToastMsg(null)}
            />

            {loading ? (
              <div style={{ display: "grid", placeItems: "center", padding: 48, color: "var(--muted)" }}>
                Carregando...
              </div>
            ) : erro ? (
              <div style={{ display: "grid", placeItems: "center", padding: 48, color: "var(--red)" }}>
                Erro ao carregar: {erro}
              </div>
            ) : (
              <div
                className="settingsLayout"
                data-mobile-view={mobileSection ? "section" : "list"}
              >
                {/* LEFT NAV */}
                <nav className="settingsNav">
                  {Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="settingsNavGroup">
                      <div className="settingsNavLabel">{group}</div>
                      {items.map((item) => (
                        <button
                          key={item.key}
                          className={`settingsNavItem ${activeSection === item.key ? "active" : ""}`}
                          onClick={() => handleSectionChange(item.key)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="settingsNavGroup">
                    <div className="settingsNavLabel">CONTA</div>
                    <button
                      className="settingsNavItem settingsNavLogout"
                      type="button"
                      onClick={logoutAction}
                    >
                      <LogOut size={16} />
                      <span>Sair</span>
                    </button>
                  </div>
                </nav>

                <div className="settingsMobileList">
                  <div className="settingsMobileSearch">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Buscar"
                      value={mobileQuery}
                      onChange={(e) => setMobileQuery(e.target.value)}
                      aria-label="Buscar configurações"
                    />
                  </div>
                  {filteredGroups.map(([group, items]) => (
                    <div key={group} className="settingsMobileGroup">
                      <div className="settingsMobileGroupTitle">{group}</div>
                      <div className="settingsMobileCard">
                        {items.map((item) => (
                          <button
                            key={item.key}
                            className="settingsMobileItem"
                            onClick={() => handleSectionChange(item.key)}
                          >
                            <span className="settingsMobileItemIcon">{item.icon}</span>
                            <span className="settingsMobileItemLabel">{item.label}</span>
                            <span className="settingsMobileItemChevron">
                              <ChevronRight size={18} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="settingsMobileGroup">
                    <div className="settingsMobileGroupTitle">CONTA</div>
                    <div className="settingsMobileCard">
                      <button className="settingsMobileItem settingsMobileLogout" onClick={logoutAction}>
                        <span className="settingsMobileItemIcon"><LogOut size={16} /></span>
                        <span className="settingsMobileItemLabel">Sair</span>
                        <span className="settingsMobileItemChevron">
                          <ChevronRight size={18} />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT CONTENT */}
                <div className="settingsContent">
                  {feedback && (
                    <div className={`perfilMessage ${feedback.type}`} style={{ marginBottom: 16 }}>
                      <span>{feedback.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}</span>
                      <span>{feedback.message}</span>
                    </div>
                  )}

                  {/* MINHA CONTA */}
                  {activeSection === "conta" && (
                    <>
                      <h2 className="settingsSectionTitle">Minha Conta</h2>
                      <div className="profilePreviewCard">
                        <div className="profileHero">
                          <input
                            ref={coverPictureFileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleCoverSelected}
                          />
                          <div
                            ref={coverPreviewBannerRef}
                            className="profilePreviewBanner profilePreviewBannerBtn"
                            onClick={(event) => {
                              const target = event.target as HTMLElement | null;
                              if (target?.closest(".profileBannerMenu")) return;
                              handleOpenCover();
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleOpenCover();
                              }
                            }}
                            title={currentCoverSrc ? "Ver banner" : "Banner padrão"}
                            style={
                              currentCoverSrc
                                ? {
                                    backgroundImage: `linear-gradient(rgba(17,20,27,0.15), rgba(17,20,27,0.4)), url(${currentCoverSrc})`,
                                    backgroundSize: `${coverZoom}%`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: `center ${coverPositionY}%`,
                                  }
                                : undefined
                            }
                          >
                            <div className="profileBannerHoverOverlay">
                              <div className="profileBannerMenuTrigger">
                                <Camera size={14} />
                                <span>Mudar banner</span>
                              </div>
                              <div className="profileBannerMenu" role="menu" aria-label="Ações do banner">
                                <button
                                  type="button"
                                  className="profileBannerMenuItem"
                                  onClick={handleChooseCoverClick}
                                  disabled={pictureActionLoading}
                                >
                                  <FolderOpen size={14} />
                                  <span>Alterar</span>
                                </button>
                                <button
                                  type="button"
                                  className="profileBannerMenuItem danger"
                                  onClick={handleRemoveCover}
                                  disabled={pictureActionLoading || !currentCoverSrc}
                                >
                                  <Trash2 size={14} />
                                  <span>Remover</span>
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="profilePreviewAvatarWrap">
                            <input
                              ref={profilePictureFileInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={handlePictureSelected}
                            />
                            <button
                              type="button"
                              className="profilePreviewAvatar profilePreviewAvatarButton"
                              onClick={() => currentPictureSrc && setPictureViewerOpen(true)}
                              title="Ver foto de perfil"
                              aria-label="Ver foto de perfil"
                              disabled={pictureActionLoading}
                            >
                              {currentPictureSrc ? (
                                <img
                                  src={currentPictureSrc}
                                  alt="Foto de perfil"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    borderRadius: "999px",
                                  }}
                                  onError={() => {
                                    setPictureLoadError(true);
                                  }}
                                />
                              ) : (
                                <span aria-hidden="true">{profileInitial}</span>
                              )}
                            </button>
                            <button
                              type="button"
                              className="profileAvatarMenuBtn"
                              onClick={() => setPictureMenuOpen(true)}
                              title="Ações da foto"
                              aria-label="Ações da foto"
                              disabled={pictureActionLoading}
                            >
                              <Camera size={14} />
                            </button>
                            {pictureMenuOpen && (
                              <>
                                <button
                                  type="button"
                                  className="profilePhotoMenuBackdrop"
                                  onClick={() => setPictureMenuOpen(false)}
                                  aria-label="Fechar menu de foto"
                                />
                                <div className="profilePhotoMenu" role="menu" aria-label="Ações da foto">
                                  <button
                                    type="button"
                                    className="profilePhotoMenuItem"
                                    onClick={() => {
                                      setPictureMenuOpen(false);
                                      setPictureViewerOpen(true);
                                    }}
                                    disabled={!currentPictureSrc}
                                  >
                                    <Eye size={16} />
                                    <span>Mostrar foto</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="profilePhotoMenuItem"
                                    onClick={handleTakePictureClick}
                                    disabled={pictureActionLoading}
                                  >
                                    <Camera size={16} />
                                    <span>Tirar foto</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="profilePhotoMenuItem"
                                    onClick={handleChoosePictureClick}
                                    disabled={pictureActionLoading}
                                  >
                                    <FolderOpen size={16} />
                                    <span>Carregar foto</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="profilePhotoMenuItem danger"
                                    onClick={handleRemovePicture}
                                    disabled={pictureActionLoading || !currentPictureSrc}
                                  >
                                    <Trash2 size={16} />
                                    <span>Remover foto</span>
                                  </button>
                                </div>
                              </>
                            )}
                            <div className="profilePreviewStatus" />
                          </div>
                        </div>
                        <div className="profilePreviewFields">
                          <div className="profileField">
                            <div className="profileFieldLabel">Nome Exibido</div>
                            <div className="profileFieldValue">{formData.nome}</div>
                          </div>
                          <div className="profileFieldDivider" />
                          <div className="profileField">
                            <div className="profileFieldLabel">E-mail</div>
                            <div className="profileFieldValue">{formData.usuario}</div>
                          </div>
                          <div className="profileFieldDivider" />
                          <div className="profileField">
                            <div className="profileFieldLabel">Cargo</div>
                            <div className="profileFieldValue">{roleLabelText(role)}</div>
                          </div>
                        </div>
                        <div className="profileEditorArea">
                          <div className="formGroup">
                            <span className="formLabel">Bio</span>
                            <textarea
                              className="formInput"
                              rows={3}
                              value={formData.bio}
                              placeholder="Escreva uma breve descrição sobre você..."
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, bio: e.target.value }))
                              }
                            />
                          </div>
                          <div className="settingsActions">
                            <AnimatedButton
                              className="btnSalvar"
                              onClick={handleSaveProfile}
                              disabled={savingSettings}
                              loading={savingSettings}
                            >
                              {savingSettings ? "Salvando..." : "Salvar perfil"}
                            </AnimatedButton>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* SEGURANÇA */}
                  {activeSection === "seguranca" && (
                    <>
                      <h2 className="settingsSectionTitle">Segurança</h2>
                      <section className="perfilCard">
                        <div className="securityContent">
                          <div className="securityItem">
                            <div className="securityInfo">
                              <h3>Alterar Senha</h3>
                              <p>Mantenha sua conta segura com uma senha forte</p>
                            </div>
                            <AnimatedButton className="altBtn" onClick={() => setModalSenha(true)}>
                              Alterar
                            </AnimatedButton>
                          </div>
                        </div>
                      </section>
                    </>
                  )}

                  {/* CONFIGURAÇÕES (Notificações + Compacto) */}
                  {activeSection === "configuracoes" && (
                    <>
                      <h2 className="settingsSectionTitle">Configurações</h2>
                      <section className="perfilCard">
                        <div className="settingsGrid">
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Notificações por e-mail</h3>
                              <p>Receba alertas sobre novas atividades e avisos</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.emailNotificacoes}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, emailNotificacoes: checked }))}
                            />
                          </div>
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Notificações no app</h3>
                              <p>Mostre avisos dentro do portal quando houver novidades</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.pushNotificacoes}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, pushNotificacoes: checked }))}
                            />
                          </div>
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Modo compacto</h3>
                              <p>Reduza o espaçamento para ver mais conteúdo</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.modoCompacto}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, modoCompacto: checked }))}
                            />
                          </div>
                        </div>
                        <div className="settingsActions">
                          <AnimatedButton className="btnCancel" onClick={handleResetSettings}>
                            Restaurar padrões
                          </AnimatedButton>
                          <AnimatedButton
                            className="btnSalvar"
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            loading={savingSettings}
                          >
                            {savingSettings ? "Salvando..." : "Salvar configurações"}
                          </AnimatedButton>
                        </div>
                      </section>
                    </>
                  )}

                  {/* APARÊNCIA */}
                  {activeSection === "aparencia" && (
                    <>
                      <h2 className="settingsSectionTitle">Aparência</h2>
                      <section className="perfilCard">
                        <div className="settingsGrid">
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Tema</h3>
                              <p>Escolha como prefere visualizar o portal</p>
                            </div>
                            <AnimatedSelect
                              className="settingsSelect"
                              value={settings.temaPreferido}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  temaPreferido: e.target.value as ProfileSettings["temaPreferido"],
                                }))
                              }
                            >
                              <option value="sistema">Sistema</option>
                              <option value="claro">Claro</option>
                              <option value="escuro">Escuro</option>
                            </AnimatedSelect>
                          </div>
                          <div className="settingsItem">
                            <div className="settingsInfo">
                              <h3>Cor preferida</h3>
                              <p>Escolha a cor de destaque do portal</p>
                            </div>
                            <div className="settingsColorControl">
                              <input
                                type="color"
                                className="settingsColorInput"
                                value={settings.corPreferida}
                                onChange={(e) =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    corPreferida: normalizeHexColor(e.target.value),
                                  }))
                                }
                              />
                              <input
                                type="text"
                                className="settingsColorHex"
                                value={settings.corPreferida}
                                onChange={(e) =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    corPreferida: e.target.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    corPreferida: normalizeHexColor(e.target.value),
                                  }))
                                }
                                placeholder="#e11d2e"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="settingsActions">
                          <AnimatedButton className="btnCancel" onClick={handleResetSettings}>
                            Restaurar padrões
                          </AnimatedButton>
                          <AnimatedButton
                            className="btnSalvar"
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            loading={savingSettings}
                          >
                            {savingSettings ? "Salvando..." : "Salvar"}
                          </AnimatedButton>
                        </div>
                      </section>
                    </>
                  )}

                  {/* DESEMPENHO */}
                  {activeSection === "desempenho" && (
                    <>
                      <h2 className="settingsSectionTitle">Seu Desempenho</h2>
                      {statsLoading ? (
                        <div style={{ display: "grid", placeItems: "center", padding: 32, color: "var(--muted)" }}>
                          Carregando estatísticas...
                        </div>
                      ) : statsError ? (
                        <div style={{ display: "grid", placeItems: "center", padding: 32, color: "var(--red)" }}>
                          {statsError}
                        </div>
                      ) : (
                        <div className="statsGrid">
                          <div className="statCard">
                            <div className="statIcon"><CheckCircle size={18} /></div>
                            <div className="statInfo">
                              <div className="statValue">{stats.exerciciosFeitos}</div>
                              <div className="statLabel">Exercícios Feitos</div>
                            </div>
                          </div>
                          <div className="statCard">
                            <div className="statIcon">*</div>
                            <div className="statInfo">
                              <div className="statValue">
                                {stats.notaMedia === null ? "-" : `${stats.notaMedia.toFixed(1)}/10`}
                              </div>
                              <div className="statLabel">Nota Média</div>
                            </div>
                          </div>
                          <div className="statCard">
                            <div className="statIcon"><Users size={18} /></div>
                            <div className="statInfo">
                              <div className="statValue">{stats.turmasInscritas}</div>
                              <div className="statLabel">Turmas Inscritas</div>
                            </div>
                          </div>
                          <div className="statCard">
                            <div className="statIcon"><Flame size={18} /></div>
                            <div className="statInfo">
                              <div className="statValue">{stats.diasSequencia}</div>
                              <div className="statLabel">Dias de Sequência</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* TURMAS */}
                  {activeSection === "turmas" && (
                    <>
                      <h2 className="settingsSectionTitle">Turmas Inscritas</h2>
                      {turmas.length === 0 ? (
                        <div className="emptyState">
                          <div className="emptyIcon" style={{ display: "inline-flex" }}><BookOpen size={22} /></div>
                          <p>Você não está inscrito em nenhuma turma</p>
                        </div>
                      ) : (
                        <div className="turmasList">
                          {turmas.map((turma) => (
                            <div key={turma.id} className="turmaItem">
                              <div className="turmaIcon">{turma.tipo === "turma" ? <Users size={16} /> : <UserIcon size={16} />}</div>
                              <div className="turmaInfo">
                                <h3 className="turmaNome">{turma.nome}</h3>
                                <div className="turmaMeta">
                                  <span className="badge badgeCategoria">
                                    {turma.categoria === "programacao" ? iconLabel(<Laptop size={14} />, "Programação") : iconLabel(<Monitor size={14} />, "Informática")}
                                  </span>
                                  <span className="badge badgeTipo">
                                    {turma.tipo === "turma" ? "Grupo" : "Particular"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>
            )}
          </m.div>

          {/* MODAL DE ALTERAR SENHA */}
          {modalSenha && (
            <div
              className="modalOverlay"
              onClick={buildDismissOverlayClickHandler(closeSenhaModal)}
              onKeyDown={buildDismissOverlayKeyDownHandler(closeSenhaModal)}
              role="button"
              tabIndex={0}
              style={{ zIndex: 10002 }}
            >
              <div className="modalContent">
                <h3>Alterar Senha</h3>
                <div className="formGroup">
                  <span className="formLabel">Senha Atual</span>
                  <input type="password" placeholder="Digite sua senha atual" className="formInput" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" />
                </div>
                <div className="formGroup">
                  <span className="formLabel">Nova Senha</span>
                  <input type="password" placeholder="Digite sua nova senha" className="formInput" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
                  {novaSenha && novaSenha.length < 6 && <small className="formHint error">{iconLabel(<XCircle size={12} />, "Mínimo 6 caracteres")}</small>}
                  {novaSenha && novaSenha.length >= 6 && <small className="formHint success">{iconLabel(<CheckCircle size={12} />, "Senha forte")}</small>}
                </div>
                <div className="formGroup">
                  <span className="formLabel">Confirmar Nova Senha</span>
                  <input type="password" placeholder="Confirme sua nova senha" className="formInput" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
                  {confirmarSenha && novaSenha === confirmarSenha && <small className="formHint success">{iconLabel(<CheckCircle size={12} />, "Senhas coincidem")}</small>}
                  {confirmarSenha && novaSenha !== confirmarSenha && <small className="formHint error">{iconLabel(<XCircle size={12} />, "As senhas não coincidem")}</small>}
                </div>
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.05)", border: "1px solid var(--line)" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Requisitos:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    <div style={{ color: senhaAtual ? "#16a34a" : "var(--muted)" }}>{senhaAtual ? <CheckCircle size={14} /> : <Circle size={12} />} Senha atual preenchida</div>
                    <div style={{ color: novaSenha && novaSenha.length >= 6 ? "#16a34a" : "var(--muted)" }}>{novaSenha && novaSenha.length >= 6 ? <CheckCircle size={14} /> : <Circle size={12} />} Nova senha com 6+ caracteres</div>
                    <div style={{ color: confirmarSenha && novaSenha === confirmarSenha ? "#16a34a" : "var(--muted)" }}>{confirmarSenha && novaSenha === confirmarSenha ? <CheckCircle size={14} /> : <Circle size={12} />} Confirmação igual</div>
                  </div>
                </div>
                <div className="modalActions">
                  <AnimatedButton type="button" className="btnCancel" onClick={closeSenhaModal}>Cancelar</AnimatedButton>
                  <AnimatedButton type="button" className="btnConfirm" onClick={handleChangeSenha} disabled={savingSenha} loading={savingSenha}>
                    {savingSenha ? iconLabel(<Loader2 size={14} />, "Alterando...") : iconLabel(<CheckCircle size={14} />, "Alterar Senha")}
                  </AnimatedButton>
                </div>
              </div>
            </div>
          )}
          {pictureViewerOpen && currentPictureSrc && (
            <div
              className="profilePhotoViewerOverlay"
              onClick={buildDismissOverlayClickHandler(() => setPictureViewerOpen(false))}
              onKeyDown={buildDismissOverlayKeyDownHandler(() => setPictureViewerOpen(false))}
              role="button"
              tabIndex={0}
              style={{ zIndex: 10003 }}
            >
              <div className="profilePhotoViewerContent">
                <img src={currentPictureSrc} alt="Foto de perfil ampliada" />
                <AnimatedButton
                  className="btnCancel"
                  type="button"
                  onClick={() => setPictureViewerOpen(false)}
                >
                  Fechar
                </AnimatedButton>
              </div>
            </div>
          )}
          {coverViewerOpen && editorCoverSrc && (
            <div
              className="profilePhotoViewerOverlay"
              onClick={buildDismissOverlayClickHandler(handleCloseCoverEditor)}
              onKeyDown={buildDismissOverlayKeyDownHandler(handleCloseCoverEditor)}
              role="button"
              tabIndex={0}
              style={{ zIndex: 10003 }}
            >
              <div className="coverEditorModal">
                <div className="coverEditorHeader">
                  <h3>Editar banner</h3>
                  <button type="button" className="settingsCloseBtn" onClick={handleCloseCoverEditor} aria-label="Fechar editor de banner">
                    <X size={18} />
                  </button>
                </div>
                <div
                  ref={coverEditorViewportRef}
                  className="coverEditorViewport"
                  style={{ aspectRatio: coverAspectRatio }}
                  onPointerDown={handleCoverDragStart}
                  onPointerMove={handleCoverDragMove}
                  onPointerUp={handleCoverDragEnd}
                  onPointerCancel={handleCoverDragEnd}
                >
                  <div
                    className="coverEditorImage"
                    style={{
                      backgroundImage: `url(${editorCoverSrc})`,
                      backgroundSize: `${Math.max(coverDraftZoom, coverMinZoom)}%`,
                      backgroundPosition: `center ${coverDraftPositionY}%`,
                    }}
                  />
                  <div
                    className="coverEditorFrame"
                    aria-hidden="true"
                  />
                </div>
                <div className="coverEditorControls">
                  <input
                    type="range"
                    min={String(Math.ceil(coverMinZoom))}
                    max={String(coverZoomMax)}
                    value={coverDraftZoom}
                    onChange={(e) => setCoverDraftZoom(Math.max(Number(e.target.value), Math.ceil(coverMinZoom)))}
                  />
                  <span>{coverDraftZoom}%</span>
                </div>
                <div className="coverEditorActions">
                  <button type="button" className="coverEditorGhostBtn" onClick={handleResetCoverPosition}>
                    Redefinir
                  </button>
                  <AnimatedButton
                    type="button"
                    className="btnCancel"
                    onClick={handleCloseCoverEditor}
                  >
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    type="button"
                    className="btnSalvar"
                    onClick={() => void handleApplyCoverPosition()}
                    disabled={pictureActionLoading}
                  >
                    {pictureActionLoading ? "Aplicando..." : "Aplicar"}
                  </AnimatedButton>
                </div>
              </div>
            </div>
          )}
          {cameraModalOpen && (
            <div
              className="profilePhotoViewerOverlay"
              style={{ zIndex: 10004 }}
              onClick={buildDismissOverlayClickHandler(closeCameraModal)}
              onKeyDown={buildDismissOverlayKeyDownHandler(closeCameraModal)}
              role="button"
              tabIndex={0}
            >
              <div className="profileCameraModal">
                <div className="profileCameraPreview">
                  {cameraLoading && <div className="profileCameraLoading">Abrindo câmera...</div>}
                  <video ref={profileCameraVideoRef} autoPlay playsInline muted />
                  <canvas ref={profileCameraCanvasRef} style={{ display: "none" }} />
                </div>
                <div className="profileCameraActions">
                  <AnimatedButton
                    type="button"
                    className="btnCancel"
                    onClick={closeCameraModal}
                    disabled={pictureActionLoading}
                  >
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    type="button"
                    className="btnSalvar"
                    onClick={handleCaptureFromCamera}
                    disabled={pictureActionLoading || cameraLoading}
                    loading={pictureActionLoading}
                  >
                    Capturar
                  </AnimatedButton>
                </div>
              </div>
            </div>
          )}
          <ConfirmModal
            isOpen={logoutConfirmOpen}
            title="Sair da conta"
            message="Tem certeza que deseja sair?"
            confirmText="Sair"
            cancelText="Cancelar"
            danger
            overlayZIndex={10003}
            onCancel={() => setLogoutConfirmOpen(false)}
            onConfirm={() => {
              setLogoutConfirmOpen(false);
              onLogout();
            }}
          />
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}




