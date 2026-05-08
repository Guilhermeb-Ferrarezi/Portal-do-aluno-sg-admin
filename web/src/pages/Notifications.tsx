import React from "react";
import { BellRing, Copy, Loader2, Pencil, RefreshCcw, Send, Sparkles, Trash2 } from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { FadeInUp, AnimatedToast } from "../components/animate-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  atualizarTemplateNotificacao,
  criarTemplateNotificacao,
  deletarTemplateNotificacao,
  deletarDisparoNotificacao,
  dispararTemplateNotificacao,
  listarCursos,
  listarDisparosNotificacao,
  listarTemplatesNotificacao,
  listarTurmas,
  listarUsuariosPaginado,
  type Curso,
  type NotificationDispatch,
  type NotificationTemplate,
  type Turma,
  type User,
} from "../services/api";

const allowedPlaceholders = [
  "{{aluno.nome}}",
  "{{aluno.email}}",
  "{{turma.nome}}",
  "{{curso.nome}}",
];

const TEMPLATE_DRAFT_STORAGE_KEY = "notifications-template-draft-v1";

type PlaceholderField = "titulo" | "mensagem";

type AutocompleteState = {
  field: PlaceholderField;
  query: string;
  start: number;
  end: number;
  activeIndex: number;
} | null;

type TemplateDraft = {
  nome: string;
  tituloTemplate: string;
  mensagemTemplate: string;
  ativo: boolean;
};

type PendingDiscardAction =
  | { type: "reset" }
  | { type: "edit"; template: NotificationTemplate }
  | { type: "duplicate"; template: NotificationTemplate }
  | null;

type QuickEditDraft = {
  nome: string;
  tituloTemplate: string;
  mensagemTemplate: string;
  ativo: boolean;
};

function toggleSelection(items: number[], value: number) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizePlaceholderToken(value: string) {
  return `{{${value.replace(/^\{\{\s*|\s*\}\}$/g, "").trim()}}}`;
}

function extractTemplatePlaceholders(value: string) {
  return Array.from(value.matchAll(/\{\{\s*([a-zA-Z0-9._]+)\s*\}\}/g)).map((match) =>
    normalizePlaceholderToken(match[0])
  );
}

function buildDispatchPayload(dispatch: NotificationDispatch) {
  return {
    dispatchId: dispatch.id,
    templateId: dispatch.templateId,
    templateName: dispatch.templateName,
    actor: {
      name: dispatch.triggeredByActorName,
      email: dispatch.triggeredByActorEmail,
    },
    filters: {
      courseIds: dispatch.cursoIds,
      classIds: dispatch.turmaIds,
      studentIds: dispatch.alunoIds,
    },
    requestBody: {
      filters: {
        courseIds: dispatch.cursoIds,
        classIds: dispatch.turmaIds,
        studentIds: dispatch.alunoIds,
      },
    },
    totals: {
      totalRecipients: dispatch.totalRecipients,
      failedRecipients: dispatch.failedRecipients,
    },
    createdAt: dispatch.createdAt,
  };
}

