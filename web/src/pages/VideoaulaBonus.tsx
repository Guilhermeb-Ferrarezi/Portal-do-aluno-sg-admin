import React from "react";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { hasRole } from "../auth/auth";
import { useToastActions } from "../contexts/ToastContext";
import {
  Search,
  Plus,
  Film,
  Landmark,
  Globe,
  Trash2,
  Clock,
  FolderUp,
  Play,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  FadeInUp,
  PopInBadge,
  PulseLoader,
  AnimatedButton,
  AnimatedSelect,
} from "../components/animate-ui";
import {
  listarTurmas,
  listarModulos,
  listarVideoaulas,
  criarVideoaula,
  deletarVideoaula,
  atribuirVideoaulaTurmas,
  type Turma,
  type Videoaula,
  type Modulo,
} from "../services/api";

type VideoTipoFiltro = "todos" | "youtube" | "vimeo" | "arquivo";

const pageTitle = "Videoaulas Bonus";
const pageSubtitle = "Aprenda ainda mais com essas aulas extras";

const fieldClass =
  "h-12 w-full rounded-2xl border border-border/75 bg-card px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-muted-foreground/90 hover:border-primary/35 focus:border-primary focus:ring-4 focus:ring-ring/30";

const textareaClass = cn(fieldClass, "min-h-28 py-3 leading-6");
const suggestionPanelClass =
  "absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-[0_18px_45px_rgba(0,0,0,0.24)]";
const suggestionOptionClass =
  "block w-full border-b border-border/60 px-4 py-3 text-left text-sm font-medium text-foreground transition last:border-b-0 hover:bg-accent/70";
const primaryButtonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_rgba(225,29,46,0.28)] transition disabled:cursor-not-allowed disabled:opacity-65";
const secondaryButtonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border/80 bg-muted/50 px-5 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-65";
const surfaceCardClass =
  "rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(225,29,46,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] bg-card/95 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";

function normalizeYoutubeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    if (host.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    const maybeId = raw.split("v=")[1]?.split("&")[0] || "";
    if (maybeId) return `https://www.youtube.com/embed/${maybeId}`;
  }
  return raw;
}

function normalizeVimeoUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!host.includes("vimeo.com")) return raw;

    const parts = url.pathname.split("/").filter(Boolean);
    const videoId = parts.includes("video")
      ? parts[parts.indexOf("video") + 1]
      : parts[0];
    if (videoId) return `https://player.vimeo.com/video/${videoId}`;
  } catch {
    // fallback: mantem URL original
  }
  return raw;
}

function getPlayableVideoUrl(videoaula: Videoaula): string {
  if (videoaula.tipo === "youtube") return normalizeYoutubeUrl(videoaula.url || "");
  if (videoaula.tipo === "vimeo") return normalizeVimeoUrl(videoaula.url || "");
  return videoaula.url || "";
}

function formatDate(value?: string | null) {
  return new Date(value || new Date()).toLocaleDateString("pt-BR");
}

function typeOptionClass(active: boolean) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
    active
      ? "border-primary/60 bg-primary text-primary-foreground shadow-[0_14px_30px_rgba(225,29,46,0.24)]"
      : "border-border/75 bg-muted/45 text-muted-foreground hover:border-primary/35 hover:text-foreground"
  );
}

function turmaBadgeClass(tipo?: string) {
  return tipo === "turma"
    ? "border-sky-500/25 bg-sky-500/12 text-sky-300"
    : "border-fuchsia-500/25 bg-fuchsia-500/12 text-fuchsia-300";
}

