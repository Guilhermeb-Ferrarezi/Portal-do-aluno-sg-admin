import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import PaginatedSelect, { type PaginatedSelectOption } from "../components/PaginatedSelect";
import { AnimatedToast } from "../components/animate-ui";
import { Skeleton } from "../components/ui/skeleton";
import {
  atribuirGoalAoAluno,
  atualizarGoal,
  atualizarGoalReward,
  atualizarProgressoAluno,
  criarGoal,
  criarGoalReward,
  deletarGoal,
  deletarGoalReward,
  deletarGoalStudent,
  getRole,
  listarAlunos,
  listarBadges,
  listarCursos,
  listarGoals,
  listarGoalRewards,
  listarGoalStudents,
  resgatarRecompensa,
  type Badge as ApiBadge,
  type Curso,
  type Goal,
  type GoalType,
  type GoalReward,
  type GoalStudent,
  type User,
  GOAL_TYPE,
} from "../services/api";
import { Copy, Gift, MoreHorizontal, Plus, Target, Trophy, Users } from "lucide-react";

type AdminTab = "goals" | "rewards" | "students";

type GoalFormState = {
  name: string;
  description: string;
  type: string;
};

type PointsSubtype = "basic" | "between-dates";

type RewardFormState = {
  goalId: string;
  badgeId: string;
  badgeIds: string[];
  courseId: string;
  pointsSubtype: PointsSubtype;
  pointsTarget: string;
  points: string;
  startDateTarget: string;
  endDateTarget: string;
};

type StudentFormState = {
  userId: string;
  goalRewardId: string;
  courseId: string;
  progress: string;
  isCompleted: boolean;
};

type RewardGroup = {
  goalId: string;
  goalName: string;
  rewards: GoalReward[];
};

const pageWrapClass = "flex flex-col gap-6";
const cardClass =
  "rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(225,29,46,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] bg-card/95 shadow-[0_18px_44px_rgba(0,0,0,0.14)]";
const panelClass = cn(cardClass, "p-5 sm:p-6");
const tabListClass =
  "inline-flex max-w-full flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-card/80 p-2";
const tabButtonClass = (active: boolean) =>
  cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
    active
      ? "border-primary/45 bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(225,29,46,0.25)]"
      : "border-border/70 bg-muted/45 text-foreground hover:border-primary/30 hover:bg-accent"
  );
const fieldClass =
  "h-11 w-full rounded-2xl border border-border/75 bg-card px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-muted-foreground/90 hover:border-primary/35 focus:border-primary focus:ring-4 focus:ring-ring/30";
const textareaClass = cn(fieldClass, "min-h-28 h-auto py-3");
const sectionHeaderClass = "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";
const statGridClass = "grid gap-4 md:grid-cols-3";
const statCardClass = "rounded-[24px] border border-border/70 bg-card/90 p-4";
const emptyClass =
  "rounded-[24px] border border-dashed border-border/70 bg-muted/25 px-6 py-10 text-center text-sm text-muted-foreground";
const modalSectionClass =
  "rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6";
const modalSectionTitleClass = "text-lg font-black tracking-[-0.03em] text-foreground";
const modalSectionBodyClass = "mt-1 text-sm leading-6 text-muted-foreground";
const modalLabelClass = "text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground";

function formatDate(value: string | null | undefined) {
  if (!value) return "Nao definido";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nao definido";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDatetimeLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromDatetimeLocalInput(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function goalTypeLabel(value: number | null) {
  if (value === GOAL_TYPE.CourseCompletion) return "Conclusao de curso";
  if (value === GOAL_TYPE.PhaseCompletion) return "Conclusao de fase";
  if (value === GOAL_TYPE.PointQuantity) return "Quantidade de pontos";
  if (value === GOAL_TYPE.TimeSpent) return "Tempo gasto";
  if (value === GOAL_TYPE.Custom) return "Personalizada";
  return "Tipo nao definido";
}

function goalTypeDescription(value: number | null) {
  if (value === GOAL_TYPE.CourseCompletion) return "Conclui quando o aluno finalizar um curso completo.";
  if (value === GOAL_TYPE.PhaseCompletion) return "Conclui quando o aluno terminar uma fase especifica.";
  if (value === GOAL_TYPE.PointQuantity) return "Usa acumulacao de pontos como criterio principal.";
  if (value === GOAL_TYPE.TimeSpent) return "Usa tempo de estudo ou permanencia como criterio.";
  if (value === GOAL_TYPE.Custom) return "Permite uma regra manual ou criterio definido pela equipe.";
  return "Selecione o comportamento principal da meta.";
}

function isGoalType(value: number | null | undefined): value is GoalType {
  return value === GOAL_TYPE.CourseCompletion ||
    value === GOAL_TYPE.PhaseCompletion ||
    value === GOAL_TYPE.PointQuantity ||
    value === GOAL_TYPE.TimeSpent ||
    value === GOAL_TYPE.Custom;
}

function rewardStatus(student: GoalStudent) {
  if (student.rewardClaimed) return "Recompensa resgatada";
  if (student.isCompleted) return "Recompensa disponivel";
  return "Em andamento";
}

function progressPercent(student: GoalStudent) {
  const target = student.reward.pointsTarget ?? 0;
  if (target <= 0) return student.isCompleted ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((student.progress / target) * 100)));
}

function buildGoalForm(goal?: Goal): GoalFormState {
  return {
    name: goal?.name ?? "",
    description: goal?.description ?? "",
    type: isGoalType(goal?.type) ? String(goal.type) : String(GOAL_TYPE.CourseCompletion),
  };
}

function inferPointsSubtype(_reward?: GoalReward): PointsSubtype {
  // TODO(human): classify an existing reward as "basic" or "between-dates"
  // based on its date fields. Consider: are startDateTarget/endDateTarget
  // meaningful (user-chosen future window), or just placeholder "current date"
  // values we write when the subtype is basic?
  return "basic";
}

function buildRewardForm(reward?: GoalReward): RewardFormState {
  return {
    goalId: reward?.goalId ?? "",
    badgeId: reward?.badgeId ?? "",
    badgeIds: reward?.badgeId ? [reward.badgeId] : [],
    courseId: reward?.courseId ?? "",
    pointsSubtype: inferPointsSubtype(reward),
    pointsTarget: reward?.pointsTarget != null ? String(reward.pointsTarget) : "",
    points: reward?.points != null ? String(reward.points) : "",
    startDateTarget: toDatetimeLocalInput(reward?.startDateTarget),
    endDateTarget: toDatetimeLocalInput(reward?.endDateTarget),
  };
}

function normalizeRewardWindow(form: RewardFormState) {
  if (form.pointsSubtype !== "between-dates") {
    return {
      startDateTarget: null,
      endDateTarget: null,
    };
  }

  return {
    startDateTarget: fromDatetimeLocalInput(form.startDateTarget),
    endDateTarget: fromDatetimeLocalInput(form.endDateTarget),
  };
}

function buildStudentForm(student?: GoalStudent): StudentFormState {
  return {
    userId: student?.user.id ?? "",
    goalRewardId: student?.goalRewardId ?? "",
    courseId: student?.courseId ?? "",
    progress: student ? String(student.progress) : "0",
    isCompleted: student?.isCompleted ?? false,
  };
}

function compactSelectedOption(
  options: PaginatedSelectOption[],
  value: string
): PaginatedSelectOption | null {
  const found = options.find((item) => item.value === value);
  if (!found) return null;
  return {
    value: found.value,
    label: found.label,
  };
}