function highlightText(value: string, query: string) {
  if (!query.trim()) {
    return value;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;

  while (start < value.length) {
    const matchIndex = normalizedValue.indexOf(normalizedQuery, start);

    if (matchIndex === -1) {
      parts.push(value.slice(start));
      break;
    }

    if (matchIndex > start) {
      parts.push(value.slice(start, matchIndex));
    }

    parts.push(
      <mark key={`${matchIndex}-${normalizedQuery}`} className="rounded bg-primary/15 px-1 text-foreground">
        {value.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>
    );

    start = matchIndex + normalizedQuery.length;
  }

  return parts;
}

function summarizeSelectedLabels(labels: string[], fallback: string) {
  if (labels.length === 0) {
    return fallback;
  }

  if (labels.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function SegmentList({
  title,
  subtitle,
  items,
  selectedIds,
  getItemId,
  getItemLabel,
  getItemMeta,
  onToggle,
  onScroll,
  footer,
}: {
  title: string;
  subtitle: string;
  items: Array<Curso | Turma | User>;
  selectedIds: number[];
  getItemId: (item: Curso | Turma | User) => number;
  getItemLabel: (item: Curso | Turma | User) => string;
  getItemMeta?: (item: Curso | Turma | User) => string | null;
  onToggle: (id: number) => void;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1" onScroll={onScroll}>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum item disponivel.
          </div>
        ) : (
          items.map((item) => {
            const itemId = getItemId(item);
            const selected = selectedIds.includes(itemId);
            const meta = getItemMeta?.(item);

            return (
              <label
                key={itemId}
                className={cn(
                  "flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 transition",
                  selected && "border-primary/40 bg-primary/5"
                )}
              >
                <Checkbox
                  className="mt-1"
                  checked={selected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onToggle(itemId);
                    } else if (selected) {
                      onToggle(itemId);
                    }
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block wrap-break-word text-sm font-semibold text-foreground">
                    {getItemLabel(item)}
                  </span>
                  {meta ? (
                    <span className="mt-1 block break-all text-xs text-muted-foreground">
                      {meta}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
        {footer}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const dispatchPageSize = 10;
  const studentsPageSize = 50;
  const panelClass = "rounded-[28px] border border-border/70 bg-card/95 shadow-sm";
  const fieldClass =
    "h-11 w-full rounded-xl border border-input bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";
  const textAreaClass =
    "min-h-32 w-full rounded-2xl border border-input bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";

  const [loading, setLoading] = React.useState(true);
  const [savingTemplate, setSavingTemplate] = React.useState(false);
  const [dispatchingId, setDispatchingId] = React.useState<number | null>(null);
  const [templates, setTemplates] = React.useState<NotificationTemplate[]>([]);
  const [dispatches, setDispatches] = React.useState<NotificationDispatch[]>([]);
  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [alunos, setAlunos] = React.useState<User[]>([]);
  const [alunosTotal, setAlunosTotal] = React.useState(0);
  const [loadingMoreAlunos, setLoadingMoreAlunos] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [nome, setNome] = React.useState("");
  const [tituloTemplate, setTituloTemplate] = React.useState("");
  const [mensagemTemplate, setMensagemTemplate] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);
  const [selectedCursoIds, setSelectedCursoIds] = React.useState<number[]>([]);
  const [selectedTurmaIds, setSelectedTurmaIds] = React.useState<number[]>([]);
  const [selectedAlunoIds, setSelectedAlunoIds] = React.useState<number[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = React.useState<number[]>([]);
  const [selectedDispatchIds, setSelectedDispatchIds] = React.useState<number[]>([]);
  const [dispatchModalOpen, setDispatchModalOpen] = React.useState(false);
  const [dispatchTemplate, setDispatchTemplate] = React.useState<NotificationTemplate | null>(null);
  const [dispatchTemplateIds, setDispatchTemplateIds] = React.useState<number[]>([]);
  const [dispatchWithoutFilters, setDispatchWithoutFilters] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<"templates" | "historico">("templates");
  const [templateSearch, setTemplateSearch] = React.useState("");
  const [dispatchSearch, setDispatchSearch] = React.useState("");
  const [dispatchTotal, setDispatchTotal] = React.useState(0);
  const [loadingMoreDispatches, setLoadingMoreDispatches] = React.useState(false);
  const [templateStatusFilter, setTemplateStatusFilter] = React.useState<"todos" | "ativos" | "inativos">("todos");
  const [templateSort, setTemplateSort] = React.useState<"recentes" | "usados" | "az">("recentes");
  const [activeEditorField, setActiveEditorField] = React.useState<PlaceholderField>("titulo");
  const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false);
  const [pendingDiscardAction, setPendingDiscardAction] = React.useState<PendingDiscardAction>(null);
  const [autocomplete, setAutocomplete] = React.useState<AutocompleteState>(null);
  const [quickEditOpen, setQuickEditOpen] = React.useState(false);
  const [quickEditTemplate, setQuickEditTemplate] = React.useState<NotificationTemplate | null>(null);
  const [quickEditDraft, setQuickEditDraft] = React.useState<QuickEditDraft>({
    nome: "",
    tituloTemplate: "",
    mensagemTemplate: "",
    ativo: true,
  });
  const [quickEditSaving, setQuickEditSaving] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [templateToDelete, setTemplateToDelete] = React.useState<NotificationTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = React.useState(false);
  const [deleteDispatchDialogOpen, setDeleteDispatchDialogOpen] = React.useState(false);
  const [dispatchToDelete, setDispatchToDelete] = React.useState<NotificationDispatch | null>(null);
  const [payloadDispatch, setPayloadDispatch] = React.useState<NotificationDispatch | null>(null);
  const [deletingDispatch, setDeletingDispatch] = React.useState(false);
  const [toast, setToast] = React.useState<{
    id: number;
    type: "success" | "error";
    message: string;
  } | null>(null);
  const templateEditorRef = React.useRef<HTMLElement | null>(null);
  const dispatchListRef = React.useRef<HTMLDivElement | null>(null);
  const tituloInputRef = React.useRef<HTMLInputElement | null>(null);
  const mensagemTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const templateDraft = React.useMemo<TemplateDraft>(
    () => ({ nome, tituloTemplate, mensagemTemplate, ativo }),
    [ativo, mensagemTemplate, nome, tituloTemplate]
  );

  const currentEditingTemplate = React.useMemo(
    () => templates.find((template) => template.id === editingId) ?? null,
    [editingId, templates]
  );

  const selectedTemplates = React.useMemo(
    () => templates.filter((template) => selectedTemplateIds.includes(template.id)),
    [selectedTemplateIds, templates]
  );

  const templateDispatchStats = React.useMemo(() => {
    const stats = new Map<number, { total: number; lastTriggeredAt: string | null }>();

    for (const dispatch of dispatches) {
      const current = stats.get(dispatch.templateId) ?? { total: 0, lastTriggeredAt: null };
      const nextLastTriggeredAt =
        !current.lastTriggeredAt || new Date(dispatch.createdAt) > new Date(current.lastTriggeredAt)
          ? dispatch.createdAt
          : current.lastTriggeredAt;

      stats.set(dispatch.templateId, {
        total: current.total + 1,
        lastTriggeredAt: nextLastTriggeredAt,
      });
    }

    return stats;
  }, [dispatches]);

  const autocompleteSuggestions = React.useMemo(() => {
    if (!autocomplete) {
      return [];
    }

    const normalizedQuery = autocomplete.query.trim().toLowerCase();
    return allowedPlaceholders.filter((placeholder) =>
      normalizedQuery.length === 0
        ? true
        : placeholder.toLowerCase().includes(normalizedQuery)
    );
  }, [autocomplete]);

  const filteredTemplates = React.useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    const filtered = templates.filter((template) => {
      const matchesQuery =
        !query ||
        [
          template.nome,
          template.tituloTemplate,
          template.mensagemTemplate,
          template.ativo ? "ativo" : "inativo",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        templateStatusFilter === "todos" ||
        (templateStatusFilter === "ativos" && template.ativo) ||
        (templateStatusFilter === "inativos" && !template.ativo);

      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((first, second) => {
      if (templateSort === "az") {
        return first.nome.localeCompare(second.nome, "pt-BR");
      }

      if (templateSort === "usados") {
        const firstStats = templateDispatchStats.get(first.id)?.total ?? 0;
        const secondStats = templateDispatchStats.get(second.id)?.total ?? 0;

        if (secondStats !== firstStats) {
          return secondStats - firstStats;
        }
      }

      return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
    });
  }, [templateSearch, templateSort, templateStatusFilter, templateDispatchStats, templates]);

  const hasMoreDispatches = dispatches.length < dispatchTotal;
  const hasMoreAlunos = alunos.length < alunosTotal;

  const templateValidation = React.useMemo(() => {
    const tokens = [...extractTemplatePlaceholders(tituloTemplate), ...extractTemplatePlaceholders(mensagemTemplate)];
    const invalidPlaceholders = Array.from(
      new Set(tokens.filter((placeholder) => !allowedPlaceholders.includes(placeholder)))
    );
    const hasUnclosedPlaceholder =
      tituloTemplate.includes("{{") && !tituloTemplate.includes("}}") ||
      mensagemTemplate.includes("{{") && !mensagemTemplate.includes("}}") ||
      (tituloTemplate.match(/\{\{/g)?.length ?? 0) !== (tituloTemplate.match(/\}\}/g)?.length ?? 0) ||
      (mensagemTemplate.match(/\{\{/g)?.length ?? 0) !== (mensagemTemplate.match(/\}\}/g)?.length ?? 0);

    return {
      invalidPlaceholders,
      hasUnclosedPlaceholder,
      hasErrors: invalidPlaceholders.length > 0 || hasUnclosedPlaceholder,
    };
  }, [mensagemTemplate, tituloTemplate]);

  const previewValues = React.useMemo<Record<string, string>>(
    () => ({
      "{{aluno.nome}}": "Guilherme",
      "{{aluno.email}}": "guilherme@exemplo.com",
      "{{turma.nome}}": "FullStack 2026.1",
      "{{curso.nome}}": "Curso FullStack",
    }),
    []
  );

  const previewTitle = React.useMemo(() => {
    return allowedPlaceholders.reduce(
      (current, placeholder) => current.replaceAll(placeholder, previewValues[placeholder]),
      tituloTemplate || "Seu titulo vai aparecer aqui"
    );
  }, [previewValues, tituloTemplate]);

  const previewMessage = React.useMemo(() => {
    return allowedPlaceholders.reduce(
      (current, placeholder) => current.replaceAll(placeholder, previewValues[placeholder]),
      mensagemTemplate || "Sua mensagem vai aparecer aqui"
    );
  }, [mensagemTemplate, previewValues]);

  const quickEditValidation = React.useMemo(() => {
    const tokens = [
      ...extractTemplatePlaceholders(quickEditDraft.tituloTemplate),
      ...extractTemplatePlaceholders(quickEditDraft.mensagemTemplate),
    ];
    const invalidPlaceholders = Array.from(
      new Set(tokens.filter((placeholder) => !allowedPlaceholders.includes(placeholder)))
    );
    const hasUnclosedPlaceholder =
      (quickEditDraft.tituloTemplate.match(/\{\{/g)?.length ?? 0) !==
        (quickEditDraft.tituloTemplate.match(/\}\}/g)?.length ?? 0) ||
      (quickEditDraft.mensagemTemplate.match(/\{\{/g)?.length ?? 0) !==
        (quickEditDraft.mensagemTemplate.match(/\}\}/g)?.length ?? 0);

    return {
      invalidPlaceholders,
      hasUnclosedPlaceholder,
      hasErrors: invalidPlaceholders.length > 0 || hasUnclosedPlaceholder,
    };
  }, [quickEditDraft]);

  const isDirty = React.useMemo(() => {
    if (currentEditingTemplate) {
      return (
        nome !== currentEditingTemplate.nome ||
        tituloTemplate !== currentEditingTemplate.tituloTemplate ||
        mensagemTemplate !== currentEditingTemplate.mensagemTemplate ||
        ativo !== currentEditingTemplate.ativo
      );
    }

    return nome !== "" || tituloTemplate !== "" || mensagemTemplate !== "" || ativo !== true;
  }, [ativo, currentEditingTemplate, mensagemTemplate, nome, tituloTemplate]);

  const canConfirmDispatch =
    dispatchWithoutFilters ||
    selectedCursoIds.length > 0 ||
    selectedTurmaIds.length > 0 ||
    selectedAlunoIds.length > 0;

  const showToast = React.useCallback((type: "success" | "error", message: string) => {
    setToast({
      id: Date.now() + Math.floor(Math.random() * 1000),
      type,
      message,
    });
  }, []);

  const loadDispatches = React.useCallback(
    async ({ reset, offset }: { reset: boolean; offset?: number }) => {
      const nextOffset = reset ? 0 : (offset ?? 0);
      const response = await listarDisparosNotificacao({
        limit: dispatchPageSize,
        offset: nextOffset,
        q: dispatchSearch,
      });

      setDispatchTotal(response.total);
      setDispatches((current) => (reset ? response.items : [...current, ...response.items]));
    },
    [dispatchSearch]
  );

  const loadAlunos = React.useCallback(
    async ({ reset }: { reset: boolean }) => {
      const nextPage = reset ? 1 : Math.floor(alunos.length / studentsPageSize) + 1;
      const response = await listarUsuariosPaginado({
        page: nextPage,
        limit: studentsPageSize,
      });

      setAlunosTotal(response.total);
      setAlunos((current) => (reset ? response.items : [...current, ...response.items]));
    },
    [alunos.length]
  );

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [templateResponse, cursosData, turmasData, alunosData] =
        await Promise.all([
          listarTemplatesNotificacao(),
          listarCursos(),
          listarTurmas(),
          listarUsuariosPaginado({
            page: 1,
            limit: studentsPageSize,
          }),
        ]);

      setTemplates(templateResponse.items);
      setCursos(cursosData as Curso[]);
      setTurmas(turmasData as Turma[]);
      setAlunos(alunosData.items);
      setAlunosTotal(alunosData.total);
      setDispatches([]);
      setDispatchTotal(0);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Erro ao carregar notificacoes");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawDraft = window.localStorage.getItem(TEMPLATE_DRAFT_STORAGE_KEY);

    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as TemplateDraft;
      setNome(draft.nome ?? "");
      setTituloTemplate(draft.tituloTemplate ?? "");
      setMensagemTemplate(draft.mensagemTemplate ?? "");
      setAtivo(draft.ativo ?? true);
    } catch {
      window.localStorage.removeItem(TEMPLATE_DRAFT_STORAGE_KEY);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isDirty) {
      window.localStorage.removeItem(TEMPLATE_DRAFT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(TEMPLATE_DRAFT_STORAGE_KEY, JSON.stringify(templateDraft));
  }, [isDirty, templateDraft]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  React.useEffect(() => {
    if (dispatchListRef.current) {
      dispatchListRef.current.scrollTop = 0;
    }
  }, [dispatchSearch, activeSection]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    setDispatches([]);
    setDispatchTotal(0);

    void loadDispatches({ reset: true }).catch((error) => {
      showToast("error", error instanceof Error ? error.message : "Erro ao carregar disparos");
    });
  }, [dispatchSearch, loadDispatches, loading, showToast]);

  function scrollToTemplateEditor() {
    requestAnimationFrame(() => {
      const element = templateEditorRef.current;
      if (!element || typeof window === "undefined") {
        return;
      }

      const stickyHeaderOffset = 112;
      const nextTop =
        element.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset;

      window.scrollTo({
        top: Math.max(nextTop, 0),
        behavior: "smooth",
      });
    });
  }

  function applyResetForm() {
    setEditingId(null);
    setNome("");
    setTituloTemplate("");
    setMensagemTemplate("");
    setAtivo(true);
    setAutocomplete(null);
  }

  function applyEdit(template: NotificationTemplate) {
    setEditingId(template.id);
    setNome(template.nome);
    setTituloTemplate(template.tituloTemplate);
    setMensagemTemplate(template.mensagemTemplate);
    setAtivo(template.ativo);
    setAutocomplete(null);
    scrollToTemplateEditor();
  }

  function applyDuplicate(template: NotificationTemplate) {
    setEditingId(null);
    setNome(`${template.nome}-copia`);
    setTituloTemplate(template.tituloTemplate);
    setMensagemTemplate(template.mensagemTemplate);
    setAtivo(template.ativo);
    setAutocomplete(null);
  }

  function requestDiscardConfirmation(action: PendingDiscardAction) {
    if (!isDirty) {
      if (!action) {
        return;
      }

      if (action.type === "reset") {
        applyResetForm();
      }

      if (action.type === "edit") {
        applyEdit(action.template);
      }

      if (action.type === "duplicate") {
        applyDuplicate(action.template);
        scrollToTemplateEditor();
      }

      return;
    }

    setPendingDiscardAction(action);
    setDiscardDialogOpen(true);
  }

  function handleDiscardConfirm() {
    if (!pendingDiscardAction) {
      setDiscardDialogOpen(false);
      return;
    }

    if (pendingDiscardAction.type === "reset") {
      applyResetForm();
    }

    if (pendingDiscardAction.type === "edit") {
      applyEdit(pendingDiscardAction.template);
    }

    if (pendingDiscardAction.type === "duplicate") {
      applyDuplicate(pendingDiscardAction.template);
    }

    setPendingDiscardAction(null);
    setDiscardDialogOpen(false);
  }

  function handleDiscardCancel() {
    setPendingDiscardAction(null);
    setDiscardDialogOpen(false);
  }

  function resetForm() {
    requestDiscardConfirmation({ type: "reset" });
  }

  function handleEdit(template: NotificationTemplate) {
    requestDiscardConfirmation({ type: "edit", template });
  }

  function handleDuplicate(template: NotificationTemplate) {
    requestDiscardConfirmation({ type: "duplicate", template });
  }

  function openQuickEdit(template: NotificationTemplate) {
    setQuickEditTemplate(template);
    setQuickEditDraft({
      nome: template.nome,
      tituloTemplate: template.tituloTemplate,
      mensagemTemplate: template.mensagemTemplate,
      ativo: template.ativo,
    });
    setQuickEditOpen(true);
  }

  function closeQuickEdit() {
    if (quickEditSaving) {
      return;
    }

    setQuickEditOpen(false);
    setQuickEditTemplate(null);
  }

  function openDeleteDialog(template: NotificationTemplate) {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    if (deletingTemplate) {
      return;
    }

    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  }

  function resetDispatchState() {
    setDispatchModalOpen(false);
    setDispatchTemplate(null);
    setDispatchTemplateIds([]);
    setDispatchWithoutFilters(false);
    setSelectedCursoIds([]);
    setSelectedTurmaIds([]);
    setSelectedAlunoIds([]);
  }

  function handleToggleDispatchSelection(dispatchId: number, checked: boolean) {
    setSelectedDispatchIds((current) =>
      checked ? (current.includes(dispatchId) ? current : [...current, dispatchId]) : current.filter((id) => id !== dispatchId)
    );
  }

  function handleToggleAllVisibleDispatches(checked: boolean) {
    const visibleDispatchIds = dispatches.map((dispatch) => dispatch.id);
    setSelectedDispatchIds((current) =>
      checked
        ? Array.from(new Set([...current, ...visibleDispatchIds]))
        : current.filter((id) => !visibleDispatchIds.includes(id))
    );
  }

  function openDispatchModal(template: NotificationTemplate) {
    setDispatchTemplate(template);
    setDispatchTemplateIds([template.id]);
    setDispatchWithoutFilters(false);
    setSelectedCursoIds([]);
    setSelectedTurmaIds([]);
    setSelectedAlunoIds([]);
    setDispatchModalOpen(true);
  }

  function openBulkDispatchModal() {
    if (selectedTemplateIds.length === 0) {
      return;
    }

    setDispatchTemplate(null);
    setDispatchTemplateIds(selectedTemplateIds);
    setDispatchWithoutFilters(false);
    setSelectedCursoIds([]);
    setSelectedTurmaIds([]);
    setSelectedAlunoIds([]);
    setDispatchModalOpen(true);
  }

  function handleDispatchListScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom > 80 || loadingMoreDispatches || !hasMoreDispatches || loading) {
      return;
    }

    setLoadingMoreDispatches(true);
    void loadDispatches({ reset: false, offset: dispatches.length })
      .catch((error) => {
        showToast("error", error instanceof Error ? error.message : "Erro ao carregar mais disparos");
      })
      .finally(() => {
        setLoadingMoreDispatches(false);
      });
  }

  function handleStudentsListScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom > 80 || loadingMoreAlunos || !hasMoreAlunos) {
      return;
    }

    setLoadingMoreAlunos(true);
    void loadAlunos({ reset: false })
      .catch((error) => {
        showToast("error", error instanceof Error ? error.message : "Erro ao carregar mais alunos");
      })
      .finally(() => {
        setLoadingMoreAlunos(false);
      });
  }

  async function loadAllRecipientIds() {
    const ids: number[] = [];
    let page = 1;
    let total = 0;

    do {
      const response = await listarUsuariosPaginado({
        page,
        limit: 100,
      });

      ids.push(...response.items.map((user) => Number(user.id)));
      total = response.total;
      page += 1;
    } while (ids.length < total);

    return ids;
  }

  function updateAutocomplete(field: PlaceholderField, value: string, caretPosition: number | null) {
    if (caretPosition === null) {
      setAutocomplete(null);
      return;
    }

    const textBeforeCaret = value.slice(0, caretPosition);
    const match = textBeforeCaret.match(/\{\s*([a-zA-Z0-9._]*)$/);

    if (!match || textBeforeCaret.lastIndexOf("}") > textBeforeCaret.lastIndexOf("{")) {
      setAutocomplete(null);
      return;
    }

    const nextQuery = match[1] ?? "";
    const nextStart = caretPosition - match[0].length;
    const nextEnd = caretPosition;

    setAutocomplete((current) => {
      const shouldPreserveIndex =
        current &&
        current.field === field &&
        current.query === nextQuery &&
        current.start === nextStart &&
        current.end === nextEnd;

      return {
        field,
        query: nextQuery,
        start: nextStart,
        end: nextEnd,
        activeIndex: shouldPreserveIndex ? current.activeIndex : 0,
      };
    });
  }

  function applyPlaceholder(field: PlaceholderField, placeholder: string) {
    const target = field === "titulo" ? tituloInputRef.current : mensagemTextareaRef.current;
    const currentValue = field === "titulo" ? tituloTemplate : mensagemTemplate;

    if (!target || !autocomplete || autocomplete.field !== field) {
      return;
    }

    const nextValue =
      currentValue.slice(0, autocomplete.start) +
      placeholder +
      currentValue.slice(autocomplete.end);
    const nextCaret = autocomplete.start + placeholder.length;

    if (field === "titulo") {
      setTituloTemplate(nextValue);
    } else {
      setMensagemTemplate(nextValue);
    }

    setAutocomplete(null);

    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function insertPlaceholderIntoField(field: PlaceholderField, placeholder: string) {
    const target = field === "titulo" ? tituloInputRef.current : mensagemTextareaRef.current;
    const currentValue = field === "titulo" ? tituloTemplate : mensagemTemplate;

    if (!target) {
      return;
    }

    const start = target.selectionStart ?? currentValue.length;
    const end = target.selectionEnd ?? currentValue.length;
    const nextValue = currentValue.slice(0, start) + placeholder + currentValue.slice(end);
    const nextCaret = start + placeholder.length;

    if (field === "titulo") {
      setTituloTemplate(nextValue);
    } else {
      setMensagemTemplate(nextValue);
    }

    setAutocomplete(null);
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleAutocompleteKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: PlaceholderField
  ) {
    if (!autocomplete || autocomplete.field !== field || autocompleteSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAutocomplete((current) =>
        current && current.field === field
          ? {
              ...current,
              activeIndex: (current.activeIndex + 1) % autocompleteSuggestions.length,
            }
          : current
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setAutocomplete((current) =>
        current && current.field === field
          ? {
              ...current,
              activeIndex:
                (current.activeIndex - 1 + autocompleteSuggestions.length) %
                autocompleteSuggestions.length,
            }
          : current
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applyPlaceholder(field, autocompleteSuggestions[autocomplete.activeIndex] ?? autocompleteSuggestions[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setAutocomplete(null);
    }
  }

  function renderAutocomplete(field: PlaceholderField) {
    if (!autocomplete || autocomplete.field !== field || autocompleteSuggestions.length === 0) {
      return null;
    }

    return (
      <div className="absolute top-full z-20 mt-2 w-full rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Placeholders
        </div>
        <div className="space-y-1">
          {autocompleteSuggestions.map((placeholder, index) => (
            <button
              key={placeholder}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                index === autocomplete.activeIndex
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/70"
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                applyPlaceholder(field, placeholder);
              }}
            >
              <span className="font-medium">{placeholder}</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {index === autocomplete.activeIndex ? "Enter" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  async function handleSaveTemplate(event: React.FormEvent) {
    event.preventDefault();

    if (templateValidation.hasErrors) {
      showToast("error", "Corrija os placeholders invalidos antes de salvar.");
      return;
    }

    try {
      setSavingTemplate(true);

      if (editingId) {
        await atualizarTemplateNotificacao(editingId, {
          nome,
          tituloTemplate,
          mensagemTemplate,
          ativo,
        });
        showToast("success", "Template atualizado com sucesso.");
      } else {
        await criarTemplateNotificacao({
          nome,
          tituloTemplate,
          mensagemTemplate,
          ativo,
        });
        showToast("success", "Template criado com sucesso.");
      }

      applyResetForm();
      await loadData();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  }

  function handleCopyDispatchId(dispatch: NotificationDispatch) {
    void navigator.clipboard.writeText(String(dispatch.id));
    showToast("success", `ID ${dispatch.id} copiado`);
  }

  function handleCopyDispatchSummary(dispatch: NotificationDispatch) {
    const actor = dispatch.triggeredByActorName || "Administrador";
    const date = formatDateTime(dispatch.createdAt);
    const text = [
      `Template: ${dispatch.templateName}`,
      `Disparado por: ${actor}`,
      `Data: ${date}`,
      `Enviados: ${dispatch.totalRecipients}`,
      `Falhas: ${dispatch.failedRecipients}`,
      `Cursos: ${dispatch.cursoIds.length} | Turmas: ${dispatch.turmaIds.length} | Alunos: ${dispatch.alunoIds.length}`,
    ].join("\n");
    void navigator.clipboard.writeText(text);
    showToast("success", "Resumo copiado");
  }

  function handleViewDispatchPayload(dispatch: NotificationDispatch) {
    setPayloadDispatch(dispatch);
  }

  function handleCopyDispatchPayload(dispatch: NotificationDispatch) {
    void navigator.clipboard.writeText(JSON.stringify(buildDispatchPayload(dispatch), null, 2));
    showToast("success", "Payload copiado");
  }

  function handleViewDispatchTemplate(dispatch: NotificationDispatch) {
    setActiveSection("templates");
    setTemplateSearch(dispatch.templateName);
  }

  async function handleDeleteDispatch() {
    const idsToDelete = dispatchToDelete ? [dispatchToDelete.id] : selectedDispatchIds;
    if (idsToDelete.length === 0) return;
    try {
      setDeletingDispatch(true);
      await Promise.all(idsToDelete.map((id) => deletarDisparoNotificacao(id)));
      setDispatches((prev) => prev.filter((d) => !idsToDelete.includes(d.id)));
      setDispatchTotal((prev) => Math.max(0, prev - idsToDelete.length));
      setSelectedDispatchIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      showToast(
        "success",
        idsToDelete.length === 1 ? "Disparo excluido com sucesso." : `${idsToDelete.length} disparos excluidos com sucesso.`
      );
      setDeleteDispatchDialogOpen(false);
      setDispatchToDelete(null);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Erro ao excluir disparo");
    } finally {
      setDeletingDispatch(false);
    }
  }

  async function handleDispatch() {
    if (dispatchTemplateIds.length === 0) {
      return;
    }

    try {
      setDispatchingId(dispatchTemplate ? dispatchTemplate.id : -1);
      const explicitRecipientIds = dispatchWithoutFilters
        ? await loadAllRecipientIds()
        : selectedAlunoIds;
      const payload = {
        cursoIds: selectedCursoIds,
        turmaIds: selectedTurmaIds,
        alunoIds: explicitRecipientIds,
      };

      const results = await Promise.all(
        dispatchTemplateIds.map((templateId) => dispararTemplateNotificacao(templateId, payload))
      );

      const totalRecipients = results.reduce((sum, result) => {
        const count = Number(result.dispatch.totalRecipients);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0);

      showToast(
        "success",
        dispatchTemplateIds.length === 1
          ? `Disparo concluido para ${totalRecipients} destinatarios.`
          : `${dispatchTemplateIds.length} templates enviados para ${totalRecipients} destinatarios no total.`
      );
      resetDispatchState();
      setSelectedTemplateIds([]);
      await loadData();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Erro ao disparar template");
    } finally {
      setDispatchingId((current) =>
        dispatchTemplate ? (current === dispatchTemplate.id ? null : current) : null
      );
    }
  }

  async function handleQuickEditSave() {
    if (!quickEditTemplate) {
      return;
    }

    if (quickEditValidation.hasErrors) {
      showToast("error", "Corrija os placeholders invalidos antes de salvar.");
      return;
    }

    try {
      setQuickEditSaving(true);
      await atualizarTemplateNotificacao(quickEditTemplate.id, quickEditDraft);

      if (editingId === quickEditTemplate.id) {
        setNome(quickEditDraft.nome);
        setTituloTemplate(quickEditDraft.tituloTemplate);
        setMensagemTemplate(quickEditDraft.mensagemTemplate);
        setAtivo(quickEditDraft.ativo);
      }

      showToast("success", "Template atualizado com sucesso.");
      closeQuickEdit();
      await loadData();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Erro ao atualizar template");
    } finally {
      setQuickEditSaving(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!templateToDelete) {
      return;
    }

    try {
      setDeletingTemplate(true);
      await deletarTemplateNotificacao(templateToDelete.id);

      if (editingId === templateToDelete.id) {
        applyResetForm();
      }

      if (dispatchTemplate?.id === templateToDelete.id) {
        resetDispatchState();
      }

      showToast("success", "Template excluido com sucesso.");
      closeDeleteDialog();
      await loadData();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Erro ao excluir template");
    } finally {
      setDeletingTemplate(false);
    }
  }

  const selectedRecipientsCount =
    selectedCursoIds.length + selectedTurmaIds.length + selectedAlunoIds.length;
  const selectedCursoLabels = React.useMemo(
    () =>
      cursos
        .filter((curso) => selectedCursoIds.includes(Number(curso.id)))
        .map((curso) => curso.nome),
    [cursos, selectedCursoIds]
  );
  const selectedTurmaLabels = React.useMemo(
    () =>
      turmas
        .filter((turma) => selectedTurmaIds.includes(Number(turma.id)))
        .map((turma) => turma.nome),
    [selectedTurmaIds, turmas]
  );
  const selectedAlunoLabels = React.useMemo(
    () =>
      alunos
        .filter((aluno) => selectedAlunoIds.includes(Number(aluno.id)))
        .map((aluno) => aluno.nome),
    [alunos, selectedAlunoIds]
  );
  const dispatchSelectionSummary = React.useMemo(
    () => [
      {
        label: "Templates",
        value:
          dispatchTemplate?.nome ??
          (selectedTemplates.length > 0
            ? summarizeSelectedLabels(
                selectedTemplates.map((template) => template.nome),
                "Nenhum template"
              )
            : "Nenhum template"),
      },
      {
        label: "Modo",
        value: dispatchWithoutFilters ? "Todos os usuarios" : "Segmentado por filtros",
      },
      {
        label: "Cursos",
        value: summarizeSelectedLabels(selectedCursoLabels, "Sem filtro"),
      },
      {
        label: "Turmas",
        value: summarizeSelectedLabels(selectedTurmaLabels, "Sem filtro"),
      },
      {
        label: "Usuarios",
        value: summarizeSelectedLabels(selectedAlunoLabels, "Sem filtro"),
      },
    ],
    [
      dispatchTemplate,
      dispatchWithoutFilters,
      selectedAlunoLabels,
      selectedCursoLabels,
      selectedTemplates,
      selectedTurmaLabels,
    ]
  );

  return (
    <DashboardLayout
      title="Notificacoes"
      subtitle="Crie templates e dispare comunicados para o portal do aluno"
    >
      <FadeInUp duration={0.28}>
        <div className="space-y-6">
          <AnimatedToast
            key={toast?.id ?? "toast-empty"}
            message={toast?.message || null}
            type={toast?.type || "success"}
            duration={3000}
            onClose={() => setToast(null)}
          />

          <section ref={templateEditorRef} className={`${panelClass} overflow-hidden p-6 sm:p-7`}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_330px]">
              <div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BellRing size={20} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      Central de templates
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Os placeholders sao resolvidos por aluno no backend do portal do aluno.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveTemplate} className="mt-6 grid gap-5">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Nome interno do template
                      </span>
                      <Input
                        className={fieldClass}
                        value={nome}
                        onChange={(event) => setNome(event.target.value)}
                        placeholder="ex: boas-vindas-turma-java"
                        required
                      />
                    </label>

                    <label className="relative flex flex-col gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Titulo template
                      </span>
                      <Input
                        ref={tituloInputRef}
                        className={fieldClass}
                        value={tituloTemplate}
                        onFocus={() => setActiveEditorField("titulo")}
                        onChange={(event) => {
                          const { value, selectionStart } = event.target;
                          setTituloTemplate(value);
                          updateAutocomplete("titulo", value, selectionStart);
                        }}
                        onClick={(event) =>
                          updateAutocomplete("titulo", event.currentTarget.value, event.currentTarget.selectionStart)
                        }
                        onKeyUp={(event) => {
                          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
                            return;
                          }
                          updateAutocomplete("titulo", event.currentTarget.value, event.currentTarget.selectionStart);
                        }}
                        onKeyDown={(event) => handleAutocompleteKeyDown(event, "titulo")}
                        onBlur={() => {
                          window.setTimeout(() => setAutocomplete((current) => (current?.field === "titulo" ? null : current)), 120);
                        }}
                        placeholder="Ola {{aluno.nome}}, temos um aviso"
                        required
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{tituloTemplate.length} caracteres</span>
                        <span>{activeEditorField === "titulo" ? "Campo ativo para atalhos" : " "}</span>
                      </div>
                      {renderAutocomplete("titulo")}
                    </label>
                  </div>

                  <label className="relative flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Mensagem template</span>
                    <textarea
                      ref={mensagemTextareaRef}
                      className={textAreaClass}
                      value={mensagemTemplate}
                      onFocus={() => setActiveEditorField("mensagem")}
                      onChange={(event) => {
                        const { value, selectionStart } = event.target;
                        setMensagemTemplate(value);
                        updateAutocomplete("mensagem", value, selectionStart);
                      }}
                      onClick={(event) =>
                        updateAutocomplete("mensagem", event.currentTarget.value, event.currentTarget.selectionStart)
                      }
                      onKeyUp={(event) => {
                        if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
                          return;
                        }
                        updateAutocomplete("mensagem", event.currentTarget.value, event.currentTarget.selectionStart);
                      }}
                      onKeyDown={(event) => handleAutocompleteKeyDown(event, "mensagem")}
                      onBlur={() => {
                        window.setTimeout(() => setAutocomplete((current) => (current?.field === "mensagem" ? null : current)), 120);
                      }}
                      placeholder="Use placeholders como {{turma.nome}} e {{curso.nome}}."
                      required
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{mensagemTemplate.length} caracteres</span>
                      <span>{activeEditorField === "mensagem" ? "Campo ativo para atalhos" : " "}</span>
                    </div>
                    {renderAutocomplete("mensagem")}
                  </label>

                  {templateValidation.hasErrors ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                      {templateValidation.hasUnclosedPlaceholder ? (
                        <p>Existe placeholder aberto ou incompleto no template.</p>
                      ) : null}
                      {templateValidation.invalidPlaceholders.length > 0 ? (
                        <p>
                          Placeholders invalidos: {templateValidation.invalidPlaceholders.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                      Placeholders validados com sucesso.
                    </div>
                  )}

                  <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <Checkbox
                      className="mt-1"
                      checked={ativo}
                      onCheckedChange={(checked) => setAtivo(checked === true)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        Template ativo
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Templates inativos continuam no historico, mas nao podem ser disparados.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      className="h-11 rounded-xl px-4"
                      disabled={savingTemplate || templateValidation.hasErrors}
                    >
                      {savingTemplate ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Salvando...
                        </>
                      ) : editingId ? (
                        <>
                          <Pencil size={16} />
                          Atualizar template
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          Criar template
                        </>
                      )}
                    </Button>

                    {editingId ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                        onClick={resetForm}
                        disabled={savingTemplate}
                      >
                        Cancelar edicao
                      </Button>
                    ) : null}
                  </div>
                </form>
              </div>

              <aside className="rounded-[26px] border border-border/70 bg-muted/20 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Placeholders liberados
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {allowedPlaceholders.map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition",
                        activeEditorField === "titulo" || activeEditorField === "mensagem"
                          ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
                          : "border-border/70 bg-background/80 text-foreground"
                      )}
                      onClick={() => insertPlaceholderIntoField(activeEditorField, placeholder)}
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Dica de uso</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Exemplo: <strong>Oi {"{{aluno.nome}}"}</strong>, sua turma{" "}
                    <strong>{"{{turma.nome}}"}</strong> do curso{" "}
                    <strong>{"{{curso.nome}}"}</strong> recebeu um novo aviso.
                  </p>
                </div>
                <div className="mt-5 rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Preview rapido</p>
                    <span className="text-xs text-muted-foreground">Dados simulados</span>
                  </div>
                  <div className="mt-3 min-w-0 rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <p className="wrap-break-word text-sm font-semibold leading-6 text-foreground">
                      {previewTitle}
                    </p>
                    <p className="mt-2 whitespace-pre-line break-all text-sm leading-6 text-muted-foreground">
                      {previewMessage}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className={`${panelClass} min-w-0 p-6 sm:p-7`}>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Operacao de notificacoes
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gerencie templates e acompanhe o historico de disparos em abas separadas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-2xl border border-border/70 bg-muted/25 p-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-semibold transition",
                      activeSection === "templates"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveSection("templates")}
                  >
                    Templates
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-semibold transition",
                      activeSection === "historico"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveSection("historico")}
                  >
                    Historico de disparos
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                  onClick={() => void loadData()}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCcw size={16} />
                      Atualizar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Templates
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{templates.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {templates.filter((template) => template.ativo).length} ativos
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Disparos
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{dispatchTotal}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Historico consolidado dos envios
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Base carregada
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{alunos.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cursos.length} cursos e {turmas.length} turmas
                </p>
              </div>
            </div>

            <div className={cn("min-w-0", activeSection !== "templates" && "hidden")}>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Templates cadastrados
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha um template para editar ou disparar.
                  </p>
                </div>

                {selectedTemplateIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                      {selectedTemplateIds.length} template(s) selecionado(s)
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                      onClick={() => setSelectedTemplateIds([])}
                      disabled={dispatchingId !== null}
                    >
                      Limpar seleção
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-xl px-4"
                      onClick={openBulkDispatchModal}
                      disabled={dispatchingId !== null}
                    >
                      <Send size={16} />
                      Disparar selecionados
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex min-w-0 items-center lg:max-w-md lg:flex-1">
                  <Input
                    className="h-11 rounded-xl border-border/70 bg-background/80"
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Buscar por nome, titulo ou conteudo do template"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                    Exibindo <strong className="text-foreground">{filteredTemplates.length}</strong> de{" "}
                    <strong className="text-foreground">{templates.length}</strong>
                  </span>

                  {templateSearch ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                      onClick={() => setTemplateSearch("")}
                    >
                      Limpar busca
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "todos", label: "Todos" },
                    { value: "ativos", label: "Ativos" },
                    { value: "inativos", label: "Inativos" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-medium transition",
                        templateStatusFilter === option.value
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setTemplateStatusFilter(option.value as typeof templateStatusFilter)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "recentes", label: "Mais recentes" },
                    { value: "usados", label: "Mais usados" },
                    { value: "az", label: "A-Z" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-medium transition",
                        templateSort === option.value
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setTemplateSort(option.value as typeof templateSort)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {loading && templates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                    Carregando templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum template cadastrado ainda.
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum template encontrado para essa busca.
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <ContextMenu key={template.id}>
                      <ContextMenuTrigger asChild>
                        <article
                          className={cn(
                            "rounded-3xl border bg-background/80 p-5 transition hover:border-primary/25",
                            selectedTemplateIds.includes(template.id)
                              ? "border-primary/35 ring-1 ring-primary/20"
                              : "border-border/70"
                          )}
                        >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Checkbox
                              checked={selectedTemplateIds.includes(template.id)}
                              onCheckedChange={(checked) => {
                                setSelectedTemplateIds((current) =>
                                  checked === true
                                    ? current.includes(template.id)
                                      ? current
                                      : [...current, template.id]
                                    : current.filter((id) => id !== template.id)
                                );
                              }}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <h3 className="truncate text-lg font-bold tracking-tight text-foreground">
                              {highlightText(template.nome, templateSearch)}
                            </h3>
                            <Badge
                              className={cn(
                                "rounded-full px-3 py-1",
                                template.ativo
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                              )}
                            >
                              {template.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            {highlightText(template.tituloTemplate, templateSearch)}
                          </p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {highlightText(template.mensagemTemplate, templateSearch)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Atualizado em {formatDateTime(template.updatedAt)}</span>
                            <span>•</span>
                            <span>
                              {templateDispatchStats.get(template.id)?.total ?? 0} disparos
                            </span>
                            <span>•</span>
                            <span>
                              Ultimo envio:{" "}
                              {templateDispatchStats.get(template.id)?.lastTriggeredAt
                                ? formatDateTime(templateDispatchStats.get(template.id)?.lastTriggeredAt as string)
                                : "nenhum"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                            onClick={() => handleDuplicate(template)}
                          >
                            <Copy size={16} />
                            Duplicar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil size={16} />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            className="h-11 rounded-xl px-4"
                            disabled={!template.ativo || dispatchingId === template.id}
                            onClick={() => openDispatchModal(template)}
                          >
                            {dispatchingId === template.id ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Disparando...
                              </>
                            ) : (
                              <>
                                <Send size={16} />
                                Disparar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                        </article>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuLabel>Acoes do template</ContextMenuLabel>
                        <ContextMenuItem onClick={() => openQuickEdit(template)}>
                          <Pencil size={16} />
                          Editar rapido
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleEdit(template)}>
                          <Pencil size={16} />
                          Abrir no editor
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy size={16} />
                          Duplicar
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() =>
                            openQuickEdit({
                              ...template,
                              ativo: !template.ativo,
                            })
                          }
                        >
                          <Sparkles size={16} />
                          {template.ativo ? "Marcar como inativo" : "Marcar como ativo"}
                        </ContextMenuItem>
                        <ContextMenuItem variant="destructive" onClick={() => openDeleteDialog(template)}>
                          <Trash2 size={16} />
                          Excluir
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))
                )}
              </div>
            </div>

            <div className={cn("min-w-0", activeSection !== "historico" && "hidden")}>
              <section className="min-w-0">
                <div className="mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Historico de disparos
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Últimos envios processados pelo portal do aluno.
                  </p>
                </div>

                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <label className="flex min-w-0 items-center lg:max-w-md lg:flex-1">
                    <Input
                      className="h-11 rounded-xl border-border/70 bg-background/80"
                      value={dispatchSearch}
                      onChange={(event) => setDispatchSearch(event.target.value)}
                      placeholder="Buscar por template, responsável ou números do disparo"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    {dispatches.length > 0 ? (
                      <label className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                        <Checkbox
                          checked={
                            dispatches.length > 0 &&
                            dispatches.every((dispatch) => selectedDispatchIds.includes(dispatch.id))
                          }
                          onCheckedChange={(checked) => handleToggleAllVisibleDispatches(checked === true)}
                        />
                        Selecionar carregados
                      </label>
                    ) : null}

                    <span className="rounded-full border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                      Exibindo <strong className="text-foreground">{dispatches.length}</strong> de{" "}
                      <strong className="text-foreground">{dispatchTotal}</strong>
                    </span>

                    {selectedDispatchIds.length > 0 ? (
                      <>
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                          {selectedDispatchIds.length} selecionados
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                          onClick={() => setSelectedDispatchIds([])}
                        >
                          Limpar seleção
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-xl border-destructive/30 bg-destructive/5 px-4 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDispatchToDelete(null);
                            setDeleteDispatchDialogOpen(true);
                          }}
                        >
                          <Trash2 size={16} />
                          Excluir selecionados
                        </Button>
                      </>
                    ) : null}

                    {dispatchSearch ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                        onClick={() => setDispatchSearch("")}
                      >
                        Limpar busca
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div
                  ref={dispatchListRef}
                  className="max-h-168 space-y-3 overflow-y-auto pr-1"
                  onScroll={handleDispatchListScroll}
                >
                  {dispatches.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                      {dispatchSearch ? "Nenhum disparo encontrado para essa busca." : "Nenhum disparo registrado ainda."}
                    </div>
                  ) : (
                    dispatches.map((dispatch) => (
                      <ContextMenu key={dispatch.id}>
                        <ContextMenuTrigger asChild>
                          <article
                            className={cn(
                              "rounded-3xl border bg-background/80 p-5",
                              selectedDispatchIds.includes(dispatch.id)
                                ? "border-primary/35 ring-1 ring-primary/20"
                                : "border-border/70"
                            )}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={selectedDispatchIds.includes(dispatch.id)}
                                    onCheckedChange={(checked) =>
                                      handleToggleDispatchSelection(dispatch.id, checked === true)
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                  <h3 className="text-base font-semibold text-foreground">
                                    {dispatch.templateName}
                                  </h3>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {dispatch.triggeredByActorName || "Administrador"} ·{" "}
                                  {formatDateTime(dispatch.createdAt)}
                                </p>
                              </div>
                              <Badge className="rounded-full border-primary/25 bg-primary/10 px-3 py-1 text-primary">
                                {dispatch.totalRecipients} enviados
                              </Badge>
                            </div>

                            <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                              <span>Cursos: {dispatch.cursoIds.length}</span>
                              <span>Turmas: {dispatch.turmaIds.length}</span>
                              <span>Alunos: {dispatch.alunoIds.length}</span>
                              <span>Falhas: {dispatch.failedRecipients}</span>
                            </div>
                          </article>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-56">
                          <ContextMenuLabel>Acoes do disparo</ContextMenuLabel>
                          <ContextMenuItem onClick={() => handleViewDispatchPayload(dispatch)}>
                            <BellRing size={16} />
                            Ver payload
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyDispatchPayload(dispatch)}>
                            <Copy size={16} />
                            Copiar payload
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => handleCopyDispatchId(dispatch)}>
                            <Copy size={16} />
                            Copiar ID
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyDispatchSummary(dispatch)}>
                            <Copy size={16} />
                            Copiar resumo
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => handleViewDispatchTemplate(dispatch)}>
                            <BellRing size={16} />
                            Ver template
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            onClick={() => {
                              setDispatchToDelete(dispatch);
                              setDeleteDispatchDialogOpen(true);
                            }}
                          >
                            <Trash2 size={16} />
                            Excluir
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))
                  )}

                  {loadingMoreDispatches ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
                      Carregando mais disparos...
                    </div>
                  ) : null}

                  {dispatches.length > 0 && hasMoreDispatches ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
                      Carregados {dispatches.length} de {dispatchTotal} disparos. Role para carregar mais.
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <Dialog
              open={dispatchModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  resetDispatchState();
                } else {
                  setDispatchModalOpen(true);
                }
              }}
            >
              <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
                <DialogHeader className="border-b border-border/70 bg-muted/20">
                  <DialogTitle>Segmentacao do disparo</DialogTitle>
                  <DialogDescription>
                    {dispatchTemplate ? (
                      <>
                        Selecione pelo menos um filtro para o template <strong>{dispatchTemplate.nome}</strong> ou marque{" "}
                        <strong>Nenhum filtro</strong> para enviar para todos os alunos.
                      </>
                    ) : dispatchTemplateIds.length > 1 ? (
                      <>
                        Selecione pelo menos um filtro para disparar <strong>{dispatchTemplateIds.length} templates</strong> de uma vez ou marque{" "}
                        <strong>Nenhum filtro</strong> para enviar para todos os alunos.
                      </>
                    ) : (
                      "Selecione o publico do disparo."
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 overflow-y-auto p-6">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={dispatchWithoutFilters}
                        onCheckedChange={(checked) => {
                          const nextChecked = checked === true;
                          setDispatchWithoutFilters(nextChecked);

                          if (nextChecked) {
                            setSelectedCursoIds([]);
                            setSelectedTurmaIds([]);
                            setSelectedAlunoIds([]);
                          }
                        }}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-foreground">
                          Nenhum filtro
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Envia para todos os usuarios disponiveis ({alunosTotal} registros).
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Resumo do disparo
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Revise o publico antes de confirmar para evitar envio amplo por engano.
                        </p>
                      </div>
                      <Badge className="rounded-full border-primary/25 bg-primary/10 px-3 py-1.5 text-primary">
                        {dispatchWithoutFilters
                          ? `${alunosTotal} usuarios na base`
                          : `${selectedRecipientsCount} filtros ativos`}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {dispatchSelectionSummary.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            {item.label}
                          </div>
                          <div className="mt-2 text-sm font-medium text-foreground">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!dispatchWithoutFilters && selectedRecipientsCount === 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        Nenhum filtro foi marcado ainda. Se a intencao for disparo amplo, use a opcao
                        <strong> Nenhum filtro</strong>.
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      "grid min-w-0 gap-4 xl:grid-cols-3",
                      dispatchWithoutFilters && "pointer-events-none opacity-50"
                    )}
                  >
                    <SegmentList
                      title="Cursos"
                      subtitle="Dispara para todos os alunos matriculados nas turmas desses cursos."
                      items={cursos}
                      selectedIds={selectedCursoIds}
                      getItemId={(item) => Number(item.id)}
                      getItemLabel={(item) => item.nome}
                      getItemMeta={(item) => ("descricao" in item ? item.descricao ?? null : null)}
                      onToggle={(id) => setSelectedCursoIds((current) => toggleSelection(current, id))}
                    />

                    <SegmentList
                      title="Turmas"
                      subtitle="Permite um recorte direto por turma especifica."
                      items={turmas}
                      selectedIds={selectedTurmaIds}
                      getItemId={(item) => Number(item.id)}
                      getItemLabel={(item) => item.nome}
                      getItemMeta={(item) =>
                        "courseId" in item && item.courseId ? `Curso ${item.courseId}` : null
                      }
                      onToggle={(id) => setSelectedTurmaIds((current) => toggleSelection(current, id))}
                    />

                    <SegmentList
                      title="Usuarios"
                      subtitle="Use para casos pontuais, incluindo alunos, professores e admins."
                      items={alunos}
                      selectedIds={selectedAlunoIds}
                      getItemId={(item) => Number(item.id)}
                      getItemLabel={(item) => item.nome}
                      getItemMeta={(item) => ("email" in item ? item.email ?? item.usuario ?? null : null)}
                      onToggle={(id) => setSelectedAlunoIds((current) => toggleSelection(current, id))}
                      onScroll={handleStudentsListScroll}
                      footer={
                        loadingMoreAlunos ? (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
                            Carregando mais usuarios...
                          </div>
                        ) : hasMoreAlunos ? (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
                            Carregados {alunos.length} de {alunosTotal} usuarios. Role para carregar mais.
                          </div>
                        ) : alunos.length > 0 ? (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
                            Todos os {alunosTotal} usuarios foram carregados.
                          </div>
                        ) : null
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  {!dispatchWithoutFilters && selectedRecipientsCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                      onClick={() => {
                        setSelectedCursoIds([]);
                        setSelectedTurmaIds([]);
                        setSelectedAlunoIds([]);
                      }}
                      disabled={dispatchingId !== null}
                    >
                      Limpar filtros
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={resetDispatchState}
                    disabled={dispatchingId !== null}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-4"
                    disabled={!canConfirmDispatch || dispatchingId !== null}
                    onClick={() => void handleDispatch()}
                  >
                    {dispatchingId !== null ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Disparando...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        {dispatchTemplateIds.length > 1 ? "Confirmar disparos" : "Confirmar disparo"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={payloadDispatch !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setPayloadDispatch(null);
                }
              }}
            >
              <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
                <DialogHeader className="border-b border-border/70 bg-muted/20">
                  <DialogTitle>Payload do disparo</DialogTitle>
                  <DialogDescription>
                    {payloadDispatch ? (
                      <>
                        Template <strong>{payloadDispatch.templateName}</strong> no disparo{" "}
                        <strong>#{payloadDispatch.id}</strong>.
                      </>
                    ) : (
                      "Inspecione o payload enviado no disparo."
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="overflow-auto p-6">
                  <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-background/90 p-4 text-xs leading-6 text-foreground">
                    <code>
                      {payloadDispatch
                        ? JSON.stringify(buildDispatchPayload(payloadDispatch), null, 2)
                        : ""}
                    </code>
                  </pre>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={() => {
                      if (payloadDispatch) {
                        handleCopyDispatchPayload(payloadDispatch);
                      }
                    }}
                  >
                    <Copy size={16} />
                    Copiar payload
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-4"
                    onClick={() => setPayloadDispatch(null)}
                  >
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={discardDialogOpen} onOpenChange={(open) => (!open ? handleDiscardCancel() : setDiscardDialogOpen(true))}>
              <DialogContent className="max-w-md p-0">
                <DialogHeader className="border-b border-border/70 bg-muted/20">
                  <DialogTitle>Descartar alteracoes?</DialogTitle>
                  <DialogDescription>
                    Voce tem alteracoes nao salvas. Deseja descartar essas mudancas?
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={handleDiscardCancel}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-4"
                    onClick={handleDiscardConfirm}
                  >
                    Descartar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={quickEditOpen} onOpenChange={(open) => (!open ? closeQuickEdit() : setQuickEditOpen(true))}>
              <DialogContent className="max-w-2xl p-0">
                <DialogHeader className="border-b border-border/70 bg-muted/20">
                  <DialogTitle>Editar template</DialogTitle>
                  <DialogDescription>
                    Ajuste nome interno, titulo, mensagem e status sem sair da lista.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 p-6">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Nome interno</span>
                    <Input
                      className={fieldClass}
                      value={quickEditDraft.nome}
                      onChange={(event) =>
                        setQuickEditDraft((current) => ({ ...current, nome: event.target.value }))
                      }
                      placeholder="Nome do template"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Titulo</span>
                    <Input
                      className={fieldClass}
                      value={quickEditDraft.tituloTemplate}
                      onChange={(event) =>
                        setQuickEditDraft((current) => ({
                          ...current,
                          tituloTemplate: event.target.value,
                        }))
                      }
                      placeholder="Titulo da Notificação"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Mensagem</span>
                    <textarea
                      className={textAreaClass}
                      value={quickEditDraft.mensagemTemplate}
                      onChange={(event) =>
                        setQuickEditDraft((current) => ({
                          ...current,
                          mensagemTemplate: event.target.value,
                        }))
                      }
                      placeholder="Mensagem da Notificação"
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                    <Checkbox
                      className="mt-1"
                      checked={quickEditDraft.ativo}
                      onCheckedChange={(checked) =>
                        setQuickEditDraft((current) => ({ ...current, ativo: checked === true }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Template ativo</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        Templates inativos ficam salvos, mas nao podem ser disparados.
                      </span>
                    </span>
                  </label>

                  {quickEditValidation.invalidPlaceholders.length > 0 ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      Placeholders invalidos: {quickEditValidation.invalidPlaceholders.join(", ")}
                    </div>
                  ) : null}

                  {quickEditValidation.hasUnclosedPlaceholder ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      Existe um placeholder incompleto. Feche as chaves antes de salvar.
                    </div>
                  ) : null}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={closeQuickEdit}
                    disabled={quickEditSaving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-4"
                    onClick={() => void handleQuickEditSave()}
                    disabled={
                      quickEditSaving ||
                      !quickEditDraft.nome.trim() ||
                      !quickEditDraft.tituloTemplate.trim() ||
                      !quickEditDraft.mensagemTemplate.trim() ||
                      quickEditValidation.hasErrors
                    }
                  >
                    {quickEditSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Pencil size={16} />
                        Salvar alteracoes
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={(open) => (!open ? closeDeleteDialog() : setDeleteDialogOpen(true))}>
              <DialogContent className="max-w-md p-0">
                <DialogHeader className="border-b border-border/70 bg-muted/20">
                  <DialogTitle>Excluir template?</DialogTitle>
                  <DialogDescription>
                    {templateToDelete ? (
                      <>
                        Tem certeza que deseja excluir <strong>{templateToDelete.nome}</strong>?
                      </>
                    ) : (
                      "Confirme a exclusao do template."
                    )}
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                    onClick={closeDeleteDialog}
                    disabled={deletingTemplate}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-11 rounded-xl px-4"
                    onClick={() => void handleDeleteTemplate()}
                    disabled={deletingTemplate}
                  >
                    {deletingTemplate ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Excluir
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </section>
        </div>

        <Dialog
          open={deleteDispatchDialogOpen}
          onOpenChange={(open) => {
            if (!open && !deletingDispatch) {
              setDeleteDispatchDialogOpen(false);
              setDispatchToDelete(null);
            }
          }}
        >
          <DialogContent className="max-w-md p-0">
            <DialogHeader className="border-b border-border/70 bg-muted/20">
              <DialogTitle>Excluir disparo?</DialogTitle>
              <DialogDescription>
                {dispatchToDelete ? (
                  <>
                    Tem certeza que deseja excluir o disparo do template{" "}
                    <strong>{dispatchToDelete.templateName}</strong>? Essa acao nao pode ser desfeita.
                  </>
                ) : selectedDispatchIds.length > 0 ? (
                  <>
                    Tem certeza que deseja excluir <strong>{selectedDispatchIds.length} disparos selecionados</strong>? Essa acao nao pode ser desfeita.
                  </>
                ) : (
                  "Confirme a exclusao do disparo."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                onClick={() => {
                  setDeleteDispatchDialogOpen(false);
                  setDispatchToDelete(null);
                }}
                disabled={deletingDispatch}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 rounded-xl px-4"
                onClick={() => void handleDeleteDispatch()}
                disabled={deletingDispatch}
              >
                {deletingDispatch ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Excluir
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FadeInUp>
    </DashboardLayout>
  );
}
