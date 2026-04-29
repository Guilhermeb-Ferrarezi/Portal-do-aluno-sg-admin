import React from "react";
import {
  CalendarClock,
  ChevronDown,
  PlusCircle,
  Pencil,
  Trash2,
  Trophy,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { AnimatedToast } from "../components/animate-ui";
import {
  getRankingEventsByType,
  getRankingEventHistoryPage,
  scheduleRankingEvent,
  criarRankingEvent,
  atualizarRankingEvent,
  deletarRankingEvent,
  RANKING_EVENT_TYPE,
  RANKING_EVENT_TYPE_LABEL,
  type RankingEventType,
  type RankingEventListItem,
  type RankingEventAward,
  type RankingEventInput,
  type RankingEventHistoryItem,
} from "../services/api";
import { computeEventStatus, type EventStatus } from "./ranking-event-status";

const cardClass =
  "rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";
const fieldClass =
  "h-11 w-full rounded-2xl border border-border/75 bg-card px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/90 hover:border-primary/35 focus:border-primary focus:ring-4 focus:ring-ring/30";
const textareaClass = `${fieldClass} min-h-20 h-auto py-3 leading-6`;
const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_24px_rgba(225,29,46,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border/80 bg-muted/45 px-4 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60";

const tabsClass =
  "inline-flex max-w-full flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-card/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const tabClass = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
    active
      ? "bg-primary text-primary-foreground shadow"
      : "text-muted-foreground hover:text-foreground hover:bg-accent"
  }`;

const statusBadgeClass: Record<EventStatus, string> = {
  Agendado: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Ativo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Encerrado: "bg-muted text-muted-foreground",
};

const HISTORY_PAGE_SIZE = 20;

type HistoryEventGroup = {
  eventId: number;
  eventName: string;
  recordedAt: string;
  winners: RankingEventHistoryItem[];
};

function emptyAward(position: number): RankingEventAward {
  return {
    awardName: "",
    awardPositionRanking: position,
    awardDescription: "",
    awardPictureUrl: "",
  };
}

function emptyForm(): RankingEventInput {
  return {
    eventName: "",
    eventType: RANKING_EVENT_TYPE.Notas,
    durationMinutes: 60,
    startTime: "",
    awards: [emptyAward(1)],
  };
}

function isoToLocalInput(iso: string) {
  // datetime-local quer "YYYY-MM-DDTHH:mm" sem timezone, no horário local.
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(local: string) {
  if (!local) return "";
  // Interpreta como horário local e converte pra ISO UTC.
  return new Date(local).toISOString();
}

function eventTypeIdFromLabel(label: string): RankingEventType {
  const norm = label.trim().toLowerCase();
  if (norm === "notas") return RANKING_EVENT_TYPE.Notas;
  if (norm === "pontos") return RANKING_EVENT_TYPE.Pontos;
  return RANKING_EVENT_TYPE.Outro;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupHistoryByEvent(history: RankingEventHistoryItem[]) {
  const groups = new Map<number, HistoryEventGroup>();

  history.forEach((item) => {
    const current = groups.get(item.eventId);
    if (current) {
      current.winners.push(item);
      if (new Date(item.recordedAt) > new Date(current.recordedAt)) {
        current.recordedAt = item.recordedAt;
      }
      return;
    }

    groups.set(item.eventId, {
      eventId: item.eventId,
      eventName: item.eventName,
      recordedAt: item.recordedAt,
      winners: [item],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      winners: group.winners.sort(
        (a, b) => a.rankingPosition - b.rankingPosition
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
}

export default function RankingEventosPage() {
  const [activeType, setActiveType] = React.useState<RankingEventType>(
    RANKING_EVENT_TYPE.Notas
  );
  const [events, setEvents] = React.useState<RankingEventListItem[] | null>(null);
  const [history, setHistory] = React.useState<RankingEventHistoryItem[] | null>(
    null
  );
  const [historyTotalRows, setHistoryTotalRows] = React.useState<number | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [loadingHistoryMore, setLoadingHistoryMore] = React.useState(false);
  const loadingHistoryMoreRef = React.useRef(false);
  const historySentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = React.useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<RankingEventInput>(emptyForm());
  const [saving, setSaving] = React.useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = React.useState<number | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);
  const [reschedulingId, setReschedulingId] = React.useState<number | null>(
    null
  );
  const [expandedHistoryIds, setExpandedHistoryIds] = React.useState<
    Set<number>
  >(new Set());

  const historyGroups = React.useMemo(
    () => groupHistoryByEvent(history ?? []),
    [history]
  );

  const loadHistoryPage = React.useCallback(
    async (
      type: RankingEventType,
      options: { append?: boolean; offset?: number } = {}
    ) => {
      const append = options.append === true;
      const currentLength = history?.length ?? 0;
      const nextOffset = options.offset ?? (append ? currentLength : 0);
      const hasMore =
        historyTotalRows === null || currentLength < historyTotalRows;

      if (append) {
        if (loadingHistoryMoreRef.current || !hasMore) return;
        loadingHistoryMoreRef.current = true;
        setLoadingHistoryMore(true);
      }

      try {
        const page = await getRankingEventHistoryPage(type, {
          limit: HISTORY_PAGE_SIZE,
          offset: nextOffset,
        });
        setHistory((prev) =>
          append ? [...(prev ?? []), ...page.items] : page.items
        );
        setHistoryTotalRows(page.totalRows ?? page.items.length);
      } catch (err) {
        setToast({
          message:
            err instanceof Error ? err.message : "Erro ao carregar histórico",
          type: "error",
        });
      } finally {
        if (append) {
          loadingHistoryMoreRef.current = false;
          setLoadingHistoryMore(false);
        }
      }
    },
    [history?.length, historyTotalRows]
  );

  const loadEvents = React.useCallback(
    async (type: RankingEventType, options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoading(true);
      try {
        const [list, historyPage] = await Promise.all([
          getRankingEventsByType(type),
          getRankingEventHistoryPage(type, {
            limit: HISTORY_PAGE_SIZE,
            offset: 0,
          }),
        ]);
        setEvents(list);
        setHistory((prev) => {
          if (options.silent && prev && prev.length > HISTORY_PAGE_SIZE) {
            return prev;
          }
          return historyPage.items;
        });
        setHistoryTotalRows(historyPage.totalRows ?? historyPage.items.length);
      } catch (err) {
        setToast({
          message:
            err instanceof Error ? err.message : "Erro ao carregar eventos",
          type: "error",
        });
        setEvents([]);
        setHistory([]);
        setHistoryTotalRows(0);
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    void loadEvents(activeType);
    setExpandedHistoryIds(new Set());
  }, [activeType, loadEvents]);

  function toggleHistoryGroup(eventId: number) {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  React.useEffect(() => {
    const node = historySentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadHistoryPage(activeType, { append: true });
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeType, loadHistoryPage]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadEvents(activeType, { silent: true });
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [activeType, loadEvents]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm(), eventType: activeType });
    setModalOpen(true);
  }

  function openEdit(item: RankingEventListItem) {
    if (typeof item.id !== "number") {
      setToast({
        message: "Este evento não tem id retornado pelo backend.",
        type: "error",
      });
      return;
    }
    setEditingId(item.id);
    setForm({
      eventName: item.eventName,
      eventType:
        typeof item.eventType === "number"
          ? item.eventType
          : eventTypeIdFromLabel(item.eventType),
      durationMinutes: item.durationMinutes,
      startTime: item.startTime,
      awards: item.eventRankingAwards.map((a) => ({ ...a })),
    });
    setModalOpen(true);
  }

  function updateField<K extends keyof RankingEventInput>(
    key: K,
    value: RankingEventInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAward(idx: number, patch: Partial<RankingEventAward>) {
    setForm((prev) => ({
      ...prev,
      awards: prev.awards.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }

  function addAward() {
    setForm((prev) => ({
      ...prev,
      awards: [...prev.awards, emptyAward(prev.awards.length + 1)],
    }));
  }

  function removeAward(idx: number) {
    setForm((prev) => ({
      ...prev,
      awards: prev.awards.filter((_, i) => i !== idx),
    }));
  }

  async function handleSave() {
    if (!form.eventName.trim()) {
      setToast({ message: "Nome do evento é obrigatório.", type: "error" });
      return;
    }
    if (form.durationMinutes <= 0) {
      setToast({ message: "Duração deve ser maior que zero.", type: "error" });
      return;
    }
    if (!form.startTime) {
      setToast({ message: "Data de início é obrigatória.", type: "error" });
      return;
    }
    if (form.awards.length === 0) {
      setToast({
        message: "Adicione ao menos um prêmio.",
        type: "error",
      });
      return;
    }
    if (form.awards.some((a) => !a.awardName.trim())) {
      setToast({
        message: "Todos os prêmios precisam de um nome.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId === null) {
        await criarRankingEvent(form);
        setToast({ message: "Evento criado.", type: "success" });
      } else {
        await atualizarRankingEvent(editingId, form);
        setToast({ message: "Evento atualizado.", type: "success" });
      }
      setModalOpen(false);
      await loadEvents(activeType);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao salvar evento",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (confirmDeleteId === null) return;
    setDeleting(true);
    try {
      await deletarRankingEvent(confirmDeleteId);
      setToast({ message: "Evento excluído.", type: "success" });
      setConfirmDeleteId(null);
      await loadEvents(activeType);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao excluir evento",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleReschedule(id: number) {
    setReschedulingId(id);
    try {
      await scheduleRankingEvent(id);
      setToast({ message: "Job reagendado.", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao reagendar",
        type: "error",
      });
    } finally {
      setReschedulingId(null);
    }
  }

  return (
    <DashboardLayout
      title="Eventos de Rankings"
      subtitle="Cadastre e agende as premiações TLGD por tipo de ranking."
      quickActions={[
        {
          label: "Novo evento",
          icon: PlusCircle,
          onClick: openCreate,
        },
      ]}
    >
      <AnimatedToast
        message={toast?.message ?? null}
        type={toast?.type ?? "info"}
        onClose={() => setToast(null)}
      />
      <div className="flex flex-col gap-6">
        <div className={tabsClass} role="tablist" data-testid="event-type-tabs">
          {(Object.keys(RANKING_EVENT_TYPE_LABEL) as unknown as string[]).map(
            (key) => {
              const id = Number(key) as RankingEventType;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeType === id}
                  onClick={() => setActiveType(id)}
                  className={tabClass(activeType === id)}
                  data-testid={`event-type-tab-${id}`}
                >
                  {RANKING_EVENT_TYPE_LABEL[id]}
                </button>
              );
            }
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.16)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground">
              Cadastrar novo evento
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Configure período, tipo de ranking e prêmios por posição.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className={primaryButtonClass}
            data-testid="novo-evento-inline-btn"
          >
            <PlusCircle size={16} /> Adicionar evento
          </button>
        </div>

        {loading || events === null ? (
          <div className={`${cardClass} animate-pulse text-sm text-muted-foreground`}>
            Carregando eventos...
          </div>
        ) : events.length === 0 ? (
          <div className={`${cardClass} flex items-center gap-3 text-sm text-muted-foreground`}>
            <CalendarClock size={20} /> Nenhum evento desse tipo cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {events.map((ev) => {
              const status = computeEventStatus(ev.startTime, ev.durationMinutes);
              return (
                <div
                  key={`${ev.id ?? ev.eventName}-${ev.startTime}`}
                  className={cardClass}
                  data-testid="event-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {ev.eventName}
                      </h3>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {ev.eventType}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[status]}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Início
                      </div>
                      <div className="font-medium text-foreground">
                        {formatDate(ev.startTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Fim
                      </div>
                      <div className="font-medium text-foreground">
                        {formatDate(ev.endTime)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Duração
                      </div>
                      <div className="font-medium text-foreground">
                        {ev.durationMinutes.toLocaleString("pt-BR")} min
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <Trophy size={14} /> Prêmios
                    </div>
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {ev.eventRankingAwards.map((a) => (
                        <li
                          key={`${a.awardPositionRanking}-${a.awardName}`}
                          className="flex items-center gap-2"
                        >
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                            {a.awardPositionRanking}º
                          </span>
                          <span className="font-medium text-foreground">
                            {a.awardName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(ev)}
                      className={secondaryButtonClass}
                      disabled={typeof ev.id !== "number"}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        typeof ev.id === "number" && handleReschedule(ev.id)
                      }
                      className={secondaryButtonClass}
                      disabled={
                        typeof ev.id !== "number" || reschedulingId === ev.id
                      }
                    >
                      <RefreshCw
                        size={14}
                        className={reschedulingId === ev.id ? "animate-spin" : ""}
                      />
                      Reagendar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        typeof ev.id === "number" && setConfirmDeleteId(ev.id)
                      }
                      className={dangerButtonClass}
                      disabled={typeof ev.id !== "number"}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Histórico de premiações
              </h3>
              <p className="text-sm text-muted-foreground">
                Vencedores registrados nas edições encerradas deste tipo.
              </p>
            </div>
          </div>

          {loading || history === null ? (
            <div className="animate-pulse text-sm text-muted-foreground">
              Carregando histórico...
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma premiação registrada nesse tipo ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {historyGroups.map((group) => {
                const expanded = expandedHistoryIds.has(group.eventId);

                return (
                  <div
                    key={group.eventId}
                    className="rounded-2xl border border-border/70 bg-muted/20"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-accent/40"
                      onClick={() => toggleHistoryGroup(group.eventId)}
                      aria-expanded={expanded}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {group.eventName}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(group.recordedAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                          {group.winners.length} ganhador
                          {group.winners.length === 1 ? "" : "es"}
                        </span>
                        <ChevronDown
                          size={18}
                          className={`text-muted-foreground transition ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        expanded
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-border/60 px-4 py-2">
                          {group.winners.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-1 gap-3 border-t border-border/50 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] md:items-center"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {item.userProfilePictureUrl ? (
                                  <img
                                    src={item.userProfilePictureUrl}
                                    alt={item.userName}
                                    className="h-8 w-8 rounded-full object-cover ring-2 ring-border/60"
                                  />
                                ) : (
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                                    {item.userName.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <span className="truncate text-sm font-medium text-foreground">
                                  {item.userName}
                                </span>
                              </div>

                              <div className="text-sm font-bold text-primary md:text-center">
                                {item.rankingPosition}º
                              </div>

                              <div className="flex min-w-0 items-center gap-2">
                                {item.awardPictureUrl ? (
                                  <img
                                    src={item.awardPictureUrl}
                                    alt={item.awardName}
                                    className="h-9 w-9 shrink-0 rounded-lg border border-border/60 object-cover"
                                  />
                                ) : null}
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {item.awardName}
                                  </div>
                                  {item.awardDescription ? (
                                    <div className="line-clamp-1 text-xs text-muted-foreground">
                                      {item.awardDescription}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {historyTotalRows === null || history.length < historyTotalRows ? (
                <div ref={historySentinelRef} className="h-1" />
              ) : null}
              {loadingHistoryMore ? (
                <div className="pt-4 text-center text-sm text-muted-foreground">
                  Carregando mais vencedores...
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "Editar evento" : "Novo evento"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className={secondaryButtonClass}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={primaryButtonClass}
              disabled={saving}
              data-testid="salvar-evento-btn"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-foreground">Nome do evento</span>
            <input
              type="text"
              className={fieldClass}
              value={form.eventName}
              onChange={(e) => updateField("eventName", e.target.value)}
              placeholder="Premiação Janeiro TLGD"
              data-testid="evento-nome-input"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-foreground">Tipo</span>
              <select
                className={fieldClass}
                value={form.eventType}
                onChange={(e) =>
                  updateField(
                    "eventType",
                    Number(e.target.value) as RankingEventType
                  )
                }
              >
                <option value={RANKING_EVENT_TYPE.Notas}>Notas</option>
                <option value={RANKING_EVENT_TYPE.Pontos}>Pontos</option>
                <option value={RANKING_EVENT_TYPE.Outro}>Outro</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-foreground">Início</span>
              <input
                type="datetime-local"
                className={fieldClass}
                value={form.startTime ? isoToLocalInput(form.startTime) : ""}
                onChange={(e) =>
                  updateField("startTime", localInputToIso(e.target.value))
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-foreground">
                Duração (min)
              </span>
              <input
                type="number"
                min={1}
                className={fieldClass}
                value={form.durationMinutes}
                onChange={(e) =>
                  updateField("durationMinutes", Number(e.target.value))
                }
              />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Prêmios
              </span>
              <button
                type="button"
                onClick={addAward}
                className={secondaryButtonClass}
              >
                <PlusCircle size={14} /> Adicionar prêmio
              </button>
            </div>
            {form.awards.map((award, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-border/60 bg-card/60 p-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Posição
                    </span>
                    <input
                      type="number"
                      min={1}
                      className={fieldClass}
                      value={award.awardPositionRanking}
                      onChange={(e) =>
                        updateAward(idx, {
                          awardPositionRanking: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm sm:col-span-5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Nome do prêmio
                    </span>
                    <input
                      type="text"
                      className={fieldClass}
                      value={award.awardName}
                      onChange={(e) =>
                        updateAward(idx, { awardName: e.target.value })
                      }
                      placeholder="Mochila TLGD"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm sm:col-span-5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      URL da imagem
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        className={fieldClass}
                        value={award.awardPictureUrl}
                        onChange={(e) =>
                          updateAward(idx, { awardPictureUrl: e.target.value })
                        }
                        placeholder="https://..."
                      />
                      {award.awardPictureUrl ? (
                        <img
                          src={award.awardPictureUrl}
                          alt="preview"
                          className="h-11 w-11 shrink-0 rounded-lg border border-border/60 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm sm:col-span-12">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Descrição
                    </span>
                    <textarea
                      className={textareaClass}
                      value={award.awardDescription}
                      onChange={(e) =>
                        updateAward(idx, { awardDescription: e.target.value })
                      }
                    />
                  </label>
                </div>
                {form.awards.length > 1 && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeAward(idx)}
                      className={dangerButtonClass}
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Excluir evento"
        message="Isso cancelará o job de premiação se ainda não rodou. Deseja continuar?"
        confirmText="Excluir"
        cancelText="Cancelar"
        danger
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDeleteId(null)}
      />
    </DashboardLayout>
  );
}
