import React from "react";
import { env } from "@/env";
import { getRole } from "../auth/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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
import type { DesktopUpdateState } from "@/types/desktop";
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
  Download,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

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
const DEFAULT_DESKTOP_INSTALLER_URL =
  "https://cdn.portaldoaluno.santos-tech.com/desktop/painel/win/Painel%20-%20Portal%20Santos%20Tech%20Setup%20Latest.exe";

const iconLabel = (icon: React.ReactNode, label: string) => (
  <span className="inline-flex items-center gap-1.5">
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

function formatUpdateCheckedAt(value: string | null) {
  if (!value) return "Ainda nao verificado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda nao verificado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatUpdateBytes(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return null;

  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function getUpdateBadgeVariant(status: DesktopUpdateState["status"]) {
  if (status === "error") return "destructive";
  if (status === "available" || status === "downloaded") return "default";
  if (status === "checking" || status === "downloading") return "secondary";
  return "outline";
}

function getUpdateStatusLabel(status: DesktopUpdateState["status"]) {
  if (status === "checking") return "Verificando";
  if (status === "available") return "Disponivel";
  if (status === "up-to-date") return "Atualizado";
  if (status === "downloading") return "Baixando";
  if (status === "downloaded") return "Pronto";
  if (status === "error") return "Erro";
  return "Ocioso";
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
  const desktopBridge = typeof window !== "undefined" ? window.desktop : undefined;
  const isDesktopApp = Boolean(desktopBridge?.isElectron && desktopBridge.updates);
  const desktopInstallerUrl = env.desktopInstallerUrl || DEFAULT_DESKTOP_INSTALLER_URL;

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
  const [desktopUpdateState, setDesktopUpdateState] = React.useState<DesktopUpdateState | null>(null);
  const [desktopUpdateActionLoading, setDesktopUpdateActionLoading] = React.useState(false);
  const [desktopDownloadConfirmOpen, setDesktopDownloadConfirmOpen] = React.useState(false);
  const [desktopRestartConfirmOpen, setDesktopRestartConfirmOpen] = React.useState(false);
  const promptedUpdateVersionRef = React.useRef<string | null>(null);
  const dismissedUpdateVersionRef = React.useRef<string | null>(null);
  const promptedRestartVersionRef = React.useRef<string | null>(null);

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
  const desktopUpdateBusy =
    desktopUpdateActionLoading ||
    desktopUpdateState?.status === "checking" ||
    desktopUpdateState?.status === "downloading";
  const desktopUpdateProgressLabel =
    desktopUpdateState &&
    desktopUpdateState.transferredBytes !== null &&
    desktopUpdateState.totalBytes !== null
      ? `${formatUpdateBytes(desktopUpdateState.transferredBytes) ?? "--"} / ${formatUpdateBytes(
          desktopUpdateState.totalBytes
        ) ?? "--"}`
      : null;
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

  // Lock body scroll
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isDesktopApp || !desktopBridge?.updates) return;

    let active = true;
    void desktopBridge.updates
      .getState()
      .then((nextState) => {
        if (!active) return;
        setDesktopUpdateState(nextState);
      })
      .catch((error) => {
        if (!active) return;
        setDesktopUpdateState({
          status: "error",
          currentVersion: "desconhecida",
          version: null,
          percent: null,
          transferredBytes: null,
          totalBytes: null,
          bytesPerSecond: null,
          checkedAt: null,
          message: error instanceof Error ? error.message : "Nao foi possivel ler o estado de atualizacao.",
          source: null,
        });
      });

    const unsubscribe = desktopBridge.updates.subscribe((nextState) => {
      if (!active) return;
      setDesktopUpdateState(nextState);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [desktopBridge, isDesktopApp]);

  React.useEffect(() => {
    if (desktopUpdateState?.status !== "available") {
      setDesktopDownloadConfirmOpen(false);
    }

    if (desktopUpdateState?.status !== "downloaded") {
      setDesktopRestartConfirmOpen(false);
    }
  }, [desktopUpdateState?.status]);

  React.useEffect(() => {
    if (!desktopUpdateState?.version) return;

    if (desktopUpdateState.status === "available") {
      if (dismissedUpdateVersionRef.current === desktopUpdateState.version) return;
      if (promptedUpdateVersionRef.current === desktopUpdateState.version) return;

      promptedUpdateVersionRef.current = desktopUpdateState.version;
      setDesktopDownloadConfirmOpen(true);
      return;
    }

    if (desktopUpdateState.status === "downloaded") {
      if (promptedRestartVersionRef.current === desktopUpdateState.version) return;

      promptedRestartVersionRef.current = desktopUpdateState.version;
      setDesktopRestartConfirmOpen(true);
    }
  }, [desktopUpdateState]);

  const handleManualDesktopUpdateCheck = async () => {
    if (!desktopBridge?.updates) return;

    dismissedUpdateVersionRef.current = null;
    setDesktopUpdateActionLoading(true);
    setFeedback(null);
    try {
      const nextState = await desktopBridge.updates.check();
      setDesktopUpdateState(nextState);
      if (nextState.status === "up-to-date") {
        setFeedback({
          type: "success",
          message: nextState.message || "Voce ja esta na versao mais recente.",
        });
      }
      if (nextState.status === "error") {
        setFeedback({
          type: "error",
          message: nextState.message || "Nao foi possivel verificar atualizacoes.",
        });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel verificar atualizacoes.",
      });
    } finally {
      setDesktopUpdateActionLoading(false);
    }
  };

  const handleDismissDesktopDownloadPrompt = () => {
    dismissedUpdateVersionRef.current = desktopUpdateState?.version ?? dismissedUpdateVersionRef.current;
    setDesktopDownloadConfirmOpen(false);
  };

  const handleDesktopUpdateDownload = async () => {
    if (!desktopBridge?.updates) return;

    setDesktopUpdateActionLoading(true);
    setFeedback(null);
    try {
      const nextState = await desktopBridge.updates.download();
      setDesktopUpdateState(nextState);
      if (nextState.status === "error") {
        setFeedback({
          type: "error",
          message: nextState.message || "Nao foi possivel baixar a atualizacao.",
        });
      } else {
        setDesktopDownloadConfirmOpen(false);
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel baixar a atualizacao.",
      });
    } finally {
      setDesktopUpdateActionLoading(false);
    }
  };

  const handleDesktopQuitAndInstall = async () => {
    if (!desktopBridge?.updates) return;

    setDesktopUpdateActionLoading(true);
    setFeedback(null);
    try {
      const started = await desktopBridge.updates.quitAndInstall();
      if (!started) {
        setFeedback({
          type: "error",
          message: "A atualizacao ainda nao esta pronta para instalar.",
        });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel reiniciar para instalar.",
      });
    } finally {
      setDesktopUpdateActionLoading(false);
    }
  };

  const handleInstallDesktopApp = React.useCallback(() => {
    if (typeof document === "undefined") return;

    setFeedback(null);

    const link = document.createElement("a");
    link.href = desktopInstallerUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setFeedback({
      type: "success",
      message: "Download do instalador desktop iniciado.",
    });
  }, [desktopInstallerUrl]);

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
  const roleLabel = roleLabelText(role);
  const settingsCardClass = "rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-sm";
  const settingsItemClass =
    "flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 max-[900px]:flex-col max-[900px]:items-start";
  const settingsActionsClass = "mt-4 flex flex-wrap gap-3 max-[640px]:flex-col";
  const settingsTitleClass = "text-sm font-semibold text-foreground";
  const settingsTextClass = "text-sm leading-6 text-muted-foreground";
  const formLabelClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
  const formInputClass =
    "min-h-11 w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 placeholder:text-muted-foreground/70";
  const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
  const navItemClass = (active: boolean, danger = false) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
      active
        ? "bg-primary/10 text-primary"
        : danger
          ? "text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );
  const mobileItemClass = (danger = false) =>
    cn(
      "grid w-full grid-cols-[28px_minmax(0,1fr)_24px] items-center gap-3 px-4 py-3 text-left transition",
      danger
        ? "text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
        : "text-foreground hover:bg-muted/60"
    );
  const metaBadgeClass = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  const overlayButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
  const floatingIconButtonClass =
    "inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
  const dropdownContentClass =
    "w-52 min-w-52 rounded-2xl border border-border/70 bg-popover/95 p-1 shadow-xl shadow-black/20 backdrop-blur";
  const accountSummaryFields = [
    { label: "Nome exibido", value: formData.nome || "Nao informado" },
    { label: "E-mail", value: formData.usuario || "Nao informado" },
    { label: "Cargo", value: roleLabel },
  ];

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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="z-[10001] bg-black/72 backdrop-blur-md sm:p-6"
        className="z-[10002] h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-hidden border-none bg-background/95 p-0 shadow-2xl shadow-black/40 sm:h-[min(86vh,840px)] sm:max-h-[86vh] sm:w-[min(1100px,calc(100vw-3rem))] sm:rounded-[28px]"
        showCloseButton={false}
      >
            <DialogTitle className="sr-only">Configurações da conta</DialogTitle>
            {/* Close button */}
            <button
              className={cn(floatingIconButtonClass, "absolute right-5 top-5 z-20 hidden sm:inline-flex")}
              onClick={onClose}
              aria-label="Fechar configurações"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/90 px-4 py-4 sm:px-5 lg:hidden">
              {mobileSection ? (
                <button
                  className={floatingIconButtonClass}
                  onClick={() => setMobileSection(null)}
                  aria-label="Voltar"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <span className="size-10" aria-hidden="true" />
              )}
              <h2 className="text-base font-bold tracking-tight text-foreground">{mobileTitle}</h2>
              <button
                className={floatingIconButtonClass}
                onClick={onClose}
                aria-label="Fechar configurações"
              >
                <X size={18} />
              </button>
            </div>

            <AnimatedToast
              message={feedback?.message || null}
              type={feedback?.type || "success"}
              duration={3000}
              onClose={() => setFeedback(null)}
            />

            {loading ? (
              <div className="grid place-items-center px-8 py-12 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : erro ? (
              <div className="grid place-items-center px-8 py-12 text-sm font-medium text-rose-600 dark:text-rose-300">
                Erro ao carregar: {erro}
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* LEFT NAV */}
                <nav className="hidden min-h-0 flex-col border-r border-border/70 bg-muted/20 px-4 py-6 lg:flex">
                  {Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="mb-2">
                      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        {group}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.key}
                          className={navItemClass(activeSection === item.key)}
                          onClick={() => handleSectionChange(item.key)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="mb-2">
                    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      CONTA
                    </div>
                    <button
                      className={navItemClass(false, true)}
                      type="button"
                      onClick={logoutAction}
                    >
                      <LogOut size={16} />
                      <span>Sair</span>
                    </button>
                  </div>
                </nav>

                <div className={cn("min-h-0 overflow-y-auto px-4 pb-8 pt-3 lg:hidden", mobileSection && "hidden")}>
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-muted-foreground">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Buscar"
                      value={mobileQuery}
                      onChange={(e) => setMobileQuery(e.target.value)}
                      aria-label="Buscar configurações"
                      className="w-full border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {filteredGroups.map(([group, items]) => (
                    <div key={group} className="mb-5">
                      <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        {group}
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
                        {items.map((item) => (
                          <button
                            key={item.key}
                            className={mobileItemClass()}
                            onClick={() => handleSectionChange(item.key)}
                          >
                            <span className="inline-flex items-center justify-center text-muted-foreground">
                              {item.icon}
                            </span>
                            <span className="truncate text-sm font-medium">{item.label}</span>
                            <span className="inline-flex items-center justify-end text-muted-foreground">
                              <ChevronRight size={18} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="mb-5">
                    <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      CONTA
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
                      <button className={mobileItemClass(true)} onClick={logoutAction}>
                        <span className="inline-flex items-center justify-center"><LogOut size={16} /></span>
                        <span className="truncate text-sm font-medium">Sair</span>
                        <span className="inline-flex items-center justify-end opacity-70">
                          <ChevronRight size={18} />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT CONTENT */}
                <div
                  className={cn(
                    "min-h-0 overflow-y-auto px-4 pb-8 pt-4 sm:px-6 lg:block lg:px-8 lg:py-8",
                    isMobile && !mobileSection && "hidden"
                  )}
                >

                  {/* MINHA CONTA */}
                  {activeSection === "conta" && (
                    <>
                      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">Minha Conta</h2>
                          <p className="text-sm text-muted-foreground">
                            Gerencie seus dados, foto de perfil e banner do portal.
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        >
                          {roleLabel}
                        </Badge>
                      </div>
                      <Card className="gap-0 overflow-visible rounded-[28px] border-border/70 bg-card/95 py-0 shadow-xl shadow-black/10 ring-0">
                        <div className="relative">
                          <input
                            ref={coverPictureFileInputRef}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleCoverSelected}
                          />
                          <div
                            ref={coverPreviewBannerRef}
                            className="relative min-h-[176px] overflow-hidden rounded-t-[28px] border-b border-border/70 bg-gradient-to-br from-primary via-primary/80 to-primary/50 p-4 transition sm:min-h-[220px] sm:p-6"
                            onClick={handleOpenCover}
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
                            <div className="flex min-h-[176px] items-start justify-end sm:min-h-[220px]">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    data-cover-menu-trigger="true"
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur transition hover:bg-black/55"
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    disabled={pictureActionLoading}
                                  >
                                    <Camera size={14} />
                                    <span>{currentCoverSrc ? "Mudar banner" : "Adicionar banner"}</span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={dropdownContentClass}>
                                  <DropdownMenuLabel>Banner</DropdownMenuLabel>
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem onClick={handleChooseCoverClick} disabled={pictureActionLoading}>
                                      <FolderOpen />
                                      Alterar imagem
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={handleOpenCover}
                                      disabled={!currentCoverSrc}
                                    >
                                      <Eye />
                                      Ajustar enquadramento
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={handleRemoveCover}
                                      disabled={pictureActionLoading || !currentCoverSrc}
                                    >
                                      <Trash2 />
                                      Remover banner
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="absolute left-4 top-[118px] sm:left-6 sm:top-[146px]">
                            <input
                              ref={profilePictureFileInputRef}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={handlePictureSelected}
                            />
                            <button
                              type="button"
                              className="grid size-24 place-items-center overflow-hidden rounded-full border-4 border-background bg-primary text-3xl font-black text-primary-foreground shadow-xl shadow-black/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 sm:size-28"
                              onClick={() => currentPictureSrc && setPictureViewerOpen(true)}
                              title="Ver foto de perfil"
                              aria-label="Ver foto de perfil"
                              disabled={pictureActionLoading}
                            >
                              {currentPictureSrc ? (
                                <img
                                  src={currentPictureSrc}
                                  alt="Foto de perfil"
                                  className="size-full rounded-full object-cover"
                                  onError={() => {
                                    setPictureLoadError(true);
                                  }}
                                />
                              ) : (
                                <span aria-hidden="true">{profileInitial}</span>
                              )}
                            </button>
                            <DropdownMenu open={pictureMenuOpen} onOpenChange={setPictureMenuOpen}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(floatingIconButtonClass, "absolute bottom-1 right-1 size-10")}
                                  title="Ações da foto"
                                  aria-label="Ações da foto"
                                  disabled={pictureActionLoading}
                                >
                                  <Camera size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={8} className={dropdownContentClass}>
                                <DropdownMenuLabel>Foto de perfil</DropdownMenuLabel>
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPictureMenuOpen(false);
                                      setPictureViewerOpen(true);
                                    }}
                                    disabled={!currentPictureSrc}
                                  >
                                    <Eye />
                                    Mostrar foto
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={handleTakePictureClick} disabled={pictureActionLoading}>
                                    <Camera />
                                    Tirar foto
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={handleChoosePictureClick} disabled={pictureActionLoading}>
                                    <FolderOpen />
                                    Carregar foto
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={handleRemovePicture}
                                    disabled={pictureActionLoading || !currentPictureSrc}
                                  >
                                    <Trash2 />
                                    Remover foto
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <span className="absolute bottom-2 left-2 inline-flex size-5 rounded-full border-[3px] border-background bg-emerald-500" />
                          </div>
                        </div>
                        <CardContent className="flex flex-col gap-5 px-4 pb-4 pt-16 sm:px-6 sm:pb-6 sm:pt-20">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="min-w-0 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                                {formData.nome || "Sem nome definido"}
                              </h3>
                              <Badge
                                variant="secondary"
                                className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                              >
                                {roleLabel}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground sm:text-base">
                              {formData.usuario || "Sem e-mail cadastrado"}
                            </p>
                            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              Clique no banner para visualizar ou ajustar o enquadramento.
                            </p>
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-border/70 bg-border/80">
                            <div className="grid gap-px sm:grid-cols-3">
                              {accountSummaryFields.map((field) => (
                                <div key={field.label} className="min-w-0 bg-background/80 px-4 py-4">
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {field.label}
                                  </div>
                                  <div className="break-words text-sm font-semibold text-foreground sm:text-base">
                                    {field.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-2">
                              <span className={formLabelClass}>Bio</span>
                              <textarea
                                className={cn(formInputClass, "min-h-28 resize-y")}
                                rows={3}
                                value={formData.bio}
                                placeholder="Escreva uma breve descrição sobre você..."
                                onChange={(e) =>
                                  setFormData((prev) => ({ ...prev, bio: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <div className={settingsActionsClass}>
                            <AnimatedButton
                              className={primaryButtonClass}
                              onClick={handleSaveProfile}
                              disabled={savingSettings}
                              loading={savingSettings}
                            >
                              {savingSettings ? "Salvando..." : "Salvar perfil"}
                            </AnimatedButton>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* SEGURANÇA */}
                  {activeSection === "seguranca" && (
                    <>
                      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Segurança</h2>
                      <section className={settingsCardClass}>
                        <div className="flex flex-col gap-4">
                          <div className={settingsItemClass}>
                            <div className="space-y-1">
                              <h3 className={settingsTitleClass}>Alterar Senha</h3>
                              <p className={settingsTextClass}>Mantenha sua conta segura com uma senha forte</p>
                            </div>
                            <AnimatedButton className={secondaryButtonClass} onClick={() => setModalSenha(true)}>
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
                      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Configurações</h2>
                      <section className={settingsCardClass}>
                        {!isDesktopApp ? (
                          <Card className="mb-4 border-border/70 bg-background/70 shadow-none">
                            <CardHeader className="gap-3 pb-4">
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <Laptop size={16} />
                                  <span>Versao desktop</span>
                                </div>
                                <CardTitle className="text-lg font-extrabold tracking-[-0.02em]">
                                  Instalar aplicativo no Windows
                                </CardTitle>
                                <CardDescription>
                                  Baixe o app desktop com atualizacoes automaticas e acesso rapido pelo computador.
                                </CardDescription>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                <p className="text-sm leading-6 text-foreground">
                                  Instale a versao desktop do Painel - Portal Santos Tech para usar o sistema no
                                  Windows com atualizacoes pelo proprio aplicativo.
                                </p>
                              </div>

                              <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                  <div className="font-semibold text-foreground">Plataforma</div>
                                  <div className="mt-1">Windows</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                  <div className="font-semibold text-foreground">Entrega</div>
                                  <div className="mt-1">Instalador desktop mais recente</div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <Button
                                  type="button"
                                  className="h-10 rounded-xl"
                                  onClick={handleInstallDesktopApp}
                                >
                                  <Download size={16} />
                                  <span>Instalar versao desktop</span>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : null}

                        {isDesktopApp ? (
                          <Card className="mb-4 border-border/70 bg-background/70 shadow-none">
                            <CardHeader className="gap-3 pb-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <RefreshCw
                                      size={16}
                                      className={
                                        desktopUpdateState?.status === "checking" ||
                                        desktopUpdateState?.status === "downloading"
                                          ? "animate-spin"
                                          : ""
                                      }
                                    />
                                    <span>Atualizacoes do aplicativo</span>
                                  </div>
                                  <CardDescription>
                                    Versao atual {desktopUpdateState?.currentVersion ?? "Carregando..."}
                                  </CardDescription>
                                </div>
                                <Badge
                                  variant={
                                    desktopUpdateState
                                      ? getUpdateBadgeVariant(desktopUpdateState.status)
                                      : "outline"
                                  }
                                  className="self-start"
                                >
                                  {desktopUpdateState
                                    ? getUpdateStatusLabel(desktopUpdateState.status)
                                    : "Carregando"}
                                </Badge>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                <p className="break-words text-sm leading-6 text-foreground">
                                  {desktopUpdateState?.message || "Lendo estado do aplicativo..."}
                                </p>
                                {desktopUpdateState?.status === "error" ? (
                                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                                    <AlertTriangle size={14} />
                                    <span>Falha nao fatal. O app continua funcionando normalmente.</span>
                                  </div>
                                ) : null}
                              </div>

                              <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                  <div className="font-semibold text-foreground">Versao atual</div>
                                  <div className="mt-1">
                                    {desktopUpdateState?.currentVersion ?? "Carregando..."}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                  <div className="font-semibold text-foreground">Versao alvo</div>
                                  <div className="mt-1">{desktopUpdateState?.version ?? "--"}</div>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                  <div className="font-semibold text-foreground">Ultima verificacao</div>
                                  <div className="mt-1">
                                    {formatUpdateCheckedAt(desktopUpdateState?.checkedAt ?? null)}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                                  <div className="font-semibold text-foreground">Transferencia</div>
                                  <div className="mt-1">{desktopUpdateProgressLabel ?? "--"}</div>
                                </div>
                              </div>

                              {desktopUpdateState?.status === "downloading" ||
                              desktopUpdateState?.status === "downloaded" ? (
                                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/50 p-4">
                                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
                                    <span>Progresso do download</span>
                                    <span>{desktopUpdateState.percent ?? 0}%</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all duration-300"
                                      style={{ width: `${desktopUpdateState.percent ?? 0}%` }}
                                    />
                                  </div>
                                </div>
                              ) : null}

                              <Separator />

                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-10 rounded-xl"
                                  onClick={() => void handleManualDesktopUpdateCheck()}
                                  disabled={desktopUpdateBusy}
                                >
                                  <RefreshCw
                                    size={16}
                                    className={desktopUpdateBusy ? "animate-spin" : ""}
                                  />
                                  <span>Verificar atualizacoes</span>
                                </Button>

                                {desktopUpdateState?.status === "available" ? (
                                  <Button
                                    type="button"
                                    className="h-10 rounded-xl"
                                    onClick={() => {
                                      dismissedUpdateVersionRef.current = null;
                                      setDesktopDownloadConfirmOpen(true);
                                    }}
                                    disabled={desktopUpdateBusy}
                                  >
                                    <Download size={16} />
                                    <span>Baixar agora</span>
                                  </Button>
                                ) : null}

                                {desktopUpdateState?.status === "downloaded" ? (
                                  <Button
                                    type="button"
                                    className="h-10 rounded-xl"
                                    onClick={() => {
                                      setDesktopRestartConfirmOpen(true);
                                    }}
                                    disabled={desktopUpdateBusy}
                                  >
                                    <RotateCcw size={16} />
                                    <span>Reiniciar e instalar</span>
                                  </Button>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        ) : null}

                        <div className="flex flex-col gap-4">
                          <div className={settingsItemClass}>
                            <div className="space-y-1">
                              <h3 className={settingsTitleClass}>Notificações por e-mail</h3>
                              <p className={settingsTextClass}>Receba alertas sobre novas atividades e avisos</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.emailNotificacoes}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, emailNotificacoes: checked }))}
                            />
                          </div>
                          <div className={settingsItemClass}>
                            <div className="space-y-1">
                              <h3 className={settingsTitleClass}>Notificações no app</h3>
                              <p className={settingsTextClass}>Mostre avisos dentro do portal quando houver novidades</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.pushNotificacoes}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, pushNotificacoes: checked }))}
                            />
                          </div>
                          <div className={settingsItemClass}>
                            <div className="space-y-1">
                              <h3 className={settingsTitleClass}>Modo compacto</h3>
                              <p className={settingsTextClass}>Reduza o espaçamento para ver mais conteúdo</p>
                            </div>
                            <AnimatedToggle
                              checked={settings.modoCompacto}
                              onChange={(checked) => setSettings((prev) => ({ ...prev, modoCompacto: checked }))}
                            />
                          </div>
                        </div>
                        <div className={settingsActionsClass}>
                          <AnimatedButton className={secondaryButtonClass} onClick={handleResetSettings}>
                            Restaurar padrões
                          </AnimatedButton>
                          <AnimatedButton
                            className={primaryButtonClass}
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
                      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Aparência</h2>
                      <section className={settingsCardClass}>
                        <div className="flex flex-col gap-4">
                          <div className={settingsItemClass}>
                            <div className="space-y-1">
                              <h3 className={settingsTitleClass}>Tema</h3>
                              <p className={settingsTextClass}>Escolha como prefere visualizar o portal</p>
                            </div>
                            <AnimatedSelect
                              className={cn(formInputClass, "min-w-[180px] pr-8")}
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
                          <div className={settingsItemClass}>
                            <div className="space-y-1">
                              <h3 className={settingsTitleClass}>Cor preferida</h3>
                              <p className={settingsTextClass}>Escolha a cor de destaque do portal</p>
                            </div>
                            <div className="inline-flex items-center gap-3">
                              <input
                                type="color"
                                className="size-11 rounded-xl border border-border/70 bg-transparent p-1"
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
                                className={cn(formInputClass, "h-11 w-28 lowercase")}
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
                        <div className={settingsActionsClass}>
                          <AnimatedButton className={secondaryButtonClass} onClick={handleResetSettings}>
                            Restaurar padrões
                          </AnimatedButton>
                          <AnimatedButton
                            className={primaryButtonClass}
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
                      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Seu Desempenho</h2>
                      {statsLoading ? (
                        <div className={cn(settingsCardClass, "grid place-items-center px-8 py-12 text-sm text-muted-foreground")}>
                          Carregando estatísticas...
                        </div>
                      ) : statsError ? (
                        <div className={cn(settingsCardClass, "grid place-items-center px-8 py-12 text-sm font-medium text-rose-600 dark:text-rose-300")}>
                          {statsError}
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <div className={settingsCardClass}>
                            <div className="flex items-start gap-3">
                              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <CheckCircle size={18} />
                              </div>
                              <div className="space-y-1">
                                <div className="text-2xl font-black tracking-tight text-foreground">{stats.exerciciosFeitos}</div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Exercícios Feitos</div>
                              </div>
                            </div>
                          </div>
                          <div className={settingsCardClass}>
                            <div className="flex items-start gap-3">
                              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">*</div>
                              <div className="space-y-1">
                                <div className="text-2xl font-black tracking-tight text-foreground">
                                {stats.notaMedia === null ? "-" : `${stats.notaMedia.toFixed(1)}/10`}
                                </div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nota Média</div>
                              </div>
                            </div>
                          </div>
                          <div className={settingsCardClass}>
                            <div className="flex items-start gap-3">
                              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Users size={18} />
                              </div>
                              <div className="space-y-1">
                                <div className="text-2xl font-black tracking-tight text-foreground">{stats.turmasInscritas}</div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Turmas Inscritas</div>
                              </div>
                            </div>
                          </div>
                          <div className={settingsCardClass}>
                            <div className="flex items-start gap-3">
                              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Flame size={18} />
                              </div>
                              <div className="space-y-1">
                                <div className="text-2xl font-black tracking-tight text-foreground">{stats.diasSequencia}</div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dias de Sequência</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* TURMAS */}
                  {activeSection === "turmas" && (
                    <>
                      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Turmas Inscritas</h2>
                      {turmas.length === 0 ? (
                        <div className={cn(settingsCardClass, "flex flex-col items-center gap-3 border-dashed px-8 py-12 text-center")}>
                          <div className="inline-flex rounded-full bg-muted p-4 text-muted-foreground"><BookOpen size={22} /></div>
                          <p className="text-sm text-muted-foreground">Você não está inscrito em nenhuma turma</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {turmas.map((turma) => (
                            <div key={turma.id} className="flex items-start gap-4 rounded-[24px] border border-border/70 bg-card/95 p-4 shadow-sm">
                              <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                {turma.tipo === "turma" ? <Users size={16} /> : <UserIcon size={16} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-base font-semibold text-foreground">{turma.nome}</h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(metaBadgeClass, "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:text-sky-300")}
                                  >
                                    {turma.categoria === "programacao"
                                      ? iconLabel(<Laptop size={14} />, "Programação")
                                      : iconLabel(<Monitor size={14} />, "Informática")}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn(metaBadgeClass, "border-violet-300/60 bg-violet-500/10 text-violet-700 dark:border-violet-500/30 dark:text-violet-300")}
                                  >
                                    {turma.tipo === "turma" ? "Grupo" : "Particular"}
                                  </Badge>
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
          </DialogContent>

          {/* MODAL DE ALTERAR SENHA */}
          <Dialog open={modalSenha} onOpenChange={(open) => !open && closeSenhaModal()}>
            <DialogContent
              overlayClassName="z-[10002] bg-black/70 backdrop-blur-sm"
              className="z-[10003] max-w-[500px] gap-0 border-border/70 bg-card/95 p-0"
              showCloseButton={false}
            >
                <DialogHeader className="border-b border-border/70">
                  <DialogTitle>Alterar Senha</DialogTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Atualize sua senha e mantenha sua conta protegida.
                  </p>
                </DialogHeader>
                <div className="flex flex-col gap-4 px-6 py-5">
                <div className="flex flex-col gap-2">
                  <span className={formLabelClass}>Senha Atual</span>
                  <input type="password" placeholder="Digite sua senha atual" className={formInputClass} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className={formLabelClass}>Nova Senha</span>
                  <input type="password" placeholder="Digite sua nova senha" className={formInputClass} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
                  {novaSenha && novaSenha.length < 6 && <small className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-300">{iconLabel(<XCircle size={12} />, "Mínimo 6 caracteres")}</small>}
                  {novaSenha && novaSenha.length >= 6 && <small className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">{iconLabel(<CheckCircle size={12} />, "Senha forte")}</small>}
                </div>
                <div className="flex flex-col gap-2">
                  <span className={formLabelClass}>Confirmar Nova Senha</span>
                  <input type="password" placeholder="Confirme sua nova senha" className={formInputClass} value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
                  {confirmarSenha && novaSenha === confirmarSenha && <small className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">{iconLabel(<CheckCircle size={12} />, "Senhas coincidem")}</small>}
                  {confirmarSenha && novaSenha !== confirmarSenha && <small className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-300">{iconLabel(<XCircle size={12} />, "As senhas não coincidem")}</small>}
                </div>
                <div className="mt-4 rounded-xl border border-border/70 bg-muted/35 p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">Requisitos:</p>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className={cn("inline-flex items-center gap-1.5", senhaAtual ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground")}>{senhaAtual ? <CheckCircle size={14} /> : <Circle size={12} />} Senha atual preenchida</div>
                    <div className={cn("inline-flex items-center gap-1.5", novaSenha && novaSenha.length >= 6 ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground")}>{novaSenha && novaSenha.length >= 6 ? <CheckCircle size={14} /> : <Circle size={12} />} Nova senha com 6+ caracteres</div>
                    <div className={cn("inline-flex items-center gap-1.5", confirmarSenha && novaSenha === confirmarSenha ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground")}>{confirmarSenha && novaSenha === confirmarSenha ? <CheckCircle size={14} /> : <Circle size={12} />} Confirmação igual</div>
                  </div>
                </div>
                </div>
                <DialogFooter className="max-[640px]:flex-col">
                  <AnimatedButton type="button" className={secondaryButtonClass} onClick={closeSenhaModal}>Cancelar</AnimatedButton>
                  <AnimatedButton type="button" className={primaryButtonClass} onClick={handleChangeSenha} disabled={savingSenha} loading={savingSenha}>
                    {savingSenha ? iconLabel(<Loader2 size={14} />, "Alterando...") : iconLabel(<CheckCircle size={14} />, "Alterar Senha")}
                  </AnimatedButton>
                </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={pictureViewerOpen && Boolean(currentPictureSrc)}
            onOpenChange={(open) => !open && setPictureViewerOpen(false)}
          >
            <DialogContent
              overlayClassName="z-[10003] bg-slate-950/82 backdrop-blur-sm"
              className="z-[10004] max-h-[calc(100vh-2rem)] w-[min(560px,calc(100vw-2rem))] max-w-none items-center gap-3 border-none bg-transparent p-0 shadow-none"
              showCloseButton={false}
            >
                <DialogTitle className="sr-only">Foto de perfil ampliada</DialogTitle>
                <img
                  src={currentPictureSrc}
                  alt="Foto de perfil ampliada"
                  className="max-h-[calc(100vh-7rem)] max-w-full rounded-[24px] border border-white/15 bg-slate-950 object-contain shadow-2xl shadow-black/40"
                />
                <AnimatedButton
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => setPictureViewerOpen(false)}
                >
                  Fechar
                </AnimatedButton>
            </DialogContent>
          </Dialog>
          <Dialog
            open={coverViewerOpen && Boolean(editorCoverSrc)}
            onOpenChange={(open) => !open && handleCloseCoverEditor()}
          >
            <DialogContent
              overlayClassName="z-[10003] bg-slate-950/82 backdrop-blur-sm"
              className="z-[10004] w-[min(760px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/50"
              showCloseButton={false}
            >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div className="space-y-1">
                    <DialogTitle className="pr-0 text-lg font-bold text-white">Editar banner</DialogTitle>
                    <p className="text-sm leading-6 text-slate-400">
                      Arraste a imagem para reposicionar e ajuste o zoom antes de salvar.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(overlayButtonClass, "border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10 hover:text-white")}
                    onClick={handleCloseCoverEditor}
                    aria-label="Fechar editor de banner"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex flex-col gap-4 px-5 py-5">
                <div
                  ref={coverEditorViewportRef}
                  className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                  style={{ aspectRatio: coverAspectRatio }}
                  onPointerDown={handleCoverDragStart}
                  onPointerMove={handleCoverDragMove}
                  onPointerUp={handleCoverDragEnd}
                  onPointerCancel={handleCoverDragEnd}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-no-repeat"
                    style={{
                      backgroundImage: `url(${editorCoverSrc})`,
                      backgroundSize: `${Math.max(coverDraftZoom, coverMinZoom)}%`,
                      backgroundPosition: `center ${coverDraftPositionY}%`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-white/80 ring-inset"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="w-full accent-primary"
                    min={String(Math.ceil(coverMinZoom))}
                    max={String(coverZoomMax)}
                    value={coverDraftZoom}
                    onChange={(e) => setCoverDraftZoom(Math.max(Number(e.target.value), Math.ceil(coverMinZoom)))}
                  />
                  <span className="min-w-12 text-right text-xs font-semibold text-slate-300">{coverDraftZoom}%</span>
                </div>
                </div>
                <DialogFooter className="justify-between border-t border-white/10 bg-white/2 px-5 py-4 max-[640px]:flex-col">
                  <button type="button" className="text-sm font-semibold text-slate-300 transition hover:text-white" onClick={handleResetCoverPosition}>
                    Redefinir
                  </button>
                  <div className="flex flex-wrap justify-end gap-3 max-[640px]:w-full max-[640px]:flex-col">
                    <AnimatedButton
                      type="button"
                      className={secondaryButtonClass}
                      onClick={handleCloseCoverEditor}
                    >
                      Cancelar
                    </AnimatedButton>
                    <AnimatedButton
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => void handleApplyCoverPosition()}
                      disabled={pictureActionLoading}
                    >
                      {pictureActionLoading ? "Aplicando..." : "Aplicar"}
                    </AnimatedButton>
                  </div>
                </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={cameraModalOpen} onOpenChange={(open) => !open && closeCameraModal()}>
            <DialogContent
              overlayClassName="z-[10004] bg-slate-950/82 backdrop-blur-sm"
              className="z-[10005] w-[min(560px,calc(100vw-2rem))] max-w-none gap-4 border-none bg-transparent p-0 shadow-none"
              showCloseButton={false}
            >
                <DialogTitle className="sr-only">Capturar foto de perfil</DialogTitle>
                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
                  {cameraLoading && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/75 text-sm font-semibold text-white">
                      Abrindo câmera...
                    </div>
                  )}
                  <video ref={profileCameraVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <canvas ref={profileCameraCanvasRef} className="hidden" />
                </div>
                <div className="flex flex-wrap gap-3 border-t border-white/10 bg-slate-950/90 p-4 max-[640px]:flex-col">
                  <AnimatedButton
                    type="button"
                    className={secondaryButtonClass}
                    onClick={closeCameraModal}
                    disabled={pictureActionLoading}
                  >
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    type="button"
                    className={primaryButtonClass}
                    onClick={handleCaptureFromCamera}
                    disabled={pictureActionLoading || cameraLoading}
                    loading={pictureActionLoading}
                  >
                    Capturar
                  </AnimatedButton>
                </div>
                </div>
            </DialogContent>
          </Dialog>
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
      </Dialog>
      <ConfirmModal
        isOpen={desktopDownloadConfirmOpen}
        title="Nova atualização disponível"
        message={
          desktopUpdateState?.version
            ? `A versão ${desktopUpdateState.version} está pronta para download. Deseja baixar agora?`
            : "Há uma nova atualização disponível. Deseja baixar agora?"
        }
        confirmText="Baixar agora"
        cancelText="Depois"
        overlayZIndex={10005}
        isLoading={desktopUpdateBusy && desktopUpdateState?.status !== "downloaded"}
        onCancel={handleDismissDesktopDownloadPrompt}
        onConfirm={() => {
          void handleDesktopUpdateDownload();
        }}
      />
      <ConfirmModal
        isOpen={desktopRestartConfirmOpen}
        title="Atualização pronta"
        message={
          desktopUpdateState?.version
            ? `A versão ${desktopUpdateState.version} foi baixada. Reiniciar agora para instalar?`
            : "A atualização foi baixada. Reiniciar agora para instalar?"
        }
        confirmText="Reiniciar agora"
        cancelText="Depois"
        overlayZIndex={10005}
        isLoading={desktopUpdateActionLoading}
        onCancel={() => setDesktopRestartConfirmOpen(false)}
        onConfirm={() => {
          void handleDesktopQuitAndInstall();
        }}
      />
    </>
  );
}