export default function MetasPage() {
  const role = getRole();
  const canManage = role === "admin";
  const isTeacher = role === "professor";
  const isStudent = role === "aluno";
  const [activeTab, setActiveTab] = React.useState<AdminTab>(canManage ? "goals" : "students");

  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [allGoals, setAllGoals] = React.useState<Goal[]>([]);
  const [rewards, setRewards] = React.useState<GoalReward[]>([]);
  const [allRewards, setAllRewards] = React.useState<GoalReward[]>([]);
  const [students, setStudents] = React.useState<GoalStudent[]>([]);
  const [courses, setCourses] = React.useState<Curso[]>([]);
  const [badges, setBadges] = React.useState<ApiBadge[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);

  const [goalsTotal, setGoalsTotal] = React.useState(0);
  const [studentsTotal, setStudentsTotal] = React.useState(0);

  const [goalsPage, setGoalsPage] = React.useState(1);
  const [goalsPerPage, setGoalsPerPage] = React.useState(6);
  const [rewardsPage, setRewardsPage] = React.useState(1);
  const [rewardsPerPage, setRewardsPerPage] = React.useState(6);
  const [studentsPage, setStudentsPage] = React.useState(1);
  const [studentsPerPage, setStudentsPerPage] = React.useState(8);

  const [goalSearch, setGoalSearch] = React.useState("");
  const deferredGoalSearch = React.useDeferredValue(goalSearch);
  const [rewardGoalFilter, setRewardGoalFilter] = React.useState("");
  const [rewardCourseFilter, setRewardCourseFilter] = React.useState("");
  const [studentCourseFilter, setStudentCourseFilter] = React.useState("");
  const [studentRewardFilter, setStudentRewardFilter] = React.useState("");

  const [loadingGoals, setLoadingGoals] = React.useState(true);
  const [loadingRewards, setLoadingRewards] = React.useState(true);
  const [loadingStudents, setLoadingStudents] = React.useState(true);
  const [loadingOptions, setLoadingOptions] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [claimingId, setClaimingId] = React.useState<string | null>(null);
  const [expandedRewardGroups, setExpandedRewardGroups] = React.useState<Record<string, boolean>>({});
  const [selectedRewardIds, setSelectedRewardIds] = React.useState<Record<string, boolean>>({});

  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [metaModalOpen, setMetaModalOpen] = React.useState(false);
  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [rewardModalOpen, setRewardModalOpen] = React.useState(false);
  const [assignModalOpen, setAssignModalOpen] = React.useState(false);
  const [progressModalOpen, setProgressModalOpen] = React.useState(false);

  const [editingGoal, setEditingGoal] = React.useState<Goal | null>(null);
  const [editingReward, setEditingReward] = React.useState<GoalReward | null>(null);
  const [editingStudent, setEditingStudent] = React.useState<GoalStudent | null>(null);
  const [editingAssignmentStudent, setEditingAssignmentStudent] = React.useState<GoalStudent | null>(null);
  const [deletingGoalItem, setDeletingGoalItem] = React.useState<Goal | null>(null);
  const [deletingRewardItem, setDeletingRewardItem] = React.useState<GoalReward | null>(null);
  const [deletingStudentItem, setDeletingStudentItem] = React.useState<GoalStudent | null>(null);

  const [goalForm, setGoalForm] = React.useState<GoalFormState>(buildGoalForm());
  const [rewardForm, setRewardForm] = React.useState<RewardFormState>(buildRewardForm());
  const [studentForm, setStudentForm] = React.useState<StudentFormState>(buildStudentForm());
  const selectedGoalType = Number(goalForm.type) as GoalType;
  const selectedRewardGoalType = React.useMemo(() => {
    const goal = allGoals.find((item) => item.id === rewardForm.goalId);
    return goal?.type ?? null;
  }, [allGoals, rewardForm.goalId]);

  const goalOptions = React.useMemo<PaginatedSelectOption[]>(
    () =>
      allGoals.map((goal) => ({
        value: goal.id,
        label: goal.name,
        meta: goal.description || goalTypeLabel(goal.type),
      })),
    [allGoals]
  );

  const badgeOptions = React.useMemo<PaginatedSelectOption[]>(
    () =>
      badges.map((badge) => ({
        value: badge.id,
        label: badge.name,
        meta: badge.description || "Medalha",
      })),
    [badges]
  );

  const courseOptions = React.useMemo<PaginatedSelectOption[]>(
    () =>
      courses.map((course) => ({
        value: course.id,
        label: course.nome,
        meta: course.descricao || "Curso",
      })),
    [courses]
  );

  const studentOptions = React.useMemo<PaginatedSelectOption[]>(
    () =>
      users.map((user) => ({
        value: user.id,
        label: user.nome,
        meta: user.email || user.usuario || "Aluno",
      })),
    [users]
  );

  const rewardOptions = React.useMemo<PaginatedSelectOption[]>(
    () =>
      allRewards.map((reward) => ({
        value: reward.id,
        label: reward.goalName,
        meta: `${reward.courseName} - ${reward.badgeName}`,
      })),
    [allRewards]
  );

  const selectedBadgeChips = React.useMemo(
    () => rewardForm.badgeIds.map((badgeId) => badgeOptions.find((item) => item.value === badgeId)).filter(Boolean) as PaginatedSelectOption[],
    [badgeOptions, rewardForm.badgeIds]
  );

  const totalPointsTracked = React.useMemo(
    () => students.reduce((sum, item) => sum + item.progress, 0),
    [students]
  );

  const completedCount = React.useMemo(
    () => students.filter((item) => item.isCompleted).length,
    [students]
  );

  const claimedCount = React.useMemo(
    () => students.filter((item) => item.rewardClaimed).length,
    [students]
  );

  const rewardGroups = React.useMemo<RewardGroup[]>(() => {
    const grouped = new Map<string, RewardGroup>();

    for (const reward of rewards) {
      const existing = grouped.get(reward.goalId);
      if (existing) {
        existing.rewards.push(reward);
        continue;
      }

      grouped.set(reward.goalId, {
        goalId: reward.goalId,
        goalName: reward.goalName,
        rewards: [reward],
      });
    }

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      rewards: [...group.rewards].sort((a, b) => {
        const courseCompare = a.courseName.localeCompare(b.courseName, "pt-BR");
        if (courseCompare !== 0) return courseCompare;
        return a.badgeName.localeCompare(b.badgeName, "pt-BR");
      }),
    }));
  }, [rewards]);

  const paginatedRewardGroups = React.useMemo(() => {
    const start = (rewardsPage - 1) * rewardsPerPage;
    return rewardGroups.slice(start, start + rewardsPerPage);
  }, [rewardGroups, rewardsPage, rewardsPerPage]);

  const loadGoals = React.useCallback(async () => {
    if (!canManage) return;
    setLoadingGoals(true);
    try {
      const response = await listarGoals({
        q: deferredGoalSearch.trim() || undefined,
        limit: goalsPerPage,
        offset: (goalsPage - 1) * goalsPerPage,
      });
      setGoals(response.items);
      setGoalsTotal(response.total);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar metas");
    } finally {
      setLoadingGoals(false);
    }
  }, [canManage, deferredGoalSearch, goalsPage, goalsPerPage]);

  const loadRewards = React.useCallback(async () => {
    if (!(canManage || isTeacher)) return;
    setLoadingRewards(true);
    try {
      const response = await listarGoalRewards({
        goalId: rewardGoalFilter || undefined,
        courseId: rewardCourseFilter || undefined,
        limit: 1000,
        offset: 0,
      });
      setRewards(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar recompensas");
    } finally {
      setLoadingRewards(false);
    }
  }, [canManage, isTeacher, rewardCourseFilter, rewardGoalFilter]);

  const loadStudents = React.useCallback(async () => {
    setLoadingStudents(true);
    try {
      const response = await listarGoalStudents({
        courseId: studentCourseFilter || undefined,
        goalRewardId: studentRewardFilter || undefined,
        limit: studentsPerPage,
        offset: (studentsPage - 1) * studentsPerPage,
      });
      setStudents(response.items);
      setStudentsTotal(response.total);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar progresso");
    } finally {
      setLoadingStudents(false);
    }
  }, [studentCourseFilter, studentRewardFilter, studentsPage, studentsPerPage]);

  React.useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  React.useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  React.useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  React.useEffect(() => {
    setLoadingOptions(true);
    const promises: Array<Promise<unknown>> = [listarCursos().then((result) => setCourses(result as Curso[]))];
    if (canManage || isTeacher) {
      promises.push(listarGoalRewards({ limit: 100, offset: 0 }).then((result) => setAllRewards(result.items)));
    }
    if (canManage) {
      promises.push(listarBadges({ limit: 100, offset: 0 }).then((result) => setBadges(result.items)));
      promises.push(listarAlunos().then(setUsers));
      promises.push(listarGoals({ limit: 100, offset: 0 }).then((result) => setAllGoals(result.items)));
    }

    Promise.all(promises)
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar opcoes");
      })
      .finally(() => setLoadingOptions(false));
  }, [canManage, isTeacher]);

  React.useEffect(() => {
    setGoalsPage(1);
  }, [deferredGoalSearch]);

  React.useEffect(() => {
    setRewardsPage(1);
  }, [rewardCourseFilter, rewardGoalFilter]);

  function toggleRewardSelection(rewardId: string, checked: boolean) {
    setSelectedRewardIds((current) => {
      if (!checked) {
        const next = { ...current };
        delete next[rewardId];
        return next;
      }

      return {
        ...current,
        [rewardId]: true,
      };
    });
  }

  function toggleRewardGroupSelection(group: RewardGroup, checked: boolean) {
    setSelectedRewardIds((current) => {
      const next = { ...current };

      for (const reward of group.rewards) {
        if (checked) {
          next[reward.id] = true;
        } else {
          delete next[reward.id];
        }
      }

      return next;
    });
  }

  function applyUpdatedStudent(goalStudent: GoalStudent) {
    setStudents((current) => current.map((item) => (item.id === goalStudent.id ? goalStudent : item)));
    setEditingStudent((current) => (current?.id === goalStudent.id ? goalStudent : current));
    setEditingAssignmentStudent((current) => (current?.id === goalStudent.id ? goalStudent : current));
  }

  function openCreateGoalModal() {
    setEditingGoal(null);
    setEditingReward(null);
    setGoalForm(buildGoalForm());
    setRewardForm(buildRewardForm());
    setMetaModalOpen(true);
  }

  function openEditGoalModal(goal: Goal) {
    setEditingGoal(goal);
    setGoalForm(buildGoalForm(goal));
    setGoalModalOpen(true);
  }

  function openEditRewardModal(reward: GoalReward) {
    setEditingReward(reward);
    setRewardForm(buildRewardForm(reward));
    setRewardModalOpen(true);
  }

  function openAssignModal() {
    setEditingAssignmentStudent(null);
    setStudentForm(buildStudentForm());
    setAssignModalOpen(true);
  }

  function openEditAssignmentModal(student: GoalStudent) {
    setEditingAssignmentStudent(student);
    setStudentForm(buildStudentForm(student));
    setAssignModalOpen(true);
  }

  function openProgressModal(student: GoalStudent) {
    setEditingStudent(student);
    setStudentForm(buildStudentForm(student));
    setProgressModalOpen(true);
  }

  async function submitGoal() {
    if (!goalForm.name.trim()) {
      setErrorMessage("Informe o nome da meta");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: goalForm.name.trim(),
        description: goalForm.description.trim() || null,
        type: Number(goalForm.type) as GoalType,
        imageUrl: null,
      };

      if (editingGoal) {
        await atualizarGoal(editingGoal.id, payload);
        setSuccessMessage("Meta atualizada");
      } else {
        await criarGoal(payload);
        setSuccessMessage("Meta criada");
      }
      setGoalModalOpen(false);
      await Promise.all([loadGoals(), listarGoals({ limit: 100, offset: 0 }).then((result) => setAllGoals(result.items))]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao salvar meta");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReward() {
    const selectedBadgeIds = editingReward ? [rewardForm.badgeId].filter(Boolean) : rewardForm.badgeIds;
    if (!rewardForm.goalId || !rewardForm.courseId || selectedBadgeIds.length === 0) {
      setErrorMessage("Selecione meta, curso e pelo menos uma medalha");
      return;
    }

    setSubmitting(true);
    try {
      const rewardGoalType = selectedRewardGoalType;
      const rewardWindow = normalizeRewardWindow(rewardForm);
      const payloadBase = {
        goalId: rewardForm.goalId,
        courseId: rewardForm.courseId,
        rewardType: editingReward?.rewardType ?? 0,
        pointsTarget:
          rewardGoalType === GOAL_TYPE.PointQuantity && rewardForm.pointsTarget
            ? Number(rewardForm.pointsTarget)
            : null,
        points: rewardForm.points ? Number(rewardForm.points) : null,
        startDateTarget: rewardWindow.startDateTarget,
        endDateTarget: rewardWindow.endDateTarget,
      };

      if (editingReward) {
        await atualizarGoalReward(editingReward.id, {
          ...payloadBase,
          badgeId: rewardForm.badgeId,
        });
        setSuccessMessage("Recompensa atualizada");
      } else {
        await Promise.all(
          selectedBadgeIds.map((badgeId) =>
            criarGoalReward({
              ...payloadBase,
              badgeId,
            })
          )
        );
        setSuccessMessage(
          selectedBadgeIds.length > 1
            ? `${selectedBadgeIds.length} recompensas criadas`
            : "Recompensa criada"
        );
      }
      setRewardModalOpen(false);
      await Promise.all([loadRewards(), listarGoalRewards({ limit: 100, offset: 0 }).then((result) => setAllRewards(result.items))]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao salvar recompensa");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMetaCreation() {
    if (!goalForm.name.trim()) {
      setErrorMessage("Informe o nome da meta");
      return;
    }

    if (!rewardForm.courseId) {
      setErrorMessage("Selecione o curso");
      return;
    }

    if (rewardForm.badgeIds.length === 0) {
      setErrorMessage("Selecione pelo menos uma medalha");
      return;
    }

    const goalType = Number(goalForm.type) as GoalType;
    if (goalType === GOAL_TYPE.PointQuantity && !rewardForm.pointsTarget) {
      setErrorMessage("Informe os pontos alvo");
      return;
    }

    if (
      goalType === GOAL_TYPE.PointQuantity &&
      rewardForm.pointsSubtype === "between-dates" &&
      (!rewardForm.startDateTarget || !rewardForm.endDateTarget)
    ) {
      setErrorMessage("Informe inicio e fim da janela");
      return;
    }

    setSubmitting(true);
    try {
      const goalResponse = await criarGoal({
        name: goalForm.name.trim(),
        description: goalForm.description.trim() || null,
        type: goalType,
        imageUrl: null,
      });

      const rewardWindow = normalizeRewardWindow(rewardForm);
      for (const badgeId of rewardForm.badgeIds) {
        await criarGoalReward({
          goalId: goalResponse.goal.id,
          courseId: rewardForm.courseId,
          badgeId,
          rewardType: 0,
          points: rewardForm.points ? Number(rewardForm.points) : null,
          pointsTarget: goalType === GOAL_TYPE.PointQuantity ? Number(rewardForm.pointsTarget) : null,
          startDateTarget: rewardWindow.startDateTarget,
          endDateTarget: rewardWindow.endDateTarget,
        });
      }

      setMetaModalOpen(false);
      setSuccessMessage(
        rewardForm.badgeIds.length > 1
          ? `Meta criada com ${rewardForm.badgeIds.length} recompensas`
          : "Meta criada"
      );
      await Promise.all([
        loadGoals(),
        loadRewards(),
        listarGoals({ limit: 100, offset: 0 }).then((result) => setAllGoals(result.items)),
        listarGoalRewards({ limit: 100, offset: 0 }).then((result) => setAllRewards(result.items)),
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao criar meta");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStudentAssignment() {
    if (!studentForm.userId || !studentForm.goalRewardId || !studentForm.courseId) {
      setErrorMessage("Selecione aluno, recompensa e curso");
      return;
    }

    setSubmitting(true);
    try {
      if (editingAssignmentStudent) {
        await atualizarProgressoAluno(editingAssignmentStudent.id, {
          goalRewardId: studentForm.goalRewardId,
          courseId: studentForm.courseId,
        });
      } else {
        await atribuirGoalAoAluno({
          userId: studentForm.userId,
          goalRewardId: studentForm.goalRewardId,
          courseId: studentForm.courseId,
        });
      }
      setAssignModalOpen(false);
      setEditingAssignmentStudent(null);
      setSuccessMessage(editingAssignmentStudent ? "Atribuicao atualizada" : "Aluno atribuido");
      await loadStudents();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : editingAssignmentStudent ? "Erro ao atualizar atribuicao" : "Erro ao atribuir aluno");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStudentProgress() {
    if (!editingStudent) return;
    setSubmitting(true);
    try {
      const response = await atualizarProgressoAluno(editingStudent.id, {
        progress: Number(studentForm.progress || 0),
        isCompleted: studentForm.isCompleted,
      });
      applyUpdatedStudent(response.goalStudent);
      setProgressModalOpen(false);
      setEditingStudent(null);
      setSuccessMessage("Progresso atualizado");
      void loadStudents();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao atualizar progresso");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteGoal() {
    if (!deletingGoalItem) return;
    setSubmitting(true);
    try {
      await deletarGoal(deletingGoalItem.id);
      setDeletingGoalItem(null);
      setSuccessMessage("Meta excluida");
      await loadGoals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao excluir meta");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteReward() {
    if (!deletingRewardItem) return;
    setSubmitting(true);
    try {
      await deletarGoalReward(deletingRewardItem.id);
      setDeletingRewardItem(null);
      setSuccessMessage("Recompensa excluida");
      await loadRewards();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao excluir recompensa");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteStudentAssignment() {
    if (!deletingStudentItem) return;
    setSubmitting(true);
    try {
      await deletarGoalStudent(deletingStudentItem.id);
      setDeletingStudentItem(null);
      setSuccessMessage("Atribuicao removida");
      await loadStudents();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao remover atribuicao");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim(studentId: string) {
    setClaimingId(studentId);
    try {
      await resgatarRecompensa(studentId);
      setSuccessMessage("Recompensa resgatada");
      await loadStudents();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao resgatar recompensa");
    } finally {
      setClaimingId(null);
    }
  }

  async function copyStudentAssignmentSummary(student: GoalStudent) {
    const summary = [
      `Aluno: ${student.user.nome}`,
      `Meta: ${student.goal.name}`,
      `Curso: ${student.reward.courseName || "Curso nao definido"}`,
      `Recompensa: ${student.reward.badgeName || "Recompensa nao definida"}`,
      `Status: ${rewardStatus(student)}`,
      `Progresso: ${student.progress} / ${student.reward.pointsTarget ?? 0}`,
      `Fim da janela: ${formatDate(student.reward.endDateTarget)}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setSuccessMessage("Resumo da atribuicao copiado");
    } catch {
      setErrorMessage("Nao foi possivel copiar o resumo da atribuicao");
    }
  }

  function renderStats() {
    return (
      <div className={statGridClass}>
        <div className={statCardClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Progresso monitorado</div>
          <div className="mt-2 text-3xl font-black tracking-[-0.03em]">{Math.round(totalPointsTracked)}</div>
          <div className="mt-1 text-sm text-muted-foreground">Pontos acumulados nos registros carregados</div>
        </div>
        <div className={statCardClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Metas concluidas</div>
          <div className="mt-2 text-3xl font-black tracking-[-0.03em]">{completedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Alunos com objetivo finalizado</div>
        </div>
        <div className={statCardClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Claims realizados</div>
          <div className="mt-2 text-3xl font-black tracking-[-0.03em]">{claimedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Recompensas efetivamente resgatadas</div>
        </div>
      </div>
    );
  }

  function renderGoalCards() {
    if (loadingGoals) {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-[24px] border border-border/70 bg-card/90 p-4">
              <Skeleton className="h-36 rounded-[18px]" />
              <Skeleton className="mt-4 h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </div>
          ))}
        </div>
      );
    }

    if (!goals.length) {
      return <div className={emptyClass}>Nenhuma meta cadastrada com os filtros atuais.</div>;
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className="flex h-full flex-col rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
          >
            <div className="overflow-hidden rounded-[18px] border border-border/70 bg-muted/35">
              {goal.imageUrl ? (
                <img src={goal.imageUrl} alt={goal.name} className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 place-items-center bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(225,29,46,0.18))]">
                  <Target size={40} className="text-foreground" />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="min-w-0 break-words text-lg font-black tracking-[-0.02em] [overflow-wrap:anywhere]">
                    {goal.name}
                  </h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {goal.description || "Sem descricao"}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">{goalTypeLabel(goal.type)}</Badge>
              </div>
              <div className="mt-auto pt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{goal.rewardsCount} recompensas</span>
                  <span>ID {goal.id}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={() => openEditGoalModal(goal)}>
                    Editar
                  </Button>
                  <Button type="button" variant="destructive" className="rounded-full" onClick={() => setDeletingGoalItem(goal)}>
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderRewardCards() {
    if (loadingRewards) {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[24px] border border-border/70 bg-card/90 p-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      );
    }

    if (!rewardGroups.length) {
      return <div className={emptyClass}>Nenhuma recompensa encontrada.</div>;
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {paginatedRewardGroups.map((group) => (
          <div key={group.goalId} className="rounded-[24px] border border-border/70 bg-card/90 p-4">
            {(() => {
              const isExpanded = expandedRewardGroups[group.goalId] ?? false;
              const visibleRewards = isExpanded ? group.rewards : group.rewards.slice(0, 2);
              const hiddenCount = Math.max(0, group.rewards.length - visibleRewards.length);
              const selectedCount = group.rewards.filter((reward) => selectedRewardIds[reward.id]).length;
              const allSelected = group.rewards.length > 0 && selectedCount === group.rewards.length;
              const partiallySelected = selectedCount > 0 && selectedCount < group.rewards.length;

              return (
                <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Checkbox
                  className="mt-1"
                  checked={allSelected ? true : partiallySelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleRewardGroupSelection(group, checked === true)}
                  aria-label={`Selecionar recompensas da meta ${group.goalName}`}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="min-w-0 break-words text-lg font-black tracking-[-0.02em] [overflow-wrap:anywhere]">
                    {group.goalName}
                  </h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {group.rewards.length} recompensa{group.rewards.length === 1 ? "" : "s"} vinculada{group.rewards.length === 1 ? "" : "s"} a esta meta
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">{group.rewards.length} item{group.rewards.length === 1 ? "" : "s"}</Badge>
            </div>
            <div
              className={cn(
                "mt-4 grid gap-2",
                isExpanded && "max-h-[320px] overflow-y-auto pr-1"
              )}
            >
              {visibleRewards.map((reward) => (
                <div
                  key={reward.id}
                  className={cn(
                    "flex items-start gap-3 rounded-[18px] border border-border/50 bg-background/20 px-4 py-3 transition",
                    selectedRewardIds[reward.id] && "border-primary/35 bg-primary/5"
                  )}
                >
                  <Checkbox
                    className="mt-1"
                    checked={Boolean(selectedRewardIds[reward.id])}
                    onCheckedChange={(checked) => toggleRewardSelection(reward.id, checked === true)}
                    aria-label={`Selecionar recompensa ${reward.badgeName}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                          {reward.courseName} - {reward.badgeName}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Alvo: <span className="font-semibold text-foreground">{reward.pointsTarget ?? "Nao definido"}</span></span>
                          <span>Recompensa: <span className="font-semibold text-foreground">{reward.points ?? "Nao definido"}</span></span>
                          <span>Fim: <span className="font-semibold text-foreground">{formatDate(reward.endDateTarget)}</span></span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">Tipo {reward.rewardType}</Badge>
                    </div>
                    {canManage ? (
                      <div className="mt-3 flex gap-2">
                        <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={() => openEditRewardModal(reward)}>
                          Editar
                        </Button>
                        <Button type="button" variant="destructive" className="rounded-full" onClick={() => setDeletingRewardItem(reward)}>
                          Excluir
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {group.rewards.length > 2 ? (
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-primary transition hover:text-primary/80"
                onClick={() =>
                  setExpandedRewardGroups((current) => ({
                    ...current,
                    [group.goalId]: !isExpanded,
                  }))
                }
              >
                {isExpanded ? "Mostrar menos" : `Ver mais ${hiddenCount} recompensa${hiddenCount === 1 ? "" : "s"}`}
              </button>
            ) : null}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    );
  }

  function renderStudentRows() {
    if (loadingStudents) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-[20px]" />
          ))}
        </div>
      );
    }

    if (!students.length) {
      return <div className={emptyClass}>{isStudent ? "Nenhuma meta ativa para voce no momento." : "Nenhum progresso encontrado."}</div>;
    }

    if (isStudent) {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          {students.map((student) => {
            const percent = progressPercent(student);
            const status = rewardStatus(student);
            return (
              <div key={student.id} className="rounded-[24px] border border-border/70 bg-card/90 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.12)]">
                <div className="flex items-start gap-4">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[20px] border border-border/70 bg-muted/35">
                    {student.goal.imageUrl ? (
                      <img src={student.goal.imageUrl} alt={student.goal.name} className="h-full w-full object-cover" />
                    ) : (
                      <Target size={28} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words text-lg font-black tracking-[-0.02em] [overflow-wrap:anywhere]">
                        {student.goal.name}
                      </h3>
                      <Badge variant="secondary" className="shrink-0">{status}</Badge>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {student.goal.description || "Sem descricao detalhada"}
                    </p>
                    <p className="mt-2 break-words text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground [overflow-wrap:anywhere]">
                      {student.reward.courseName || "Curso"} - {student.reward.badgeName || "Recompensa"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-semibold">
                      {student.progress} / {student.reward.pointsTarget ?? 0}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {student.reward.badgeIconUrl ? (
                      <img src={student.reward.badgeIconUrl} alt={student.reward.badgeName || "Recompensa"} className="size-10 rounded-full border border-border/70 object-cover" />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-full border border-border/70 bg-muted/35">
                        <Trophy size={16} />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-foreground">{student.reward.badgeName || "Recompensa"}</div>
                      <div>Janela ate {formatDate(student.reward.endDateTarget)}</div>
                    </div>
                  </div>
                  {student.isCompleted && !student.rewardClaimed ? (
                    <Button type="button" className="rounded-full" disabled={claimingId === student.id} onClick={() => handleClaim(student.id)}>
                      {claimingId === student.id ? "Resgatando..." : "Resgatar"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {students.map((student) => {
          const percent = progressPercent(student);
          const status = rewardStatus(student);
          return (
            <ContextMenu key={student.id}>
              <ContextMenuTrigger asChild>
                <div className="cursor-context-menu rounded-[22px] border border-border/70 bg-card/90 p-4 transition hover:bg-accent/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black tracking-[-0.02em]">{student.user.nome}</h3>
                        <Badge variant={student.rewardClaimed ? "default" : "secondary"}>{status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {student.goal.name} - {student.reward.courseName || "Curso"}
                      </p>
                      <div className="mt-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-semibold">{student.progress} / {student.reward.pointsTarget ?? 0}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                      <div className="text-sm text-muted-foreground">
                        <div>Badge: <span className="font-semibold text-foreground">{student.reward.badgeName || "N/A"}</span></div>
                        <div>Fim: <span className="font-semibold text-foreground">{formatDate(student.reward.endDateTarget)}</span></div>
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => openProgressModal(student)}>
                            Atualizar progresso
                          </Button>
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => openEditAssignmentModal(student)}>
                            Alterar meta
                          </Button>
                          <Button type="button" variant="destructive" className="rounded-full" onClick={() => setDeletingStudentItem(student)}>
                            Deletar progresso
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" className="rounded-full" aria-label={`Mais acoes para ${student.user.nome}`}>
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-56">
                              <DropdownMenuLabel>{student.user.nome}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => openProgressModal(student)}>
                                <Target size={15} />
                                <span>Atualizar progresso</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openEditAssignmentModal(student)}>
                                <Gift size={15} />
                                <span>Alterar meta</span>
                              </DropdownMenuItem>
                              {student.isCompleted && !student.rewardClaimed ? (
                                <DropdownMenuItem onSelect={() => void handleClaim(student.id)}>
                                  <Gift size={15} />
                                  <span>Resgatar recompensa</span>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onSelect={() => void copyStudentAssignmentSummary(student)}>
                                <Copy size={15} />
                                <span>Copiar resumo da atribuicao</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDeletingStudentItem(student)}>
                                <Users size={15} />
                                <span>Deletar progresso</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-64">
                <ContextMenuLabel>{student.user.nome}</ContextMenuLabel>
                <ContextMenuSeparator />
                {canManage ? (
                  <ContextMenuItem onSelect={() => openProgressModal(student)}>
                    <Target size={15} />
                    <span>Atualizar progresso</span>
                  </ContextMenuItem>
                ) : null}
                {canManage ? (
                  <ContextMenuItem onSelect={() => openEditAssignmentModal(student)}>
                    <Gift size={15} />
                    <span>Alterar meta</span>
                  </ContextMenuItem>
                ) : null}
                {student.isCompleted && !student.rewardClaimed ? (
                  <ContextMenuItem onSelect={() => void handleClaim(student.id)}>
                    <Gift size={15} />
                    <span>Resgatar recompensa</span>
                  </ContextMenuItem>
                ) : null}
                {canManage ? <ContextMenuSeparator /> : null}
                <ContextMenuItem onSelect={() => void copyStudentAssignmentSummary(student)}>
                  <Copy size={15} />
                  <span>Copiar resumo da atribuicao</span>
                </ContextMenuItem>
                {canManage ? (
                  <ContextMenuItem variant="destructive" onSelect={() => setDeletingStudentItem(student)}>
                    <Users size={15} />
                    <span>Deletar progresso</span>
                  </ContextMenuItem>
                ) : null}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Metas"
      subtitle={isStudent ? "Acompanhe objetivos e resgate suas recompensas." : "Gerencie metas, recompensas e progresso dos alunos."}
    >
      <div className={pageWrapClass}>
        {successMessage ? <AnimatedToast message={successMessage} type="success" onClose={() => setSuccessMessage(null)} /> : null}
        {errorMessage ? <AnimatedToast message={errorMessage} type="error" onClose={() => setErrorMessage(null)} /> : null}

        <section className={panelClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">Metas por curso, recompensa por badge e progresso individual</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isStudent
                  ? "Aqui voce acompanha cada meta atribuida, seu progresso atual e o momento certo de resgatar a recompensa."
                  : "A tela centraliza os templates de meta, a ativacao por curso e a leitura operacional do progresso por aluno."}
              </p>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="rounded-full" onClick={openCreateGoalModal}>
                  <Plus data-icon="inline-start" />
                  Adicionar meta
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {renderStats()}

        {!isStudent ? (
          <section className={panelClass}>
            <div className={tabListClass}>
              {canManage ? (
                <>
                  <button type="button" className={tabButtonClass(activeTab === "goals")} onClick={() => setActiveTab("goals")}>
                    <Target size={16} />
                    Metas
                  </button>
                  <button type="button" className={tabButtonClass(activeTab === "rewards")} onClick={() => setActiveTab("rewards")}>
                    <Gift size={16} />
                    Recompensas
                  </button>
                </>
              ) : null}
              <button type="button" className={tabButtonClass(activeTab === "students")} onClick={() => setActiveTab("students")}>
                <Users size={16} />
                Alunos
              </button>
            </div>
          </section>
        ) : null}

        {canManage && activeTab === "goals" ? (
          <section className={panelClass}>
            <div className={sectionHeaderClass}>
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em]">Templates de meta</h2>
                <p className="mt-1 text-sm text-muted-foreground">Crie os objetivos base que depois serao ativados por curso.</p>
              </div>
              <Input
                value={goalSearch}
                onChange={(event) => setGoalSearch(event.target.value)}
                placeholder="Buscar por nome ou descricao"
                className="max-w-md rounded-full"
              />
            </div>
            <div className="mt-5">{renderGoalCards()}</div>
            <Pagination
              currentPage={goalsPage}
              itemsPerPage={goalsPerPage}
              totalItems={goalsTotal}
              onPageChange={setGoalsPage}
              onItemsPerPageChange={setGoalsPerPage}
            />
          </section>
        ) : null}

        {canManage && activeTab === "rewards" ? (
          <section className={panelClass}>
            <div className={sectionHeaderClass}>
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em]">Recompensas ativas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cada recompensa conecta uma meta a um curso e uma medalha.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PaginatedSelect
                  value={rewardGoalFilter}
                  onChange={setRewardGoalFilter}
                  options={goalOptions}
                  placeholder="Filtrar por meta"
                  selectedOption={goalOptions.find((item) => item.value === rewardGoalFilter) ?? null}
                  allowPageSizeChange={false}
                />
                <PaginatedSelect
                  value={rewardCourseFilter}
                  onChange={setRewardCourseFilter}
                  options={courseOptions}
                  placeholder="Filtrar por curso"
                  selectedOption={courseOptions.find((item) => item.value === rewardCourseFilter) ?? null}
                  allowPageSizeChange={false}
                />
              </div>
            </div>
            <div className="mt-5">{renderRewardCards()}</div>
            <Pagination
              currentPage={rewardsPage}
              itemsPerPage={rewardsPerPage}
              totalItems={rewardGroups.length}
              onPageChange={setRewardsPage}
              onItemsPerPageChange={setRewardsPerPage}
            />
          </section>
        ) : null}

        {(!isStudent && activeTab === "students") || isStudent ? (
          <section className={panelClass}>
            <div className={sectionHeaderClass}>
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em]">{isStudent ? "Minhas metas" : "Progresso dos alunos"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isStudent
                    ? "Visualizacao individual das metas atribuidas e recompensas disponiveis."
                    : "Acompanhe atribuicoes, percentuais de progresso e status de claim."}
                </p>
              </div>
              {!isStudent ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px]">
                    <PaginatedSelect
                      value={studentCourseFilter}
                      onChange={setStudentCourseFilter}
                      options={courseOptions}
                      placeholder="Filtrar por curso"
                      selectedOption={courseOptions.find((item) => item.value === studentCourseFilter) ?? null}
                      allowPageSizeChange={false}
                    />
                  </div>
                  <div className="min-w-[240px]">
                    <PaginatedSelect
                      value={studentRewardFilter}
                      onChange={setStudentRewardFilter}
                      options={rewardOptions}
                      placeholder="Filtrar por recompensa"
                      selectedOption={rewardOptions.find((item) => item.value === studentRewardFilter) ?? null}
                      allowPageSizeChange={false}
                    />
                  </div>
                  {canManage ? (
                    <Button type="button" className="h-12 rounded-full px-5" onClick={openAssignModal}>
                      <Plus data-icon="inline-start" />
                      Atribuir aluno
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-5">{renderStudentRows()}</div>
            <Pagination
              currentPage={studentsPage}
              itemsPerPage={studentsPerPage}
              totalItems={studentsTotal}
              onPageChange={setStudentsPage}
              onItemsPerPageChange={setStudentsPerPage}
            />
          </section>
        ) : null}

        <Modal
          isOpen={metaModalOpen}
          onClose={() => setMetaModalOpen(false)}
          title="Adicionar Meta"
          size="xl"
          className="max-w-[1080px] overflow-visible"
          bodyClassName="overflow-y-auto overflow-x-visible pb-16"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setMetaModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-full" onClick={submitMetaCreation} disabled={submitting || loadingOptions}>
                {submitting ? "Salvando..." : "Criar meta"}
              </Button>
            </div>
          }
        >
          <div data-testid="add-goal-modal" className="grid gap-5">
            <div className="rounded-[24px] border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Crie a meta e vincule as recompensas no mesmo fluxo. O curso define o contexto, o tipo define a regra e as medalhas geram as recompensas que serao atribuidas depois.
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <section className={modalSectionClass}>
                <div>
                  <h3 className={modalSectionTitleClass}>Contexto da meta</h3>
                  <p className={modalSectionBodyClass}>
                    Defina onde a meta existe e como ela deve aparecer para a equipe.
                  </p>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid min-w-0 gap-2">
                    <span className={modalLabelClass}>Curso</span>
                    <PaginatedSelect
                      value={rewardForm.courseId}
                      onChange={(value) => setRewardForm((current) => ({ ...current, courseId: value }))}
                      options={courseOptions}
                      selectedOption={compactSelectedOption(courseOptions, rewardForm.courseId)}
                      placeholder="Selecionar curso"
                    />
                  </div>

                  <label className="grid gap-2">
                    <span className={modalLabelClass}>Nome</span>
                    <Input value={goalForm.name} onChange={(event) => setGoalForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>

                  <label className="grid gap-2">
                    <span className={modalLabelClass}>Descricao</span>
                    <textarea
                      value={goalForm.description}
                      onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))}
                      className={cn(textareaClass, "min-h-40")}
                    />
                  </label>
                </div>
              </section>

              <section className={modalSectionClass}>
                <div>
                  <h3 className={modalSectionTitleClass}>Regras e recompensa</h3>
                  <p className={modalSectionBodyClass}>
                    Escolha o comportamento da meta e configure os pontos que o aluno recebe ao concluir.
                  </p>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-2">
                    <span className={modalLabelClass}>Tipo de meta</span>
                    <div className="rounded-[24px] border border-border/70 bg-muted/20 p-3">
                      <select
                        aria-label="Tipo de meta"
                        value={goalForm.type}
                        onChange={(event) =>
                          setGoalForm((current) => ({
                            ...current,
                            type: event.target.value,
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value={String(GOAL_TYPE.CourseCompletion)}>Conclusao de curso</option>
                        <option value={String(GOAL_TYPE.PhaseCompletion)}>Conclusao de fase</option>
                        <option value={String(GOAL_TYPE.PointQuantity)}>Quantidade de pontos</option>
                        <option value={String(GOAL_TYPE.TimeSpent)}>Tempo gasto</option>
                        <option value={String(GOAL_TYPE.Custom)}>Personalizada</option>
                      </select>
                      <div className="mt-3 rounded-[18px] border border-primary/20 bg-primary/5 px-4 py-3">
                        <div className="text-sm font-semibold text-foreground">{goalTypeLabel(selectedGoalType)}</div>
                        <div className="mt-1 text-sm leading-6 text-muted-foreground">{goalTypeDescription(selectedGoalType)}</div>
                      </div>
                    </div>
                  </div>

                  {selectedGoalType === GOAL_TYPE.PointQuantity ? (
                    <label className="grid gap-2">
                      <span className={modalLabelClass}>Subtipo</span>
                      <select
                        aria-label="Subtipo"
                        value={rewardForm.pointsSubtype}
                        onChange={(event) =>
                          setRewardForm((current) => ({
                            ...current,
                            pointsSubtype: event.target.value as PointsSubtype,
                          }))
                        }
                        className={fieldClass}
                      >
                        <option value="basic">Apenas pontos</option>
                        <option value="between-dates">Pontos entre datas</option>
                      </select>
                    </label>
                  ) : null}

                  <div className={cn("grid gap-4", selectedGoalType === GOAL_TYPE.PointQuantity ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
                    <label className="grid gap-2">
                      <span className={modalLabelClass}>Pontos recompensa</span>
                      <Input type="number" min={0} value={rewardForm.points} onChange={(event) => setRewardForm((current) => ({ ...current, points: event.target.value }))} />
                    </label>

                    {selectedGoalType === GOAL_TYPE.PointQuantity ? (
                      <label className="grid gap-2">
                        <span className={modalLabelClass}>Pontos alvo</span>
                        <Input type="number" min={0} value={rewardForm.pointsTarget} onChange={(event) => setRewardForm((current) => ({ ...current, pointsTarget: event.target.value }))} />
                      </label>
                    ) : null}
                  </div>

                  {selectedGoalType === GOAL_TYPE.PointQuantity && rewardForm.pointsSubtype === "between-dates" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className={modalLabelClass}>Inicio da janela</span>
                        <Input type="datetime-local" value={rewardForm.startDateTarget} onChange={(event) => setRewardForm((current) => ({ ...current, startDateTarget: event.target.value }))} />
                      </label>
                      <label className="grid gap-2">
                        <span className={modalLabelClass}>Fim da janela</span>
                        <Input type="datetime-local" value={rewardForm.endDateTarget} onChange={(event) => setRewardForm((current) => ({ ...current, endDateTarget: event.target.value }))} />
                      </label>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <section className={modalSectionClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className={modalSectionTitleClass}>Medalhas vinculadas</h3>
                  <p className={modalSectionBodyClass}>
                    Cada medalha selecionada gera uma recompensa ligada a esta meta.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {selectedBadgeChips.length} selecionada{selectedBadgeChips.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="grid gap-2">
                  <span className={modalLabelClass}>Adicionar medalha</span>
                  <PaginatedSelect
                    value=""
                    onChange={(value) =>
                      setRewardForm((current) => {
                        if (current.badgeIds.includes(value)) return current;
                        return {
                          ...current,
                          badgeId: current.badgeId || value,
                          badgeIds: [...current.badgeIds, value],
                        };
                      })
                    }
                    options={badgeOptions.filter((option) => !rewardForm.badgeIds.includes(option.value))}
                    selectedOption={null}
                    placeholder="Adicionar medalha"
                  />
                  <div className="rounded-[20px] border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Selecione uma ou mais medalhas para criar as recompensas da meta.
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={modalLabelClass}>Selecionadas</span>
                    {selectedBadgeChips.length ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setRewardForm((current) => ({ ...current, badgeId: "", badgeIds: [] }))}
                      >
                        Limpar tudo
                      </Button>
                    ) : null}
                  </div>
                  <div className="min-h-28 rounded-[24px] border border-border/70 bg-muted/20 p-4">
                    {selectedBadgeChips.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedBadgeChips.map((badge) => (
                          <button
                            key={badge.value}
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2 text-sm font-semibold transition hover:border-primary/35 hover:bg-accent"
                            onClick={() =>
                              setRewardForm((current) => {
                                const nextBadgeIds = current.badgeIds.filter((id) => id !== badge.value);
                                return {
                                  ...current,
                                  badgeIds: nextBadgeIds,
                                  badgeId: current.badgeId === badge.value ? nextBadgeIds[0] ?? "" : current.badgeId,
                                };
                              })
                            }
                          >
                            <span>{badge.label}</span>
                            <span className="text-muted-foreground">x</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-20 items-center rounded-[18px] border border-dashed border-border/60 bg-card/40 px-4 text-sm text-muted-foreground">
                        Nenhuma medalha selecionada.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </Modal>

        <Modal
          isOpen={goalModalOpen}
          onClose={() => setGoalModalOpen(false)}
          title={editingGoal ? "Editar meta" : "Nova meta"}
          size="xl"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setGoalModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-full" onClick={submitGoal} disabled={submitting}>
                {submitting ? "Salvando..." : editingGoal ? "Salvar alteracoes" : "Criar meta"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Nome</span>
              <Input value={goalForm.name} onChange={(event) => setGoalForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Descricao</span>
              <textarea
                value={goalForm.description}
                onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))}
                className={textareaClass}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tipo de meta</span>
                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-3">
                  <select value={goalForm.type} onChange={(event) => setGoalForm((current) => ({ ...current, type: event.target.value }))} className={fieldClass}>
                    <option value={String(GOAL_TYPE.CourseCompletion)}>Conclusao de curso</option>
                    <option value={String(GOAL_TYPE.PhaseCompletion)}>Conclusao de fase</option>
                    <option value={String(GOAL_TYPE.PointQuantity)}>Quantidade de pontos</option>
                    <option value={String(GOAL_TYPE.TimeSpent)}>Tempo gasto</option>
                    <option value={String(GOAL_TYPE.Custom)}>Personalizada</option>
                  </select>
                  <div className="mt-3 rounded-[18px] border border-primary/20 bg-primary/5 px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">{goalTypeLabel(selectedGoalType)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{goalTypeDescription(selectedGoalType)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={rewardModalOpen}
          onClose={() => setRewardModalOpen(false)}
          title={editingReward ? "Editar recompensa" : "Nova recompensa"}
          size="xl"
          className="max-w-[1120px] overflow-visible"
          bodyClassName="overflow-visible pb-28"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setRewardModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-full" onClick={submitReward} disabled={submitting || loadingOptions}>
                {submitting ? "Salvando..." : editingReward ? "Salvar alteracoes" : "Criar recompensa"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <div
              className={cn(
                "grid gap-4",
                editingReward ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              )}
            >
              <div className="grid min-w-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Meta</span>
                <PaginatedSelect
                  value={rewardForm.goalId}
                  onChange={(value) => setRewardForm((current) => ({ ...current, goalId: value }))}
                  options={goalOptions}
                  selectedOption={compactSelectedOption(goalOptions, rewardForm.goalId)}
                  placeholder="Selecionar meta"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Curso</span>
                <PaginatedSelect
                  value={rewardForm.courseId}
                  onChange={(value) => setRewardForm((current) => ({ ...current, courseId: value }))}
                  options={courseOptions}
                  selectedOption={compactSelectedOption(courseOptions, rewardForm.courseId)}
                  placeholder="Selecionar curso"
                />
              </div>
              {editingReward ? (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Medalha</span>
                  <PaginatedSelect
                    value={rewardForm.badgeId}
                    onChange={(value) => setRewardForm((current) => ({ ...current, badgeId: value, badgeIds: [value] }))}
                    options={badgeOptions}
                    selectedOption={compactSelectedOption(badgeOptions, rewardForm.badgeId)}
                    placeholder="Selecionar medalha"
                  />
                </div>
              ) : null}
            </div>

            {!editingReward ? (
              <div className="grid gap-3 rounded-[24px] border border-border/70 bg-card/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Medalhas</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {selectedBadgeChips.length
                        ? `${selectedBadgeChips.length} medalha${selectedBadgeChips.length > 1 ? "s" : ""} selecionada${selectedBadgeChips.length > 1 ? "s" : ""}`
                        : "Selecione uma ou mais medalhas para gerar recompensas em lote."}
                    </div>
                  </div>
                  {selectedBadgeChips.length ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setRewardForm((current) => ({ ...current, badgeId: "", badgeIds: [] }))}
                    >
                      Limpar tudo
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Adicionar medalha</span>
                    <PaginatedSelect
                      value=""
                      onChange={(value) =>
                        setRewardForm((current) => {
                          if (current.badgeIds.includes(value)) return current;
                          return {
                            ...current,
                            badgeId: current.badgeId || value,
                            badgeIds: [...current.badgeIds, value],
                          };
                        })
                      }
                      options={badgeOptions.filter((option) => !rewardForm.badgeIds.includes(option.value))}
                      selectedOption={null}
                      placeholder="Adicionar medalha"
                    />
                  </div>

                  <div className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Selecionadas</span>
                    <div className="max-h-32 min-h-14 overflow-auto rounded-2xl border border-border/70 bg-muted/20 p-3">
                      {selectedBadgeChips.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedBadgeChips.map((badge) => (
                            <button
                              key={badge.value}
                              type="button"
                              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/45 px-3 py-1.5 text-sm font-semibold transition hover:border-primary/35 hover:bg-accent"
                              onClick={() =>
                                setRewardForm((current) => {
                                  const nextBadgeIds = current.badgeIds.filter((id) => id !== badge.value);
                                  return {
                                    ...current,
                                    badgeIds: nextBadgeIds,
                                    badgeId: current.badgeId === badge.value ? nextBadgeIds[0] ?? "" : current.badgeId,
                                  };
                                })
                              }
                            >
                              <span>{badge.label}</span>
                              <span className="text-muted-foreground">x</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhuma medalha selecionada.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn("grid gap-4", selectedRewardGoalType === GOAL_TYPE.PointQuantity ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
              {selectedRewardGoalType === GOAL_TYPE.PointQuantity ? (
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Pontos alvo</span>
                  <Input type="number" min={0} value={rewardForm.pointsTarget} onChange={(event) => setRewardForm((current) => ({ ...current, pointsTarget: event.target.value }))} />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Pontos recompensa</span>
                <Input type="number" min={0} value={rewardForm.points} onChange={(event) => setRewardForm((current) => ({ ...current, points: event.target.value }))} />
              </label>
            </div>
            {selectedRewardGoalType === GOAL_TYPE.PointQuantity ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Inicio da janela</span>
                  <Input type="datetime-local" value={rewardForm.startDateTarget} onChange={(event) => setRewardForm((current) => ({ ...current, startDateTarget: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Fim da janela</span>
                  <Input type="datetime-local" value={rewardForm.endDateTarget} onChange={(event) => setRewardForm((current) => ({ ...current, endDateTarget: event.target.value }))} />
                </label>
              </div>
            ) : null}
          </div>
        </Modal>

        <Modal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setEditingAssignmentStudent(null);
          }}
          title={editingAssignmentStudent ? "Alterar meta do aluno" : "Atribuir meta a aluno"}
          size="xl"
          className="max-w-[1120px] overflow-visible"
          bodyClassName="overflow-visible pb-28"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setAssignModalOpen(false);
                  setEditingAssignmentStudent(null);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="button" className="rounded-full" onClick={submitStudentAssignment} disabled={submitting || loadingOptions}>
                {submitting ? "Salvando..." : editingAssignmentStudent ? "Salvar alteracao" : "Atribuir"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Aluno</span>
              <PaginatedSelect
                value={studentForm.userId}
                onChange={(value) => setStudentForm((current) => ({ ...current, userId: value }))}
                options={studentOptions}
                selectedOption={compactSelectedOption(studentOptions, studentForm.userId)}
                placeholder="Selecionar aluno"
                disabled={!!editingAssignmentStudent}
              />
            </div>
            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recompensa ativa</span>
              <PaginatedSelect
                value={studentForm.goalRewardId}
                onChange={(value) => {
                  const selectedReward = allRewards.find((reward) => reward.id === value);
                  setStudentForm((current) => ({
                    ...current,
                    goalRewardId: value,
                    courseId: selectedReward?.courseId ?? current.courseId,
                  }));
                }}
                options={rewardOptions}
                selectedOption={compactSelectedOption(rewardOptions, studentForm.goalRewardId)}
                placeholder="Selecionar recompensa"
              />
            </div>
            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Curso</span>
              <PaginatedSelect
                value={studentForm.courseId}
                onChange={(value) => setStudentForm((current) => ({ ...current, courseId: value }))}
                options={courseOptions}
                selectedOption={compactSelectedOption(courseOptions, studentForm.courseId)}
                placeholder="Selecionar curso"
              />
            </div>
          </div>
        </Modal>

        <ConfirmModal
          isOpen={!!deletingStudentItem}
          title="Deletar progresso da meta"
          message={
            deletingStudentItem
              ? `Deseja remover a atribuicao de ${deletingStudentItem.user.nome} para ${deletingStudentItem.goal.name}?`
              : ""
          }
          confirmText="Deletar progresso"
          cancelText="Cancelar"
          danger
          isLoading={submitting}
          onCancel={() => setDeletingStudentItem(null)}
          onConfirm={confirmDeleteStudentAssignment}
        />

        <Modal
          isOpen={progressModalOpen}
          onClose={() => setProgressModalOpen(false)}
          title="Atualizar progresso"
          footer={
            <div className="flex w-full justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setProgressModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-full" onClick={submitStudentProgress} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Progresso</span>
              <Input type="number" min={0} value={studentForm.progress} onChange={(event) => setStudentForm((current) => ({ ...current, progress: event.target.value }))} />
            </label>
            <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
              <label className="flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={studentForm.isCompleted}
                  onCheckedChange={(checked) => setStudentForm((current) => ({ ...current, isCompleted: checked === true }))}
                />
                Marcar meta como concluida
              </label>
            </div>
          </div>
        </Modal>

        <ConfirmModal
          isOpen={!!deletingGoalItem}
          title="Excluir meta"
          message={`A meta "${deletingGoalItem?.name ?? ""}" sera removida junto com recompensas e atribuicoes associadas.`}
          confirmText="Excluir"
          danger
          isLoading={submitting}
          onCancel={() => setDeletingGoalItem(null)}
          onConfirm={confirmDeleteGoal}
        />

        <ConfirmModal
          isOpen={!!deletingRewardItem}
          title="Excluir recompensa"
          message={`A recompensa da meta "${deletingRewardItem?.goalName ?? ""}" sera removida junto com os progressos vinculados.`}
          confirmText="Excluir"
          danger
          isLoading={submitting}
          onCancel={() => setDeletingRewardItem(null)}
          onConfirm={confirmDeleteReward}
        />
      </div>
    </DashboardLayout>
  );
}