export default function VideoaulaBonusPage() {
  const canUpload = hasRole(["admin", "professor"]);
  const { addToast } = useToastActions();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  );

  const [videoaulas, setVideoaulas] = React.useState<Videoaula[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [totalItems, setTotalItems] = React.useState(0);

  const [filtroModulo, setFiltroModulo] = React.useState<string>("todos");
  const [buscaModuloFiltro, setBuscaModuloFiltro] = React.useState<string>("");
  const [showSugestoesModuloFiltro, setShowSugestoesModuloFiltro] = React.useState(false);
  const [filtroTipo, setFiltroTipo] = React.useState<VideoTipoFiltro>("todos");
  const [busca, setBusca] = React.useState<string>("");
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>("todas");
  const [modalAberto, setModalAberto] = React.useState(false);
  const [videoSelecionado, setVideoSelecionado] = React.useState<Videoaula | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Videoaula | null>(null);
  const [buscaModuloForm, setBuscaModuloForm] = React.useState<string>("");
  const [showSugestoesModuloForm, setShowSugestoesModuloForm] = React.useState(false);
  const [formError, setFormError] = React.useState<string>("");

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const deferredBusca = React.useDeferredValue(busca);
  const moduloQuery = React.useMemo(() => {
    if (filtroModulo !== "todos") return filtroModulo;
    const termo = buscaModuloFiltro.trim();
    return termo.length > 0 ? termo : undefined;
  }, [buscaModuloFiltro, filtroModulo]);

  const [formData, setFormData] = React.useState({
    titulo: "",
    descricao: "",
    moduloId: "",
    tipo: "youtube" as "youtube" | "vimeo" | "arquivo",
    url: "",
    arquivo: null as File | null,
    duracao: "",
  });

  React.useEffect(() => {
    if (canUpload) {
      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((err) => console.error("Erro ao carregar turmas:", err));

      listarModulos()
        .then(setModulosDisponiveis)
        .catch((err) => console.error("Erro ao carregar modulos:", err));
    }
  }, [canUpload]);

  const carregarVideoaulas = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await listarVideoaulas({
        modulo: moduloQuery,
        q: deferredBusca.trim() || undefined,
        tipo: filtroTipo,
        page: currentPage,
        limit: itemsPerPage,
      });

      setVideoaulas(response.items);
      setTotalItems(response.total);
      const lastPage = Math.max(1, response.pagination.totalPages);
      if (currentPage > lastPage) {
        setCurrentPage(lastPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar videoaulas");
    } finally {
      setLoading(false);
    }
  }, [currentPage, deferredBusca, filtroTipo, itemsPerPage, moduloQuery]);

  React.useEffect(() => {
    void carregarVideoaulas();
  }, [carregarVideoaulas]);

  const modulos = Array.from(
    new Set([
      ...videoaulas.map((videoaula) => videoaula.modulo).filter(Boolean),
      ...modulosDisponiveis.map((modulo) => modulo.nome).filter(Boolean),
    ])
  );

  const termoModuloFiltro = buscaModuloFiltro.trim().toLowerCase();
  const modulosFiltradosNoFiltro =
    termoModuloFiltro.length === 0
      ? []
      : modulos.filter((modulo) => modulo.toLowerCase().includes(termoModuloFiltro));

  const termoModuloForm = buscaModuloForm.trim().toLowerCase();
  const modulosFiltradosNoForm =
    termoModuloForm.length === 0
      ? []
      : modulosDisponiveis.filter((modulo) =>
          modulo.nome.toLowerCase().includes(termoModuloForm)
        );

  const hasAnyFiltro =
    busca.trim() !== "" ||
    filtroTipo !== "todos" ||
    filtroModulo !== "todos" ||
    buscaModuloFiltro.trim() !== "" ||
    turmaFiltro !== "todas";

  const handleAssistir = (videoaula: Videoaula) => {
    setVideoSelecionado(videoaula);
  };

  const playableVideoUrl = React.useMemo(
    () => (videoSelecionado ? getPlayableVideoUrl(videoSelecionado) : ""),
    [videoSelecionado]
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData((current) => ({
        ...current,
        arquivo: file,
      }));
    }
  };

  const handleAddVideoaula = async () => {
    const moduloIdSelecionado = formData.moduloId.trim();
    const moduloDigitado = buscaModuloForm.trim();
    const moduloParcial = moduloDigitado.toLowerCase();
    const primeiroModuloCompativel =
      moduloParcial.length > 0
        ? modulosDisponiveis.find((modulo) =>
            modulo.nome.toLowerCase().includes(moduloParcial)
          )?.id
        : "";
    const moduloEncontrado =
      moduloIdSelecionado ||
      modulosDisponiveis.find(
        (modulo) => modulo.nome.toLowerCase() === moduloDigitado.toLowerCase()
      )?.id ||
      primeiroModuloCompativel ||
      "";

    if (!formData.titulo.trim() || !moduloEncontrado || !formData.duracao.trim()) {
      if (!moduloEncontrado) {
        setFormError("Selecione um modulo existente para continuar.");
        addToast("Selecione um modulo existente", "error");
      } else {
        setFormError("Preencha todos os campos obrigatorios.");
        addToast("Por favor, preencha todos os campos obrigatorios", "error");
      }
      return;
    }

    if ((formData.tipo === "youtube" || formData.tipo === "vimeo") && !formData.url.trim()) {
      const provider = formData.tipo === "youtube" ? "YouTube" : "Vimeo";
      setFormError(`Informe a URL do ${provider}.`);
      addToast(`Por favor, cole a URL do ${provider}`, "error");
      return;
    }

    if (formData.tipo === "arquivo" && !formData.arquivo) {
      setFormError("Selecione um arquivo de video.");
      addToast("Por favor, selecione um arquivo de video", "error");
      return;
    }

    try {
      setFormError("");
      setSubmitting(true);

      const formDataToSend = new FormData();
      formDataToSend.append("titulo", formData.titulo);
      formDataToSend.append("descricao", formData.descricao);
      formDataToSend.append("moduloId", moduloEncontrado);
      formDataToSend.append("duracao", formData.duracao);
      formDataToSend.append("tipo", formData.tipo);

      if (formData.tipo === "arquivo" && formData.arquivo) {
        formDataToSend.append("file", formData.arquivo);
      } else if (formData.tipo === "youtube" || formData.tipo === "vimeo") {
        const normalizedUrl =
          formData.tipo === "youtube"
            ? normalizeYoutubeUrl(formData.url)
            : normalizeVimeoUrl(formData.url);
        formDataToSend.append("url", normalizedUrl);
      }

      if (turmasSelecionadas.length > 0) {
        formDataToSend.append("turma_ids", JSON.stringify(turmasSelecionadas));
      }

      const resultado = await criarVideoaula(formDataToSend);

      if (turmasSelecionadas.length > 0 && resultado.videoaula?.id) {
        try {
          await atribuirVideoaulaTurmas(resultado.videoaula.id, turmasSelecionadas);
        } catch (err) {
          console.error("Erro ao atribuir turmas:", err);
        }
      }

      await carregarVideoaulas();

      setFormData({
        titulo: "",
        descricao: "",
        moduloId: "",
        tipo: "youtube",
        url: "",
        arquivo: null,
        duracao: "",
      });
      setTurmasSelecionadas([]);
      setBuscaModuloForm("");
      setShowSugestoesModuloForm(false);
      setFormError("");

      setModalAberto(false);
      addToast("Videoaula adicionada com sucesso!", "success");
    } catch (err) {
      console.error("Erro ao adicionar videoaula:", err);
      addToast(
        err instanceof Error ? err.message : "Erro ao adicionar videoaula",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;

    try {
      setDeleting(true);
      await deletarVideoaula(target.id);
      setDeleteTarget(null);
      addToast(`"${target.titulo}" foi removida.`, "success");
      await carregarVideoaulas();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Erro ao deletar videoaula",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
        <div className={cn(surfaceCardClass, "px-6 py-16")}>
          <PulseLoader size="large" text="Carregando videoaulas..." />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
        <div className="rounded-[28px] border border-red-500/25 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.12),transparent_48%)] bg-red-500/8 px-6 py-10 text-center shadow-[0_18px_44px_rgba(0,0,0,0.16)]">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-red-500/25 bg-red-500/12 text-red-300">
              <RefreshCw size={20} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-[-0.02em] text-foreground">
                Nao foi possivel carregar as videoaulas
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
            <AnimatedButton className={primaryButtonClass} onClick={() => void carregarVideoaulas()}>
              {iconLabel(<RefreshCw size={16} />, "Tentar novamente")}
            </AnimatedButton>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
      <FadeInUp duration={0.28}>
        <div className="flex flex-col gap-6">
          <div className={cn(surfaceCardClass, "relative overflow-hidden p-4 sm:p-5")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
            <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.8fr))]">
                <div className="relative md:col-span-2 xl:col-span-1">
                  <span className="pointer-events-none absolute inset-y-0 left-4 inline-flex w-5 items-center justify-center text-muted-foreground">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar videoaulas..."
                    value={busca}
                    onChange={(event) => {
                      setBusca(event.target.value);
                      setCurrentPage(1);
                    }}
                    className={cn(fieldClass, "pl-14")}
                    style={{ paddingLeft: "3.75rem" }}
                  />
                </div>

                <AnimatedSelect
                  value={filtroTipo}
                  onChange={(event) => {
                    setFiltroTipo(event.target.value as VideoTipoFiltro);
                    setCurrentPage(1);
                  }}
                  className={cn(fieldClass, "appearance-none pr-10")}
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="arquivo">Upload local</option>
                </AnimatedSelect>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filtrar modulo..."
                    value={buscaModuloFiltro}
                    onFocus={() => {
                      if (modulosFiltradosNoFiltro.length > 0) {
                        setShowSugestoesModuloFiltro(true);
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setShowSugestoesModuloFiltro(false), 120);
                    }}
                    onChange={(event) => {
                      setBuscaModuloFiltro(event.target.value);
                      setFiltroModulo("todos");
                      setCurrentPage(1);
                      setShowSugestoesModuloFiltro(true);
                    }}
                    className={fieldClass}
                  />
                  {showSugestoesModuloFiltro && modulosFiltradosNoFiltro.length > 0 ? (
                    <div className={suggestionPanelClass}>
                      {modulosFiltradosNoFiltro.map((modulo) => (
                        <button
                          key={modulo}
                          type="button"
                          onClick={() => {
                            setFiltroModulo(modulo);
                            setBuscaModuloFiltro(modulo);
                            setCurrentPage(1);
                            setShowSugestoesModuloFiltro(false);
                          }}
                          className={suggestionOptionClass}
                        >
                          {modulo}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <AnimatedSelect
                  value={turmaFiltro}
                  onChange={(event) => {
                    setTurmaFiltro(event.target.value);
                    setCurrentPage(1);
                  }}
                  className={cn(fieldClass, "appearance-none pr-10")}
                >
                  <option value="todas">Todas as turmas</option>
                  {turmasDisponiveis.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome}
                    </option>
                  ))}
                </AnimatedSelect>
              </div>

              {canUpload ? (
                <AnimatedButton className={primaryButtonClass} onClick={() => setModalAberto(true)}>
                  {iconLabel(<Plus size={16} />, "Adicionar videoaula")}
                </AnimatedButton>
              ) : null}
            </div>
          </div>

          {totalItems === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border/80 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.09),transparent_44%)] bg-muted/35 px-6 py-16 text-center shadow-[0_18px_44px_rgba(0,0,0,0.12)]">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-[0_16px_36px_rgba(0,0,0,0.2)]">
                  <Film size={24} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-[-0.02em] text-foreground">
                    {!hasAnyFiltro
                      ? "Nenhuma videoaula disponivel"
                      : "Nenhuma videoaula encontrada"}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {!hasAnyFiltro
                      ? "Em breve novas aulas extras serao adicionadas."
                      : "Tente ajustar sua busca ou os filtros da listagem."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {videoaulas.map((videoaula, index) => (
                  <FadeInUp key={videoaula.id} delay={index * 0.05}>
                    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent)] bg-card shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_22px_50px_rgba(225,29,46,0.18)]">
                      <div
                        className="relative isolate flex aspect-video cursor-pointer items-center justify-center overflow-hidden bg-muted/35 outline-none"
                        onClick={() => handleAssistir(videoaula)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Assistir ${videoaula.titulo}`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleAssistir(videoaula);
                          }
                        }}
                      >
                        {videoaula.thumbnail ? (
                          <img
                            src={videoaula.thumbnail}
                            alt={videoaula.titulo}
                            className="absolute inset-0 h-full w-full object-cover object-center transition duration-300 scale-[1.03] group-hover:scale-[1.08]"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.3),transparent_58%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(127,29,29,0.92))]">
                            <Film size={42} className="text-white/65" />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/18 to-black/8" />
                        <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-primary/90 text-white shadow-[0_14px_30px_rgba(225,29,46,0.3)] transition duration-200 group-hover:scale-105 group-hover:bg-primary">
                          <Play size={22} className="ml-0.5 fill-current" />
                        </span>
                        <span className="absolute bottom-3 right-3 z-10 rounded-full bg-black/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                          {videoaula.duracao || "--:--"}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                        <span className="inline-flex w-fit rounded-full border border-sky-500/20 bg-sky-500/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
                          {videoaula.modulo}
                        </span>

                        <div className="space-y-2">
                          <h3 className="text-lg font-black leading-tight tracking-[-0.02em] text-foreground">
                            {videoaula.titulo}
                          </h3>
                          <p className="text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                            {videoaula.descricao || "Sem descricao cadastrada."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {videoaula.turmas && videoaula.turmas.length > 0 ? (
                            <>
                              <PopInBadge delay={0.1}>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/12 px-3 py-1 text-[11px] font-semibold text-sky-300">
                                  {iconLabel(
                                    <Landmark size={12} />,
                                    `${videoaula.turmas.length} turma${videoaula.turmas.length > 1 ? "s" : ""}`
                                  )}
                                </span>
                              </PopInBadge>
                              {videoaula.turmas.map((turma, turmaIndex) => (
                                <PopInBadge key={turma.id} delay={0.18 + turmaIndex * 0.08}>
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold",
                                      turmaBadgeClass(turma.tipo)
                                    )}
                                    title={`${turma.tipo}: ${turma.nome}`}
                                  >
                                    {turma.nome}
                                  </span>
                                </PopInBadge>
                              ))}
                            </>
                          ) : (
                            <PopInBadge delay={0.1}>
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/12 px-3 py-1 text-[11px] font-semibold text-emerald-300"
                                title="Disponivel para todos os alunos"
                              >
                                {iconLabel(<Globe size={12} />, "Para todos")}
                              </span>
                            </PopInBadge>
                          )}
                        </div>

                        <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-4">
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDate(videoaula.dataAdicionada || videoaula.createdAt)}
                          </span>

                          <div className="ml-auto flex items-center gap-2">
                            <AnimatedButton
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(225,29,46,0.22)] transition disabled:cursor-not-allowed disabled:opacity-65"
                              onClick={() => handleAssistir(videoaula)}
                            >
                              {iconLabel(<Play size={16} />, "Assistir")}
                            </AnimatedButton>

                            {canUpload ? (
                              <AnimatedButton
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-red-300 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => setDeleteTarget(videoaula)}
                                title="Deletar"
                              >
                                <Trash2 size={16} />
                              </AnimatedButton>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  </FadeInUp>
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </>
          )}

          <Modal
            isOpen={videoSelecionado !== null}
            onClose={() => setVideoSelecionado(null)}
            title={videoSelecionado?.titulo || "Videoaula"}
            size="lg"
          >
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[24px] border border-border/75 bg-black shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
                <div className="aspect-video w-full">
                  {videoSelecionado?.tipo === "youtube" ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={playableVideoUrl}
                      title="Videoaula YouTube"
                      frameBorder={0}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : videoSelecionado?.tipo === "vimeo" ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={playableVideoUrl}
                      title="Videoaula Vimeo"
                      frameBorder={0}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video className="h-full w-full bg-black" controls>
                      <source src={playableVideoUrl} type="video/mp4" />
                      Seu navegador não suporta a tag de video.
                    </video>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
                    {videoSelecionado?.modulo}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/45 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <Clock size={14} />
                    {videoSelecionado?.duracao || "--:--"}
                  </span>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {videoSelecionado?.descricao || "Sem descricao cadastrada."}
                </p>

                <div className="border-t border-border/70 pt-4 text-xs font-medium text-muted-foreground">
                  Adicionada em{" "}
                  {formatDate(videoSelecionado?.dataAdicionada || videoSelecionado?.createdAt)}
                </div>
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={modalAberto && canUpload}
            onClose={() => setModalAberto(false)}
            title="Adicionar nova videoaula"
            size="lg"
            footer={
              <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <AnimatedButton
                  onClick={() => setModalAberto(false)}
                  disabled={submitting}
                  className={secondaryButtonClass}
                >
                  Cancelar
                </AnimatedButton>
                <AnimatedButton
                  onClick={() => void handleAddVideoaula()}
                  disabled={submitting}
                  className={primaryButtonClass}
                >
                  {submitting ? "Adicionando..." : "Adicionar"}
                </AnimatedButton>
              </div>
            }
          >
            <div className="space-y-5">
              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Titulo *
                </span>
                <input
                  type="text"
                  placeholder="Titulo da videoaula"
                  value={formData.titulo}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, titulo: event.target.value }))
                  }
                  className={fieldClass}
                />
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Modulo *
                </span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar modulo por nome..."
                    value={buscaModuloForm}
                    onFocus={() => {
                      if (modulosFiltradosNoForm.length > 0) {
                        setShowSugestoesModuloForm(true);
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setShowSugestoesModuloForm(false), 120);
                    }}
                    onChange={(event) => {
                      setBuscaModuloForm(event.target.value);
                      setFormData((current) => ({ ...current, moduloId: "" }));
                      setShowSugestoesModuloForm(true);
                      if (formError) setFormError("");
                    }}
                    className={fieldClass}
                  />

                  {showSugestoesModuloForm && modulosFiltradosNoForm.length > 0 ? (
                    <div className={suggestionPanelClass}>
                      {modulosFiltradosNoForm.map((modulo) => (
                        <button
                          key={modulo.id}
                          type="button"
                          onClick={() => {
                            setFormData((current) => ({ ...current, moduloId: modulo.id }));
                            setBuscaModuloForm(modulo.nome);
                            setShowSugestoesModuloForm(false);
                            if (formError) setFormError("");
                          }}
                          className={suggestionOptionClass}
                        >
                          {modulo.nome}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Tipo *
                </span>
                <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Tipo de videoaula">
                  <button
                    type="button"
                    className={typeOptionClass(formData.tipo === "youtube")}
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        tipo: "youtube",
                        arquivo: current.tipo === "youtube" ? current.arquivo : null,
                      }))
                    }
                  >
                    {iconLabel(<Play size={16} />, "YouTube")}
                  </button>
                  <button
                    type="button"
                    className={typeOptionClass(formData.tipo === "vimeo")}
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        tipo: "vimeo",
                        arquivo: null,
                      }))
                    }
                  >
                    {iconLabel(<Film size={16} />, "Vimeo")}
                  </button>
                  <button
                    type="button"
                    className={typeOptionClass(formData.tipo === "arquivo")}
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        tipo: "arquivo",
                        url: "",
                      }))
                    }
                  >
                    {iconLabel(<FolderUp size={16} />, "Upload local")}
                  </button>
                </div>
              </div>

              {formError ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                  {formError}
                </div>
              ) : null}

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Descricao
                </span>
                <textarea
                  placeholder="Descricao da videoaula"
                  value={formData.descricao}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, descricao: event.target.value }))
                  }
                  className={textareaClass}
                  rows={4}
                />
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Turmas (opcional)
                </span>
                <select
                  className={cn(fieldClass, "h-32 py-3")}
                  multiple
                  value={turmasSelecionadas}
                  onChange={(event) =>
                    setTurmasSelecionadas(
                      Array.from(event.target.selectedOptions, (option) => option.value)
                    )
                  }
                  size={4}
                >
                  {turmasDisponiveis.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome} ({turma.tipo})
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Segure Ctrl ou Cmd para selecionar multiplas turmas. Deixe vazio para liberar a todos.
                </p>
              </div>

              {formData.tipo === "youtube" || formData.tipo === "vimeo" ? (
                <div className="space-y-2.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    URL do {formData.tipo === "youtube" ? "YouTube" : "Vimeo"} *
                  </label>
                  <input
                    type="text"
                    placeholder={
                      formData.tipo === "youtube"
                        ? "https://www.youtube.com/watch?v=..."
                        : "https://vimeo.com/..."
                    }
                    value={formData.url}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, url: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Arquivo de video *
                  </span>
                  <label className="flex cursor-pointer items-center gap-3 rounded-[24px] border-2 border-dashed border-border/80 bg-muted/35 px-4 py-4 transition hover:border-primary/35 hover:bg-accent/45">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-card text-primary">
                      {formData.arquivo ? <Check size={18} /> : <FolderUp size={18} />}
                    </span>
                    <span className="min-w-0 text-sm text-muted-foreground">
                      {formData.arquivo ? (
                        <span className="block truncate font-semibold text-foreground">
                          {formData.arquivo.name}
                        </span>
                      ) : (
                        "Selecione um arquivo de video (MP4, WebM, etc)"
                      )}
                    </span>
                  </label>
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Duracao (mm:ss) *
                </span>
                <input
                  type="text"
                  placeholder="Ex: 25:30"
                  value={formData.duracao}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, duracao: event.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            title="Deletar videoaula"
            message={`Tem certeza que deseja deletar a videoaula "${deleteTarget?.titulo}"?`}
            confirmText="Deletar"
            cancelText="Cancelar"
            isLoading={deleting}
            isDangerous={true}
          />
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
