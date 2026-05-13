import React from "react";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAction } from "@/components/ui/icon-action";
import { usePersistedListParams } from "@/hooks/use-persisted-list-params";
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
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listarMateriais,
  criarMaterial,
  deletarMaterial,
  type Material,
  listarCursos,
  type Curso,
  listarModulos,
  type Modulo,
  listarFasesDoModulo,
  listarExerciciosPorFase,
  listarTurmas,
  type Turma,
  type Fase,
  type ExercicioFase,
} from "../services/api";
import {
  collectMaterialExerciseGroups,
  type MaterialExerciseGroup,
} from "./Materiais.helpers";

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
const primaryButtonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_rgba(225,29,46,0.28)] transition disabled:cursor-not-allowed disabled:opacity-65";
const secondaryButtonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border/80 bg-muted/50 px-5 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-65";
const surfaceCardClass =
  "rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(225,29,46,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] bg-card/95 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";
const compactDropdownTriggerClass =
  "flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/75 bg-card px-4 text-left text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition hover:border-primary/35 focus:border-primary focus:ring-4 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-65";
const compactDropdownContentClass =
  "z-[70] w-[min(var(--radix-dropdown-menu-trigger-width),calc(100vw-2rem))] min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-popover p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.24)]";
const compactDropdownItemClass =
  "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-accent/70 focus:bg-accent/70 focus:outline-none";

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
  ],
  pdf: ["pdf"],
  word: ["doc", "docx"],
  excel: ["xls", "xlsx", "csv"],
  powerpoint: ["ppt", "pptx"],
  imagem: ["png", "jpg", "jpeg", "webp", "gif"],
  texto: ["txt", "md"],
  compactado: ["zip", "rar", "7z"],
};

