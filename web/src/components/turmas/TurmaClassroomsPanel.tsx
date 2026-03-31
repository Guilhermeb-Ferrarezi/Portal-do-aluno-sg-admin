import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  atualizarSalaDaTurma,
  atualizarStatusSalaDaTurma,
  criarSalaDaTurma,
  deletarSalaDaTurma,
  listarExerciciosDisponiveisSala,
  listarSalasDaTurma,
  type ClassRoom,
  type ClassRoomAvailableExercise,
} from "@/services/api";

type TurmaClassroomsPanelProps = {
  turmaId: string;
  turmaNome: string;
  currentModuleName?: string | null;
  canManage: boolean;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type RoomFormState = {
  nome: string;
  targetLimited: string;
  isAuthorized: boolean;
  selectedExerciseIds: string[];
};

type AvailableExerciseFilter = "todos" | "tarefas" | "selecionados";

const ALL_PHASES_VALUE = "__all_phases__";

function createDefaultDeadlineValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  now.setSeconds(0, 0);
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateTimeLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem horario-limite";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRoomStatusMeta(status: ClassRoom["status"]) {
  switch (status) {
    case "aberta":
      return {
        label: "Aberta",
        className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        Icon: DoorOpen,
      };
    case "encerrada":
      return {
        label: "Encerrada",
        className: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        Icon: ShieldAlert,
      };
    default:
      return {
        label: "Rascunho",
        className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        Icon: DoorClosed,
      };
  }
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function TurmaClassroomsPanel({
  turmaId,
  turmaNome,
  currentModuleName,
  canManage,
  onError,
  onSuccess,
}: TurmaClassroomsPanelProps) {
  const [rooms, setRooms] = React.useState<ClassRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(true);
  const [refreshingRooms, setRefreshingRooms] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<ClassRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ClassRoom | null>(null);
  const [loadingAvailableExercises, setLoadingAvailableExercises] = React.useState(false);
  const [availableExercises, setAvailableExercises] = React.useState<ClassRoomAvailableExercise[]>([]);
  const [savingRoom, setSavingRoom] = React.useState(false);
  const [statusBusyRoomId, setStatusBusyRoomId] = React.useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [availableSearch, setAvailableSearch] = React.useState("");
  const [selectedSearch, setSelectedSearch] = React.useState("");
  const [availablePhaseFilter, setAvailablePhaseFilter] =
    React.useState<string>(ALL_PHASES_VALUE);
  const [availableFilter, setAvailableFilter] =
    React.useState<AvailableExerciseFilter>("todos");
  const [form, setForm] = React.useState<RoomFormState>({
    nome: "",
    targetLimited: createDefaultDeadlineValue(),
    isAuthorized: false,
    selectedExerciseIds: [],
  });

  const selectedExercises = React.useMemo(() => {
    const availableById = new Map(availableExercises.map((exercise) => [exercise.id, exercise]));
    return form.selectedExerciseIds
      .map((exerciseId) => availableById.get(exerciseId))
      .filter((exercise): exercise is ClassRoomAvailableExercise => Boolean(exercise));
  }, [availableExercises, form.selectedExerciseIds]);

  const availablePhaseOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          availableExercises.map(
            (exercise) => exercise.phaseName?.trim() || "Sem fase identificada"
          )
        )
      ).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [availableExercises]
  );

  const filteredAvailableExercises = React.useMemo(() => {
    const normalizedSearch = availableSearch.trim().toLowerCase();

    return availableExercises.filter((exercise) => {
      const phaseLabel = exercise.phaseName?.trim() || "Sem fase identificada";

      if (availablePhaseFilter !== ALL_PHASES_VALUE && phaseLabel !== availablePhaseFilter) {
        return false;
      }

      if (availableFilter === "tarefas" && !exercise.isDailyTask) {
        return false;
      }

      if (
        availableFilter === "selecionados" &&
        !form.selectedExerciseIds.includes(exercise.id)
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        exercise.title,
        exercise.description ?? "",
        exercise.phaseName ?? "",
        currentModuleName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    availableExercises,
    availableFilter,
    availablePhaseFilter,
    availableSearch,
    currentModuleName,
    form.selectedExerciseIds,
  ]);

  const filteredSelectedExercises = React.useMemo(() => {
    const normalizedSearch = selectedSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return selectedExercises;
    }

    return selectedExercises.filter((exercise) => {
      const searchableText = [
        exercise.title,
        exercise.description ?? "",
        exercise.phaseName ?? "",
        currentModuleName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [currentModuleName, selectedExercises, selectedSearch]);

  const availableExercisesByPhase = React.useMemo(() => {
    const groups = new Map<string, ClassRoomAvailableExercise[]>();

    for (const exercise of filteredAvailableExercises) {
      const phaseLabel = exercise.phaseName?.trim() || "Sem fase identificada";
      const currentGroup = groups.get(phaseLabel) ?? [];
      currentGroup.push(exercise);
      groups.set(phaseLabel, currentGroup);
    }

    return Array.from(groups.entries()).map(([phaseName, items]) => ({
      phaseName,
      items,
    }));
  }, [filteredAvailableExercises]);

  const totalDailyExercises = React.useMemo(
    () => availableExercises.filter((exercise) => exercise.isDailyTask).length,
    [availableExercises]
  );

  const loadRooms = React.useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshingRooms(true);
      } else {
        setLoadingRooms(true);
      }

      try {
        const response = await listarSalasDaTurma(turmaId);
        setRooms(response.items);
      } catch (error) {
        onError(extractErrorMessage(error, "Erro ao carregar salas da turma"));
      } finally {
        if (silent) {
          setRefreshingRooms(false);
        } else {
          setLoadingRooms(false);
        }
      }
    },
    [onError, turmaId]
  );

  const loadAvailableExercises = React.useCallback(
    async (room: ClassRoom | null) => {
      setLoadingAvailableExercises(true);

      try {
        const response = await listarExerciciosDisponiveisSala(turmaId, room ? { roomId: room.id } : undefined);
        setAvailableExercises(response.items);
      } catch (error) {
        onError(extractErrorMessage(error, "Erro ao carregar exercicios da sala"));
        setAvailableExercises([]);
      } finally {
        setLoadingAvailableExercises(false);
      }
    },
    [onError, turmaId]
  );

  React.useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  function resetEditorState() {
    setEditorOpen(false);
    setEditingRoom(null);
    setAvailableExercises([]);
    setLoadingAvailableExercises(false);
    setSavingRoom(false);
    setFormError(null);
    setAvailableSearch("");
    setSelectedSearch("");
    setAvailablePhaseFilter(ALL_PHASES_VALUE);
    setAvailableFilter("todos");
    setForm({
      nome: "",
      targetLimited: createDefaultDeadlineValue(),
      isAuthorized: false,
      selectedExerciseIds: [],
    });
  }

  function openCreateEditor() {
    setEditingRoom(null);
    setAvailableSearch("");
    setSelectedSearch("");
    setAvailablePhaseFilter(ALL_PHASES_VALUE);
    setAvailableFilter("todos");
    setForm({
      nome: "",
      targetLimited: createDefaultDeadlineValue(),
      isAuthorized: false,
      selectedExerciseIds: [],
    });
    setFormError(null);
    setEditorOpen(true);
    void loadAvailableExercises(null);
  }

  function openEditEditor(room: ClassRoom) {
    setEditingRoom(room);
    setAvailableSearch("");
    setSelectedSearch("");
    setAvailablePhaseFilter(ALL_PHASES_VALUE);
    setAvailableFilter("todos");
    setForm({
      nome: room.nome,
      targetLimited: toDateTimeLocalInput(room.targetLimited),
      isAuthorized: room.isAuthorized,
      selectedExerciseIds: room.exercises.map((exercise) => exercise.id),
    });
    setFormError(null);
    setEditorOpen(true);
    void loadAvailableExercises(room);
  }

  function setSelectedExerciseIds(nextIds: string[]) {
    setForm((current) => ({ ...current, selectedExerciseIds: nextIds }));
  }

  function toggleExerciseSelection(exerciseId: string, checked: boolean) {
    setSelectedExerciseIds(
      checked
        ? [...form.selectedExerciseIds, exerciseId]
        : form.selectedExerciseIds.filter((currentId) => currentId !== exerciseId)
    );
  }

  function moveSelectedExercise(exerciseId: string, direction: "up" | "down") {
    const currentIndex = form.selectedExerciseIds.indexOf(exerciseId);
    if (currentIndex === -1) return;

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= form.selectedExerciseIds.length) return;

    const nextIds = [...form.selectedExerciseIds];
    [nextIds[currentIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[currentIndex]];
    setSelectedExerciseIds(nextIds);
  }

  function handleAvailableFilterChange(value: string) {
    if (value === "todos" || value === "tarefas" || value === "selecionados") {
      setAvailableFilter(value);
    }
  }

  async function handleSubmitRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = form.nome.trim();
    if (trimmedName.length < 2) {
      setFormError("Informe um nome com pelo menos 2 caracteres.");
      return;
    }

    if (!form.targetLimited) {
      setFormError("Informe o horario-limite da sala.");
      return;
    }

    const targetDate = new Date(form.targetLimited);
    if (!Number.isFinite(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
      setFormError("Escolha um horario-limite futuro.");
      return;
    }

    if (form.selectedExerciseIds.length === 0) {
      setFormError("Selecione pelo menos um exercicio para a sala.");
      return;
    }

    setSavingRoom(true);
    setFormError(null);

    try {
      const payload = {
        nome: trimmedName,
        target_limited: targetDate.toISOString(),
        is_authorized: form.isAuthorized,
        exercise_ids: form.selectedExerciseIds,
      };

      if (editingRoom) {
        await atualizarSalaDaTurma(turmaId, editingRoom.id, payload);
        onSuccess("Sala atualizada com sucesso.");
      } else {
        await criarSalaDaTurma(turmaId, payload);
        onSuccess("Sala criada com sucesso.");
      }

      resetEditorState();
      await loadRooms({ silent: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, "Erro ao salvar sala"));
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleToggleRoomStatus(room: ClassRoom, isAuthorized: boolean) {
    setStatusBusyRoomId(room.id);

    try {
      await atualizarStatusSalaDaTurma(turmaId, room.id, { is_authorized: isAuthorized });
      onSuccess(isAuthorized ? "Sala aberta com sucesso." : "Sala fechada com sucesso.");
      await loadRooms({ silent: true });
    } catch (error) {
      onError(extractErrorMessage(error, "Erro ao atualizar status da sala"));
    } finally {
      setStatusBusyRoomId(null);
    }
  }

  async function handleDeleteRoom() {
    if (!deleteTarget) return;

    setDeletingRoomId(deleteTarget.id);

    try {
      await deletarSalaDaTurma(turmaId, deleteTarget.id);
      onSuccess("Sala removida com sucesso.");
      setDeleteTarget(null);
      await loadRooms({ silent: true });
    } catch (error) {
      onError(extractErrorMessage(error, "Erro ao remover sala"));
    } finally {
      setDeletingRoomId(null);
    }
  }

  const nextClosingRoom = [...rooms]
    .filter((room) => room.targetLimited && new Date(room.targetLimited).getTime() > Date.now())
    .sort((left, right) => {
      const leftValue = left.targetLimited ? new Date(left.targetLimited).getTime() : Number.POSITIVE_INFINITY;
      const rightValue = right.targetLimited ? new Date(right.targetLimited).getTime() : Number.POSITIVE_INFINITY;
      return leftValue - rightValue;
    })[0] ?? null;

  return (
    <>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Sala de aula</h2>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {rooms.length} sala{rooms.length === 1 ? "" : "s"}
                </Badge>
                {currentModuleName ? (
                  <Badge className="rounded-full border-primary/25 bg-primary/10 px-3 py-1 text-primary">
                    Modulo atual: {currentModuleName}
                  </Badge>
                ) : null}
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Organize exercicios por aula dentro de {turmaNome}, com abertura manual e fechamento pelo horario-limite.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                onClick={() => void loadRooms({ silent: true })}
                disabled={loadingRooms || refreshingRooms}
              >
                {refreshingRooms ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
                Atualizar
              </Button>
              {canManage ? (
                <Button type="button" className="h-11 rounded-xl px-4" onClick={openCreateEditor}>
                  <Plus />
                  Nova sala
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="ring-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="text-primary" />
                  Salas registradas
                </CardTitle>
                <CardDescription>Total de agrupamentos ativos no fluxo da turma.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black tracking-[-0.05em] text-foreground">{rooms.length}</div>
              </CardContent>
            </Card>

            <Card className="ring-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DoorOpen className="text-emerald-500" />
                  Salas abertas
                </CardTitle>
                <CardDescription>Salas autorizadas e ainda dentro do horario-limite.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black tracking-[-0.05em] text-foreground">
                  {rooms.filter((room) => room.status === "aberta").length}
                </div>
              </CardContent>
            </Card>

            <Card className="ring-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="text-amber-500" />
                  Proximo fechamento
                </CardTitle>
                <CardDescription>Menor deadline futuro entre as salas da turma.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold text-foreground">
                  {nextClosingRoom ? formatDateTime(nextClosingRoom.targetLimited) : "Nenhum deadline futuro"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {loadingRooms ? (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={`room-skeleton-${index}`} className="ring-border/70">
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full max-w-[22rem]" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <Card className="rounded-[28px] ring-border/70">
            <CardHeader>
              <CardTitle>Nenhuma sala registrada</CardTitle>
              <CardDescription>
                Crie uma sala para agrupar exercicios da aula e controlar a liberacao manual para os alunos.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-between gap-3">
              <span className="text-sm text-muted-foreground">As salas usam o schema atual sem novas tabelas.</span>
              {canManage ? (
                <Button type="button" onClick={openCreateEditor}>
                  <Plus />
                  Criar primeira sala
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {rooms.map((room) => {
              const statusMeta = getRoomStatusMeta(room.status);
              const isStatusBusy = statusBusyRoomId === room.id;

              return (
                <ContextMenu key={room.id}>
                  <ContextMenuTrigger className="w-full">
                    <Card className="rounded-[28px] ring-border/70 shadow-sm transition hover:ring-primary/20">
                      <CardHeader className="border-b border-border/60 pb-4">
                        <CardAction>
                          <Badge className={cn("rounded-full px-3 py-1", statusMeta.className)}>
                            <statusMeta.Icon data-icon="inline-start" />
                            {statusMeta.label}
                          </Badge>
                        </CardAction>
                        <CardTitle className="pr-24 text-xl font-bold tracking-tight">{room.nome}</CardTitle>
                        <CardDescription>
                          {room.totalExercises} exercicio{room.totalExercises === 1 ? "" : "s"} agrupado{room.totalExercises === 1 ? "" : "s"} nesta sala.
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4 py-1">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            <CalendarClock data-icon="inline-start" />
                            {formatDateTime(room.targetLimited)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {room.isAuthorized ? (
                              <>
                                <CheckCircle2 data-icon="inline-start" />
                                Liberada
                              </>
                            ) : (
                              <>
                                <DoorClosed data-icon="inline-start" />
                                Fechada manualmente
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="rounded-[24px] border border-border/70 bg-background/75 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-foreground">Exercicios da sala</div>
                            <div className="text-xs text-muted-foreground">Clique direito no card para acoes rapidas.</div>
                          </div>

                          <div className="space-y-3">
                            {room.exercises.map((exercise, index) => (
                              <React.Fragment key={`${room.id}-${exercise.id}`}>
                                {index > 0 ? <Separator /> : null}
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                                      #{index + 1}
                                    </Badge>
                                    <div className="text-sm font-semibold text-foreground">{exercise.title}</div>
                                    {exercise.isDailyTask ? (
                                      <Badge className="rounded-full border-primary/25 bg-primary/10 px-2.5 py-0.5 text-primary">
                                        Tarefa diaria
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="text-sm leading-6 text-muted-foreground">
                                    {exercise.description?.trim() || "Sem descricao cadastrada."}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {exercise.phaseName ? `Fase: ${exercise.phaseName}` : "Fase nao identificada"}
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="justify-between gap-3">
                        <span className="text-xs text-muted-foreground">Criada em {formatDateTime(room.createdAt)}</span>
                        {canManage ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => openEditEditor(room)}
                            >
                              <Pencil />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant={room.isAuthorized ? "secondary" : "default"}
                              size="sm"
                              className="rounded-xl"
                              disabled={isStatusBusy || room.status === "encerrada"}
                              onClick={() => void handleToggleRoomStatus(room, !room.isAuthorized)}
                            >
                              {isStatusBusy ? (
                                <Loader2 className="animate-spin" />
                              ) : room.isAuthorized ? (
                                <DoorClosed />
                              ) : (
                                <DoorOpen />
                              )}
                              {room.isAuthorized ? "Fechar" : "Abrir"}
                            </Button>
                          </div>
                        ) : null}
                      </CardFooter>
                    </Card>
                  </ContextMenuTrigger>

                  {canManage ? (
                    <ContextMenuContent className="w-56">
                      <ContextMenuLabel>Acoes da sala</ContextMenuLabel>
                      <ContextMenuGroup>
                        <ContextMenuItem
                          onClick={() => void handleToggleRoomStatus(room, true)}
                          disabled={isStatusBusy || room.isAuthorized || room.status === "encerrada"}
                        >
                          <DoorOpen />
                          Abrir sala
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => void handleToggleRoomStatus(room, false)}
                          disabled={isStatusBusy || !room.isAuthorized}
                        >
                          <DoorClosed />
                          Fechar sala
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => openEditEditor(room)}>
                          <Pencil />
                          Editar sala
                        </ContextMenuItem>
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onClick={() => setDeleteTarget(room)}>
                        <Trash2 />
                        Excluir sala
                      </ContextMenuItem>
                    </ContextMenuContent>
                  ) : null}
                </ContextMenu>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={editorOpen} onOpenChange={(open) => (!open ? resetEditorState() : setEditorOpen(true))}>
        <DialogContent
          className="flex max-h-[min(97vh,1080px)] w-[min(96vw,72rem)] max-w-none flex-col overflow-y-auto overscroll-contain p-0"
          showCloseButton={!savingRoom}
        >
          <DialogHeader className="shrink-0 border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  {editingRoom ? <Pencil /> : <Sparkles />}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <DialogTitle>{editingRoom ? "Editar sala de aula" : "Nova sala de aula"}</DialogTitle>
                  <DialogDescription>
                    Defina nome, horario-limite e a ordem dos exercicios da sala. A abertura continua manual.
                  </DialogDescription>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      Turma: {turmaNome}
                    </Badge>
                    {currentModuleName ? (
                      <Badge className="rounded-full border-primary/25 bg-primary/10 px-3 py-1 text-primary">
                        Modulo atual: {currentModuleName}
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {form.selectedExerciseIds.length} selecionado
                      {form.selectedExerciseIds.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/90 px-3.5 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Disponiveis</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{availableExercises.length}</div>
                  <div className="text-xs text-muted-foreground">livres no modulo atual</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/90 px-3.5 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tarefas diarias</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{totalDailyExercises}</div>
                  <div className="text-xs text-muted-foreground">podem virar sala</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/90 px-3.5 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Prazo final</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {form.targetLimited ? formatDateTime(new Date(form.targetLimited).toISOString()) : "Nao definido"}
                  </div>
                  <div className="text-xs text-muted-foreground">sera sincronizado com os exercicios</div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <form className="flex flex-1 flex-col" onSubmit={handleSubmitRoom}>
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
              <div className="flex min-h-0 flex-col gap-4 border-b border-border/70 px-5 py-4 lg:border-r lg:border-b-0 sm:px-6">
              <Card size="sm" className="rounded-[24px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="flex flex-col gap-2">
                  <CardTitle>Configuracao da sala</CardTitle>
                  <CardDescription>
                    Nomeie a sala, defina o horario-limite e decida se ela ja sai aberta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                  Nome da sala
                  <Input
                    value={form.nome}
                    onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Ex: Aula 07 - Layout Responsivo"
                    className="h-10 rounded-xl"
                    disabled={savingRoom}
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                  Horario-limite
                  <Input
                    type="datetime-local"
                    value={form.targetLimited}
                    onChange={(event) => setForm((current) => ({ ...current, targetLimited: event.target.value }))}
                    className="h-10 rounded-xl"
                    disabled={savingRoom}
                  />
                </label>
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-foreground">
                    <Checkbox
                      checked={form.isAuthorized}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({ ...current, isAuthorized: checked === true }))
                      }
                      disabled={savingRoom}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">Abrir sala imediatamente</span>
                      <span className="text-xs font-normal leading-5 text-muted-foreground">
                        Se desmarcado, a sala fica como rascunho ate ser aberta manualmente.
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>

              <Card className="flex flex-col rounded-[24px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="flex items-center gap-2">
                        <ListFilter size={18} />
                        Exercicios disponiveis
                      </CardTitle>
                      <CardDescription>
                        Apenas exercicios do modulo atual da turma e livres de outras salas.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {filteredAvailableExercises.length} resultado
                        {filteredAvailableExercises.length === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {form.selectedExerciseIds.length} selecionado
                        {form.selectedExerciseIds.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {currentModuleName ? (
                      <Badge className="w-fit rounded-full border-primary/25 bg-primary/10 px-3 py-1 text-primary">
                        Modulo atual: {currentModuleName}
                      </Badge>
                    ) : null}

                    <div className="overflow-x-auto pb-1">
                      <div className="flex w-max min-w-full items-center gap-3 pr-2">
                        <div className="relative w-[16rem] shrink-0">
                          <Search
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
                          />
                          <Input
                            value={availableSearch}
                            onChange={(event) => setAvailableSearch(event.target.value)}
                            placeholder="Buscar exercicios"
                            className="h-11 rounded-xl pr-3"
                            style={{ paddingLeft: "3rem" }}
                            disabled={savingRoom}
                          />
                        </div>

                        <div className="w-[18rem] shrink-0">
                          <Select
                            value={availablePhaseFilter}
                            onValueChange={setAvailablePhaseFilter}
                            disabled={savingRoom || availablePhaseOptions.length === 0}
                          >
                            <SelectTrigger className="h-11 w-full rounded-xl px-3.5 text-left">
                              <SelectValue placeholder="Todas as fases" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value={ALL_PHASES_VALUE}>Todas as fases</SelectItem>
                                {availablePhaseOptions.map((phaseName) => (
                                  <SelectItem key={phaseName} value={phaseName}>
                                    {phaseName}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>

                        <ToggleGroup
                          type="single"
                          value={availableFilter}
                          onValueChange={handleAvailableFilterChange}
                          disabled={savingRoom}
                          className="shrink-0 justify-start rounded-2xl border border-border/70 bg-background/80 p-1"
                        >
                          <ToggleGroupItem value="todos" className="rounded-xl px-3">
                            Todos
                          </ToggleGroupItem>
                          <ToggleGroupItem value="tarefas" className="rounded-xl px-3">
                            Tarefa diaria
                          </ToggleGroupItem>
                          <ToggleGroupItem value="selecionados" className="rounded-xl px-3">
                            Selecionados
                          </ToggleGroupItem>
                        </ToggleGroup>

                      </div>
                    </div>

                    {availableSearch ||
                    availableFilter !== "todos" ||
                    availablePhaseFilter !== ALL_PHASES_VALUE ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-fit rounded-xl"
                          onClick={() => {
                            setAvailableSearch("");
                            setAvailablePhaseFilter(ALL_PHASES_VALUE);
                            setAvailableFilter("todos");
                          }}
                          disabled={savingRoom}
                        >
                          <X data-icon="inline-start" />
                          Limpar filtros
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="flex overflow-hidden">
                  <ScrollArea className="max-h-[32rem] w-full rounded-[22px] border border-border/70 bg-background/70">
                    <div className="flex flex-col gap-4 p-4">
                      {loadingAvailableExercises ? (
                        Array.from({ length: 5 }).map((_, index) => (
                          <div
                            key={`available-exercise-skeleton-${index}`}
                            className="flex flex-col gap-2 rounded-2xl border border-border/60 p-4"
                          >
                            <Skeleton className="h-5 w-44" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        ))
                      ) : availableExercises.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                          Nenhum exercicio disponivel para esta sala no modulo atual.
                        </div>
                      ) : filteredAvailableExercises.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                          Nenhum exercicio encontrado com os filtros atuais.
                        </div>
                      ) : (
                        availableExercisesByPhase.map((group, groupIndex) => (
                          <div key={`available-phase-${group.phaseName}`} className="flex flex-col gap-3">
                            {groupIndex > 0 ? <Separator /> : null}
                            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                                  Fase
                                </Badge>
                                <div className="text-sm font-semibold text-foreground">{group.phaseName}</div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {group.items.length} exercicio{group.items.length === 1 ? "" : "s"}
                              </div>
                            </div>

                            {group.items.map((exercise) => {
                              const checked = form.selectedExerciseIds.includes(exercise.id);

                              return (
                                <label
                                  key={exercise.id}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-[24px] border px-4 py-4 transition",
                                    checked
                                      ? "border-primary/30 bg-primary/5 shadow-sm"
                                      : "border-border/70 bg-background/85 hover:border-primary/20 hover:bg-muted/20"
                                  )}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) =>
                                      toggleExerciseSelection(exercise.id, value === true)
                                    }
                                    disabled={savingRoom}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-foreground">{exercise.title}</div>
                                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                                        {currentModuleName || "Modulo atual"}
                                      </Badge>
                                      {exercise.isDailyTask ? (
                                        <Badge className="rounded-full border-primary/25 bg-primary/10 px-2.5 py-0.5 text-primary">
                                          Tarefa diaria
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="mt-3 text-sm leading-6 text-muted-foreground">
                                      {exercise.description?.trim() || "Sem descricao cadastrada."}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      <span>
                                        {exercise.phaseName
                                          ? `Fase: ${exercise.phaseName}`
                                          : "Fase nao identificada"}
                                      </span>
                                      <span>{`Prazo atual: ${formatDateTime(exercise.termAt)}`}</span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

              <div className="flex min-h-0 flex-col gap-4 px-5 py-5 sm:px-6">
              <Card className="flex min-h-0 flex-1 flex-col rounded-[24px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle>Ordem da sala</CardTitle>
                      <CardDescription>
                        Essa ordem sera preservada ao recriar os vinculos em class_room_exercises.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {filteredSelectedExercises.length} item
                      {filteredSelectedExercises.length === 1 ? " visivel" : "s visiveis"}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        value={selectedSearch}
                        onChange={(event) => setSelectedSearch(event.target.value)}
                        placeholder="Buscar entre os exercicios selecionados"
                        className="h-11 rounded-xl"
                        style={{ paddingLeft: "2.75rem" }}
                        disabled={savingRoom || selectedExercises.length === 0}
                      />
                    </div>

                    {selectedSearch ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setSelectedSearch("")}
                          disabled={savingRoom}
                        >
                          <X data-icon="inline-start" />
                          Limpar busca
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 overflow-hidden">
                  <ScrollArea className="min-h-[18rem] flex-1 rounded-[22px] border border-border/70 bg-background/70 lg:min-h-0 lg:h-auto">
                    <div className="flex flex-col gap-3 p-4">
                      {selectedExercises.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                          Selecione exercicios ao lado para montar a sala.
                        </div>
                      ) : filteredSelectedExercises.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhum exercicio selecionado corresponde a essa busca.
                        </div>
                      ) : (
                        filteredSelectedExercises.map((exercise) => {
                          const exercisePosition = form.selectedExerciseIds.indexOf(exercise.id);

                          return (
                            <div
                              key={`selected-exercise-${exercise.id}`}
                              className="rounded-[24px] border border-border/70 bg-background/80 p-4"
                            >
                              <div className="flex items-start gap-3">
                                <Badge variant="secondary" className="mt-0.5 rounded-full px-2.5 py-0.5">
                                  #{exercisePosition + 1}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-foreground">{exercise.title}</div>
                                    {exercise.isDailyTask ? (
                                      <Badge className="rounded-full border-primary/25 bg-primary/10 px-2.5 py-0.5 text-primary">
                                        Tarefa diaria
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                    {currentModuleName
                                      ? `Modulo atual: ${currentModuleName}`
                                      : "Modulo atual da turma"}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {exercise.phaseName ? `Fase: ${exercise.phaseName}` : "Fase nao identificada"}
                                  </div>
                                  <div className="mt-3 text-sm leading-6 text-muted-foreground">
                                    {exercise.description?.trim() || "Sem descricao cadastrada."}
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="rounded-xl"
                                    onClick={() => toggleExerciseSelection(exercise.id, false)}
                                    disabled={savingRoom}
                                  >
                                    <X />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    className="rounded-xl"
                                    onClick={() => moveSelectedExercise(exercise.id, "up")}
                                    disabled={savingRoom || exercisePosition === 0}
                                  >
                                    <ArrowUp />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    className="rounded-xl"
                                    onClick={() => moveSelectedExercise(exercise.id, "down")}
                                    disabled={
                                      savingRoom || exercisePosition === selectedExercises.length - 1
                                    }
                                  >
                                    <ArrowDown />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {formError ? (
                <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              ) : null}
            </div>
            </div>

            <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border/70 bg-background/80 px-4"
                onClick={resetEditorState}
                disabled={savingRoom}
              >
                Cancelar
              </Button>
              <Button type="submit" className="h-11 rounded-xl px-4" disabled={savingRoom || loadingAvailableExercises}>
                {savingRoom ? <Loader2 className="animate-spin" /> : editingRoom ? <Pencil /> : <Plus />}
                {editingRoom ? "Salvar sala" : "Criar sala"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sala de aula</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Tem certeza que deseja excluir "${deleteTarget.nome}"? Os vinculos com exercicios serao removidos e o prazo sincronizado sera limpo.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingRoomId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteRoom()} disabled={Boolean(deletingRoomId)}>
              {deletingRoomId ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Excluir sala
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
