import React from "react";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { hasRole } from "../auth/auth";
import { useToastActions } from "../contexts/ToastContext";
import {
  FadeInUp,
  PopInBadge,
  AnimatedButton,
  AnimatedSelect,
} from "../components/animate-ui";
import {
  Search,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link as LinkIcon,
  BookOpen,
  Landmark,
  Globe,
  Trash2,
  Download,
  Plus,
  RefreshCw,
  FolderUp,
  Check,
} from "lucide-react";
import {
  listarMateriais,
  criarMaterial,
  deletarMaterial,
  type Material,
  listarModulos,
  type Modulo,
  listarTurmas,
  atribuirMaterialTurmas,
  type Turma,
} from "../services/api";

type MaterialCategoria =
  | "link"
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "imagem"
  | "texto"
  | "compactado"
  | "arquivo";

type FormatoArquivo = Exclude<MaterialCategoria, "link">;

const pageTitle = "Materiais";
const pageSubtitle = "Acesse arquivos e links de estudo";

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

const FORMATO_ARQUIVO_OPTIONS: Array<{ value: FormatoArquivo; label: string }> = [
  { value: "arquivo", label: "Qualquer arquivo" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word (DOC/DOCX)" },
  { value: "excel", label: "Excel (XLS/XLSX/CSV)" },
  { value: "powerpoint", label: "PowerPoint (PPT/PPTX)" },
  { value: "imagem", label: "Imagem (PNG/JPG/WebP/GIF)" },
  { value: "texto", label: "Texto (TXT/MD)" },
  { value: "compactado", label: "Compactado (ZIP/RAR/7Z)" },
];

const FILTER_TIPO_OPTIONS: Array<{ value: "todos" | MaterialCategoria; label: string }> = [
  { value: "todos", label: "Todos os tipos" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "powerpoint", label: "PowerPoint" },
  { value: "imagem", label: "Imagem" },
  { value: "texto", label: "Texto" },
  { value: "compactado", label: "Compactado" },
  { value: "arquivo", label: "Outros arquivos" },
  { value: "link", label: "Links" },
];

const EXT_BY_FORMAT: Record<FormatoArquivo, string[]> = {
  arquivo: [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "csv",
    "ppt",
    "pptx",
    "txt",
    "md",
    "zip",
    "rar",
    "7z",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "svg",
  ],
  pdf: ["pdf"],
  word: ["doc", "docx"],
  excel: ["xls", "xlsx", "csv"],
  powerpoint: ["ppt", "pptx"],
  imagem: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
  texto: ["txt", "md"],
  compactado: ["zip", "rar", "7z"],
};

const ACCEPT_BY_FORMAT: Record<FormatoArquivo, string> = {
  arquivo:
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.gif,.svg",
  pdf: ".pdf,application/pdf",
  word: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  excel:
    ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  powerpoint:
    ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  imagem: "image/*",
  texto: ".txt,.md,text/plain,text/markdown",
  compactado: ".zip,.rar,.7z,application/zip,application/x-rar-compressed,application/x-7z-compressed",
};

function getFileExtension(value: string): string | null {
  const noQuery = value.split("?")[0].split("#")[0];
  const ext = noQuery.split(".").pop()?.toLowerCase() ?? "";
  return ext.length > 0 && ext !== noQuery.toLowerCase() ? ext : null;
}

function getMaterialCategoria(material: Material): MaterialCategoria {
  if (material.tipo === "link") return "link";
  const ext = getFileExtension(material.url);
  if (!ext) return "arquivo";
  if (EXT_BY_FORMAT.pdf.includes(ext)) return "pdf";
  if (EXT_BY_FORMAT.word.includes(ext)) return "word";
  if (EXT_BY_FORMAT.excel.includes(ext)) return "excel";
  if (EXT_BY_FORMAT.powerpoint.includes(ext)) return "powerpoint";
  if (EXT_BY_FORMAT.imagem.includes(ext)) return "imagem";
  if (EXT_BY_FORMAT.texto.includes(ext)) return "texto";
  if (EXT_BY_FORMAT.compactado.includes(ext)) return "compactado";
  return "arquivo";
}

function getCategoriaLabel(categoria: MaterialCategoria): string {
  if (categoria === "pdf") return "PDF";
  if (categoria === "word") return "Word";
  if (categoria === "excel") return "Excel";
  if (categoria === "powerpoint") return "PowerPoint";
  if (categoria === "imagem") return "Imagem";
  if (categoria === "texto") return "Texto";
  if (categoria === "compactado") return "Compactado";
  if (categoria === "link") return "Link";
  return "Arquivo";
}

function getCategoriaIcon(categoria: MaterialCategoria): React.ReactNode {
  if (categoria === "link") return <LinkIcon size={18} />;
  if (categoria === "excel") return <FileSpreadsheet size={18} />;
  if (categoria === "imagem") return <FileImage size={18} />;
  if (categoria === "compactado") return <FileArchive size={18} />;
  if (categoria === "pdf" || categoria === "word" || categoria === "texto") {
    return <FileText size={18} />;
  }
  return <File size={18} />;
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

export default function MateriaisPage() {
  const canUpload = hasRole(["admin", "professor"]);
  const { addToast } = useToastActions();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  );

  const [materiais, setMateriais] = React.useState<Material[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [totalItems, setTotalItems] = React.useState(0);

  const [filtroModulo, setFiltroModulo] = React.useState<string>("todos");
  const [buscaModuloFiltro, setBuscaModuloFiltro] = React.useState<string>("");
  const [showSugestoesModuloFiltro, setShowSugestoesModuloFiltro] = React.useState(false);
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | MaterialCategoria>("todos");
  const [busca, setBusca] = React.useState<string>("");
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>("todas");
  const [modalAberto, setModalAberto] = React.useState(false);

  const [formTitulo, setFormTitulo] = React.useState("");
  const [formModuloId, setFormModuloId] = React.useState("");
  const [buscaModuloForm, setBuscaModuloForm] = React.useState("");
  const [showSugestoesModuloForm, setShowSugestoesModuloForm] = React.useState(false);
  const [formTipo, setFormTipo] = React.useState<"arquivo" | "link">("arquivo");
  const [formFormatoArquivo, setFormFormatoArquivo] = React.useState<FormatoArquivo>("arquivo");
  const [formDescricao, setFormDescricao] = React.useState("");
  const [formUrl, setFormUrl] = React.useState("");
  const [formArquivo, setFormArquivo] = React.useState<File | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Material | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const deferredBusca = React.useDeferredValue(busca);
  const moduloQuery = React.useMemo(() => {
    if (filtroModulo !== "todos") return filtroModulo;
    const termo = buscaModuloFiltro.trim();
    return termo.length > 0 ? termo : undefined;
  }, [buscaModuloFiltro, filtroModulo]);

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

  const carregarMateriais = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await listarMateriais({
        modulo: moduloQuery,
        q: deferredBusca.trim() || undefined,
        tipo: filtroTipo,
        page: currentPage,
        limit: itemsPerPage,
      });

      setMateriais(response.items);
      setTotalItems(response.total);
      const lastPage = Math.max(1, response.pagination.totalPages);
      if (currentPage > lastPage) {
        setCurrentPage(lastPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar materiais");
    } finally {
      setLoading(false);
    }
  }, [currentPage, deferredBusca, filtroTipo, itemsPerPage, moduloQuery]);

  React.useEffect(() => {
    void carregarMateriais();
  }, [carregarMateriais]);

  const modulos = Array.from(
    new Set([
      ...materiais.map((material) => material.modulo).filter(Boolean),
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

  const resetForm = () => {
    setFormTitulo("");
    setFormModuloId("");
    setBuscaModuloForm("");
    setShowSugestoesModuloForm(false);
    setFormTipo("arquivo");
    setFormFormatoArquivo("arquivo");
    setFormDescricao("");
    setFormUrl("");
    setFormArquivo(null);
    setTurmasSelecionadas([]);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleArquivoChange = (file: File | null) => {
    if (!file) {
      setFormArquivo(null);
      return;
    }

    const ext = getFileExtension(file.name);
    const allowedExtensions = EXT_BY_FORMAT[formFormatoArquivo];
    if (formFormatoArquivo !== "arquivo" && (!ext || !allowedExtensions.includes(ext))) {
      setFormError(
        `Arquivo incompativel com o formato selecionado (${getCategoriaLabel(formFormatoArquivo)}).`
      );
      setFormArquivo(null);
      return;
    }

    setFormError(null);
    setFormArquivo(file);
  };

  const handleSubmit = async () => {
    setFormError(null);

    const moduloIdSelecionado = formModuloId.trim();
    const moduloDigitado = buscaModuloForm.trim().toLowerCase();
    const moduloEncontrado =
      moduloIdSelecionado ||
      modulosDisponiveis.find((modulo) => modulo.nome.toLowerCase() === moduloDigitado)?.id ||
      modulosDisponiveis.find((modulo) => modulo.nome.toLowerCase().includes(moduloDigitado))
        ?.id ||
      "";

    if (!formTitulo.trim() || !moduloEncontrado) {
      setFormError("Preencha todos os campos obrigatorios.");
      return;
    }

    if (formTipo === "arquivo" && !formArquivo) {
      setFormError("Selecione um arquivo para fazer upload.");
      return;
    }

    if (formTipo === "link" && !formUrl.trim()) {
      setFormError("Forneca uma URL para o link.");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("titulo", formTitulo);
      formData.append("tipo", formTipo);
      formData.append("moduloId", moduloEncontrado);
      if (formDescricao.trim()) {
        formData.append("descricao", formDescricao);
      }

      if (formTipo === "arquivo" && formArquivo) {
        formData.append("file", formArquivo);
      } else if (formTipo === "link") {
        formData.append("url", formUrl);
      }

      if (turmasSelecionadas.length > 0) {
        formData.append("turma_ids", JSON.stringify(turmasSelecionadas));
      }

      const resultado = await criarMaterial(formData);

      if (turmasSelecionadas.length > 0 && resultado.material?.id) {
        try {
          await atribuirMaterialTurmas(resultado.material.id, turmasSelecionadas);
        } catch (err) {
          console.error("Erro ao atribuir turmas:", err);
        }
      }

      setModalAberto(false);
      resetForm();
      addToast("Material adicionado com sucesso.", "success");
      await carregarMateriais();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Erro ao adicionar material", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;

    try {
      setDeleting(true);
      await deletarMaterial(target.id);
      setDeleteTarget(null);
      addToast(`"${target.titulo}" foi removido.`, "success");
      await carregarMateriais();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Erro ao deletar material", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (material: Material) => {
    window.open(material.url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>
        <div className="flex flex-col gap-6">
          <div className={cn(surfaceCardClass, "p-4 sm:p-5")}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.8fr))]">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`materiais-filter-skeleton-${index}`}
                  className="h-12 animate-pulse rounded-2xl border border-border/70 bg-muted/50"
                />
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`material-skeleton-${index}`}
                className="h-[280px] animate-pulse rounded-[28px] border border-border/70 bg-card/80"
              />
            ))}
          </div>
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
                Nao foi possivel carregar os materiais
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
            <AnimatedButton className={primaryButtonClass} onClick={() => void carregarMateriais()}>
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
                    placeholder="Buscar materiais..."
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
                    setFiltroTipo(event.target.value as "todos" | MaterialCategoria);
                    setCurrentPage(1);
                  }}
                  className={cn(fieldClass, "appearance-none pr-10")}
                >
                  {FILTER_TIPO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
                <AnimatedButton
                  className={primaryButtonClass}
                  onClick={() => {
                    setModalAberto(true);
                    setFormError(null);
                  }}
                >
                  {iconLabel(<Plus size={16} />, "Adicionar material")}
                </AnimatedButton>
              ) : null}
            </div>
          </div>

          {totalItems === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border/80 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.09),transparent_44%)] bg-muted/35 px-6 py-16 text-center shadow-[0_18px_44px_rgba(0,0,0,0.12)]">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-[0_16px_36px_rgba(0,0,0,0.2)]">
                  <BookOpen size={24} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-[-0.02em] text-foreground">
                    {!hasAnyFiltro ? "Nenhum material disponivel" : "Nenhum material encontrado"}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {!hasAnyFiltro
                      ? "Em breve novos materiais de estudo serao adicionados."
                      : "Tente ajustar sua busca ou os filtros da listagem."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {materiais.map((material, index) => {
                  const categoria = getMaterialCategoria(material);

                  return (
                    <FadeInUp key={material.id} delay={index * 0.05}>
                      <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent)] bg-card shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_22px_50px_rgba(225,29,46,0.18)]">
                        <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
                          <div className="flex items-start gap-4">
                            <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border/70 bg-[linear-gradient(135deg,rgba(225,29,46,0.14),rgba(59,130,246,0.14))] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                              {getCategoriaIcon(categoria)}
                            </div>

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
                                  {material.modulo}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground">
                                  {getCategoriaLabel(categoria)}
                                </span>
                              </div>

                              <h3 className="text-lg font-black leading-tight tracking-[-0.02em] text-foreground">
                                {material.titulo}
                              </h3>

                              <span className="text-xs font-medium text-muted-foreground">
                                {formatDate(material.createdAt)}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                            {material.descricao || "Sem descricao cadastrada."}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {material.turmas && material.turmas.length > 0 ? (
                              <>
                                <PopInBadge delay={0.1}>
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/12 px-3 py-1 text-[11px] font-semibold text-sky-300">
                                    {iconLabel(
                                      <Landmark size={12} />,
                                      `${material.turmas.length} turma${material.turmas.length > 1 ? "s" : ""}`
                                    )}
                                  </span>
                                </PopInBadge>
                                {material.turmas.map((turma, turmaIndex) => (
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

                          <div className="mt-auto flex items-center gap-2 border-t border-border/70 pt-4">
                            <AnimatedButton
                              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(225,29,46,0.22)] transition disabled:cursor-not-allowed disabled:opacity-65"
                              onClick={() => handleDownload(material)}
                            >
                              {material.tipo === "arquivo"
                                ? iconLabel(<Download size={16} />, "Baixar")
                                : iconLabel(<LinkIcon size={16} />, "Abrir link")}
                            </AnimatedButton>

                            {canUpload ? (
                              <AnimatedButton
                                onClick={() => setDeleteTarget(material)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-red-300 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Deletar"
                              >
                                <Trash2 size={16} />
                              </AnimatedButton>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </FadeInUp>
                  );
                })}
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
            isOpen={modalAberto && canUpload}
            onClose={() => {
              setModalAberto(false);
              resetForm();
            }}
            title="Adicionar novo material"
            size="lg"
            footer={
              <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <AnimatedButton
                  onClick={() => {
                    setModalAberto(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  className={secondaryButtonClass}
                >
                  Cancelar
                </AnimatedButton>
                <AnimatedButton
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  loading={submitting}
                  className={primaryButtonClass}
                >
                  Salvar material
                </AnimatedButton>
              </div>
            }
          >
            <div className="space-y-5">
              {formError ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                  {formError}
                </div>
              ) : null}

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Titulo *
                </span>
                <input
                  type="text"
                  placeholder="Titulo do material"
                  className={fieldClass}
                  value={formTitulo}
                  onChange={(event) => setFormTitulo(event.target.value)}
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
                    className={fieldClass}
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
                      setFormModuloId("");
                      setShowSugestoesModuloForm(true);
                      if (formError) setFormError(null);
                    }}
                  />
                  {showSugestoesModuloForm && modulosFiltradosNoForm.length > 0 ? (
                    <div className={suggestionPanelClass}>
                      {modulosFiltradosNoForm.map((modulo) => (
                        <button
                          key={modulo.id}
                          type="button"
                          onClick={() => {
                            setFormModuloId(modulo.id);
                            setBuscaModuloForm(modulo.nome);
                            setShowSugestoesModuloForm(false);
                            if (formError) setFormError(null);
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
                <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Tipo de material">
                  <button
                    type="button"
                    className={typeOptionClass(formTipo === "arquivo")}
                    onClick={() => {
                      setFormTipo("arquivo");
                      setFormUrl("");
                    }}
                  >
                    {iconLabel(<FileText size={16} />, "Arquivo")}
                  </button>
                  <button
                    type="button"
                    className={typeOptionClass(formTipo === "link")}
                    onClick={() => {
                      setFormTipo("link");
                      setFormArquivo(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    {iconLabel(<LinkIcon size={16} />, "Link")}
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Descricao
                </span>
                <textarea
                  placeholder="Descricao do material"
                  className={textareaClass}
                  rows={4}
                  value={formDescricao}
                  onChange={(event) => setFormDescricao(event.target.value)}
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

              {formTipo === "arquivo" ? (
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Formato do arquivo
                    </span>
                    <select
                      className={fieldClass}
                      value={formFormatoArquivo}
                      onChange={(event) => {
                        setFormFormatoArquivo(event.target.value as FormatoArquivo);
                        setFormArquivo(null);
                        setFormError(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      {FORMATO_ARQUIVO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Selecione um formato especifico para restringir os arquivos permitidos.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Arquivo *
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_BY_FORMAT[formFormatoArquivo]}
                      className="sr-only"
                      onChange={(event) => handleArquivoChange(event.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col gap-3 rounded-[24px] border-2 border-dashed border-border/80 bg-muted/35 p-4 transition hover:border-primary/35 hover:bg-accent/45 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-card text-primary">
                          {formArquivo ? <Check size={18} /> : <FolderUp size={18} />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {formArquivo?.name || "Nenhum arquivo selecionado"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Formatos aceitos: {getCategoriaLabel(formFormatoArquivo)}
                          </p>
                        </div>
                      </div>

                      <AnimatedButton
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-border/80 bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Procurar
                      </AnimatedButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    URL *
                  </span>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/recurso"
                    className={fieldClass}
                    value={formUrl}
                    onChange={(event) => setFormUrl(event.target.value)}
                  />
                </div>
              )}
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            title="Deletar material"
            message={`Tem certeza que deseja deletar o material "${deleteTarget?.titulo}"?`}
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