const ACCEPT_BY_FORMAT: Record<FormatoArquivo, string> = {
  arquivo:
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.gif",
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

function MaterialExerciseSelect({
  groups,
  value,
  onChange,
  disabled,
  loading,
  placeholder,
}: {
  groups: MaterialExerciseGroup[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
}) {
  const selected = React.useMemo(() => {
    for (const group of groups) {
      for (const phase of group.phases) {
        for (const option of phase.options) {
          if (option.id === value) return option;
        }
      }
    }
    return null;
  }, [groups, value]);
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={compactDropdownTriggerClass} disabled={disabled}>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className={cn("block truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.label : placeholder}
            </span>
            {selected ? (
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {selected.moduleName} · {selected.phaseName}
              </span>
            ) : null}
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className={compactDropdownContentClass}>
        <DropdownMenuLabel className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Exercícios
        </DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Carregando exercicios...</div>
          ) : groups.length > 0 ? (
            groups.map((group, groupIndex) => {
              const visiblePhases = group.phases.filter((phase) => phase.options.length > 0);
              return (
                <div key={group.moduleId}>
                  {groupIndex > 0 ? <DropdownMenuSeparator className="mx-2 my-2" /> : null}
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {group.moduleName}
                  </div>
                  <div className="space-y-2">
                    {visiblePhases.map((phase) => (
                      <div key={phase.phaseId} className="space-y-1">
                        <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/90">
                          {phase.phaseName}
                        </div>
                        {phase.options.map((option) => (
                          <DropdownMenuItem
                            key={option.id}
                            className={compactDropdownItemClass}
                            onSelect={(event) => {
                              event.preventDefault();
                              onChange(option.id);
                              setOpen(false);
                            }}
                          >
                            <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70">
                              {value === option.id ? <Check size={11} /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{option.label}</span>
                              <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                {phase.phaseName}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sem exercicios disponiveis</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function MateriaisPage() {
  const { values: queryState, setParams } = usePersistedListParams({
    q: { defaultValue: "" as string },
    tipo: { defaultValue: "todos" as "todos" | MaterialCategoria },
    turma: { defaultValue: "todas" as string },
    page: {
      defaultValue: 1,
      parse: (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
      },
    },
    limit: {
      defaultValue: 5,
      parse: (value) => {
        const parsed = Number(value);
        return [5, 10, 20, 50].includes(parsed) ? parsed : 5;
      },
    },
  }, { pageKey: "page" });
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

  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | MaterialCategoria>(queryState.tipo);
  const [busca, setBusca] = React.useState<string>(queryState.q);
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>(queryState.turma);
  const [modalAberto, setModalAberto] = React.useState(false);

  const [formTitulo, setFormTitulo] = React.useState("");
  const [formCursoId, setFormCursoId] = React.useState("");
  const [formTipo, setFormTipo] = React.useState<"arquivo" | "link">("arquivo");
  const [formFormatoArquivo, setFormFormatoArquivo] = React.useState<FormatoArquivo>("arquivo");
  const [formDescricao, setFormDescricao] = React.useState("");
  const [formUrl, setFormUrl] = React.useState("");
  const [formArquivo, setFormArquivo] = React.useState<File | null>(null);
  const [formExerciseId, setFormExerciseId] = React.useState("");
  const [cursosDisponiveis, setCursosDisponiveis] = React.useState<Curso[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [exerciciosAgrupados, setExerciciosAgrupados] = React.useState<MaterialExerciseGroup[]>([]);
  const [loadingExercicios, setLoadingExercicios] = React.useState(false);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Material | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [currentPage, setCurrentPage] = React.useState(queryState.page);
  const [itemsPerPage, setItemsPerPage] = React.useState(queryState.limit);
  const deferredBusca = React.useDeferredValue(busca);

  React.useEffect(() => {
    if (canUpload) {
      listarCursos()
        .then(setCursosDisponiveis)
        .catch((err) => console.error("Erro ao carregar cursos:", err));
      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((err) => console.error("Erro ao carregar turmas:", err));
      listarModulos()
        .then(setModulosDisponiveis)
        .catch((err) => console.error("Erro ao carregar modulos:", err));
    }
  }, [canUpload]);

  React.useEffect(() => {
    if (busca !== queryState.q) setBusca(queryState.q);
    if (filtroTipo !== queryState.tipo) setFiltroTipo(queryState.tipo);
    if (turmaFiltro !== queryState.turma) setTurmaFiltro(queryState.turma);
    if (currentPage !== queryState.page) setCurrentPage(queryState.page);
    if (itemsPerPage !== queryState.limit) setItemsPerPage(queryState.limit);
  }, [
    busca,
    currentPage,
    filtroTipo,
    itemsPerPage,
    queryState.limit,
    queryState.page,
    queryState.q,
    queryState.tipo,
    queryState.turma,
    turmaFiltro,
  ]);

  const handleBuscaChange = React.useCallback((value: string) => {
    setBusca(value);
    setParams({ q: value, page: 1 });
  }, [setParams]);

  const handleTipoChange = React.useCallback((value: "todos" | MaterialCategoria) => {
    setFiltroTipo(value);
    setParams({ tipo: value, page: 1 });
  }, [setParams]);

  const handleTurmaFilterChange = React.useCallback((value: string) => {
    setTurmaFiltro(value);
    setParams({ turma: value, page: 1 });
  }, [setParams]);

  const handleCurrentPageChange = React.useCallback((page: number) => {
    setCurrentPage(page);
    setParams({ page }, { resetPage: false });
  }, [setParams]);

  const handleItemsPerPageChange = React.useCallback((limit: number) => {
    setItemsPerPage(limit);
    setParams({ limit, page: 1 });
  }, [setParams]);

  const copyMaterialLink = React.useCallback(async (material: Material) => {
    try {
      await navigator.clipboard.writeText(material.url);
      addToast("Link copiado com sucesso.", "success");
    } catch {
      addToast("Nao foi possivel copiar o link.", "error");
    }
  }, [addToast]);

  const filteredMateriais = React.useMemo(() => {
    if (turmaFiltro === "todas") return materiais;
    return materiais.filter((material) => material.turmas?.some((turma) => turma.id === turmaFiltro));
  }, [materiais, turmaFiltro]);

  const visibleTotalItems = filteredMateriais.length;

  React.useEffect(() => {
    if (currentPage > 1 && filteredMateriais.length === 0 && totalItems > 0) {
      handleCurrentPageChange(Math.max(1, currentPage - 1));
    }
  }, [currentPage, filteredMateriais.length, handleCurrentPageChange, totalItems]);

  React.useEffect(() => {
    if (queryState.turma === turmaFiltro) return;
  }, [queryState.turma, turmaFiltro]);

  React.useEffect(() => {
    if (queryState.tipo === filtroTipo) return;
  }, [filtroTipo, queryState.tipo]);

  React.useEffect(() => {
    if (queryState.q === busca) return;
  }, [busca, queryState.q]);

  React.useEffect(() => {
    if (queryState.page === currentPage) return;
  }, [currentPage, queryState.page]);

  React.useEffect(() => {
    if (queryState.limit === itemsPerPage) return;
  }, [itemsPerPage, queryState.limit]);

  const carregarMateriais = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await listarMateriais({
        q: deferredBusca.trim() || undefined,
        tipo: filtroTipo,
        page: currentPage,
        limit: itemsPerPage,
      });

      setMateriais(response.items);
      setTotalItems(response.total);
      const lastPage = Math.max(1, response.pagination.totalPages);
      if (currentPage > lastPage) {
        handleCurrentPageChange(lastPage);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar materiais");
    } finally {
      setLoading(false);
    }
  }, [currentPage, deferredBusca, filtroTipo, handleCurrentPageChange, itemsPerPage]);

  React.useEffect(() => {
    void carregarMateriais();
  }, [carregarMateriais]);

  React.useEffect(() => {
    if (!formCursoId) {
      setExerciciosAgrupados([]);
      setFormExerciseId("");
      setLoadingExercicios(false);
      return;
    }

    const modulosDoCurso = modulosDisponiveis.filter((modulo) => modulo.courseId === formCursoId);
    if (modulosDoCurso.length === 0) {
      setExerciciosAgrupados([]);
      setFormExerciseId("");
      setLoadingExercicios(false);
      return;
    }

    let cancelled = false;
    setLoadingExercicios(true);

    void (async () => {
      try {
        const fasesPorModulo = await Promise.all(
          modulosDoCurso.map((modulo) =>
            listarFasesDoModulo(modulo.id).catch((error) => {
              console.error("Erro ao carregar fases do modulo:", error);
              return [] as Fase[];
            })
          )
        );

        const fases = fasesPorModulo.flat();
        const exercisesByPhase = await Promise.all(
          fases.map((fase) =>
            listarExerciciosPorFase(fase.id).catch((error) => {
              console.error("Erro ao carregar exercicios da fase:", error);
              return [] as ExercicioFase[];
            })
          )
        );

        if (cancelled) return;
        const exerciseMap = new Map<string, ExercicioFase[]>();
        fases.forEach((fase, index) => {
          exerciseMap.set(fase.id, exercisesByPhase[index] ?? []);
        });
        setExerciciosAgrupados(collectMaterialExerciseGroups(modulosDoCurso, fases, exerciseMap));
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao carregar exercicios do curso:", error);
          setExerciciosAgrupados([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingExercicios(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formCursoId, modulosDisponiveis]);

  const hasAnyFiltro =
    busca.trim() !== "" ||
    filtroTipo !== "todos" ||
    turmaFiltro !== "todas";

  const resetForm = () => {
    setFormTitulo("");
    setFormCursoId("");
    setFormTipo("arquivo");
    setFormFormatoArquivo("arquivo");
    setFormDescricao("");
    setFormUrl("");
    setFormArquivo(null);
    setFormExerciseId("");
    setExerciciosAgrupados([]);
    setLoadingExercicios(false);
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

    const cursoIdSelecionado = formCursoId.trim();

    if (!formTitulo.trim() || !cursoIdSelecionado) {
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
      formData.append("courseId", cursoIdSelecionado);
      if (formDescricao.trim()) {
        formData.append("descricao", formDescricao);
      }

      if (formExerciseId.trim()) {
        formData.append("exerciseId", formExerciseId.trim());
      }

      if (formTipo === "arquivo" && formArquivo) {
        formData.append("file", formArquivo);
      } else if (formTipo === "link") {
        formData.append("url", formUrl);
      }

      await criarMaterial(formData);

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
                      handleBuscaChange(event.target.value);
                    }}
                    className={cn(fieldClass, "pl-14")}
                    style={{ paddingLeft: "3.75rem" }}
                  />
                </div>

                <AnimatedSelect
                  value={filtroTipo}
                  onChange={(event) => {
                    handleTipoChange(event.target.value as "todos" | MaterialCategoria);
                  }}
                  className={cn(fieldClass, "appearance-none pr-10")}
                >
                  {FILTER_TIPO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AnimatedSelect>

                <AnimatedSelect
                  value={turmaFiltro}
                  onChange={(event) => {
                    handleTurmaFilterChange(event.target.value);
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

          {visibleTotalItems === 0 ? (
            <EmptyState
              className="rounded-[28px] border border-dashed border-border/80 bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.09),transparent_44%)] bg-muted/35 px-6 py-16 shadow-[0_18px_44px_rgba(0,0,0,0.12)]"
              icon={<BookOpen size={24} />}
              title={!hasAnyFiltro ? "Nenhum material disponivel" : "Nenhum material encontrado"}
              description={!hasAnyFiltro
                ? "Em breve novos materiais de estudo serao adicionados."
                : "Tente ajustar sua busca ou os filtros da listagem."}
              actionLabel={!hasAnyFiltro && canUpload ? "Adicionar material" : undefined}
              onAction={!hasAnyFiltro && canUpload ? () => {
                setModalAberto(true);
                setFormError(null);
              } : undefined}
            />
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {filteredMateriais.map((material, index) => {
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

                            <div className="hidden sm:flex sm:items-center sm:gap-2">
                              <IconAction
                                label="Copiar link"
                                icon={<LinkIcon size={16} />}
                                onClick={() => {
                                  void copyMaterialLink(material);
                                }}
                              />
                              {canUpload ? (
                                <IconAction
                                  label="Excluir material"
                                  icon={<Trash2 size={16} />}
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(material)}
                                />
                              ) : null}
                            </div>
                            {canUpload ? (
                              <AnimatedButton
                                onClick={() => setDeleteTarget(material)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-red-300 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
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
                onPageChange={handleCurrentPageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
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
                  Curso *
                </span>
                <select
                  className={fieldClass}
                  value={formCursoId}
                  onChange={(event) => {
                    const nextCursoId = event.target.value;
                    setFormCursoId(nextCursoId);
                    setFormExerciseId("");
                    if (formError) setFormError(null);
                  }}
                >
                  <option value="">Selecione um curso</option>
                  {cursosDisponiveis.map((curso) => (
                    <option key={curso.id} value={curso.id}>
                      {curso.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Os exercícios abaixo são carregados a partir das fases vinculadas aos módulos deste curso.
                </p>
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
                  Exercicio do container (opcional)
                </span>
                <MaterialExerciseSelect
                  value={formExerciseId}
                  groups={exerciciosAgrupados}
                  disabled={!formCursoId || loadingExercicios}
                  loading={loadingExercicios}
                  placeholder={
                    !formCursoId
                      ? "Selecione um curso primeiro"
                        : loadingExercicios
                          ? "Carregando exercicios..."
                        : exerciciosAgrupados.length > 0
                          ? "Selecione um exercicio"
                          : "Sem exercicios disponiveis"
                  }
                  onChange={(nextValue) => {
                    setFormExerciseId(nextValue);
                    if (formError) setFormError(null);
                  }}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Selecione opcionalmente um exercicio que pertença a qualquer fase dos módulos deste curso.
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
