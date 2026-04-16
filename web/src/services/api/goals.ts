import { apiFetch } from "./core";

export const GOAL_TYPE = {
  CourseCompletion: 1,
  PhaseCompletion: 2,
  PointQuantity: 3,
  TimeSpent: 4,
  Custom: 5,
} as const;

export type GoalType = (typeof GOAL_TYPE)[keyof typeof GOAL_TYPE];

export type Goal = {
  id: string;
  name: string;
  description: string | null;
  type: GoalType | null;
  imageUrl: string | null;
  rewardsCount: number;
};

export type GoalReward = {
  id: string;
  goalId: string;
  badgeId: string;
  courseId: string;
  points: number | null;
  createdAt: string;
  endDateTarget: string | null;
  rewardType: number;
  startDateTarget: string | null;
  pointsTarget: number | null;
  goalName: string;
  badgeName: string;
  badgeIconUrl: string | null;
  courseName: string;
};

export type GoalStudent = {
  id: string;
  userId: string;
  goalRewardId: string;
  courseId: string;
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
  rewardClaimed: boolean;
  rewardClaimedAt: string | null;
  user: {
    id: string;
    nome: string;
    email: string;
  };
  goal: {
    name: string;
    description: string | null;
    imageUrl: string | null;
    type: GoalType | null;
  };
  reward: {
    badgeId: string | null;
    badgeName: string | null;
    badgeIconUrl: string | null;
    courseName: string | null;
    rewardType: number | null;
    points: number | null;
    pointsTarget: number | null;
    startDateTarget: string | null;
    endDateTarget: string | null;
  };
};

export async function listarGoals(params?: { q?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch<{ items: Goal[]; total: number }>(`/goals${query ? `?${query}` : ""}`);
}

export async function obterGoal(id: string) {
  return apiFetch<{ goal: Goal; rewards: GoalReward[] }>(`/goals/${id}`);
}

export async function criarGoal(dados: {
  name: string;
  description?: string | null;
  type?: GoalType | null;
  imageUrl?: string | null;
}) {
  return apiFetch<{ message: string; goal: Goal }>("/goals", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarGoal(
  id: string,
  dados: {
    name?: string;
    description?: string | null;
    type?: GoalType | null;
    imageUrl?: string | null;
  }
) {
  return apiFetch<{ message: string; goal: Goal }>(`/goals/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarGoal(id: string) {
  return apiFetch<{ message: string }>(`/goals/${id}`, {
    method: "DELETE",
  });
}

export async function listarGoalRewards(params?: {
  goalId?: string;
  courseId?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.goalId) search.set("goalId", params.goalId);
  if (params?.courseId) search.set("courseId", params.courseId);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch<{ items: GoalReward[]; total: number }>(`/goals/rewards${query ? `?${query}` : ""}`);
}

export async function criarGoalReward(dados: {
  goalId: string;
  badgeId: string;
  courseId: string;
  rewardType?: number;
  pointsTarget?: number | null;
  startDateTarget?: string | null;
  endDateTarget?: string | null;
  points?: number | null;
}) {
  return apiFetch<{ message: string; reward: GoalReward }>("/goals/rewards", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarGoalReward(
  id: string,
  dados: {
    goalId?: string;
    badgeId?: string;
    courseId?: string;
    rewardType?: number;
    pointsTarget?: number | null;
    startDateTarget?: string | null;
    endDateTarget?: string | null;
    points?: number | null;
  }
) {
  return apiFetch<{ message: string; reward: GoalReward }>(`/goals/rewards/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarGoalReward(id: string) {
  return apiFetch<{ message: string }>(`/goals/rewards/${id}`, {
    method: "DELETE",
  });
}

export async function listarGoalStudents(params?: {
  courseId?: string;
  goalRewardId?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.courseId) search.set("courseId", params.courseId);
  if (params?.goalRewardId) search.set("goalRewardId", params.goalRewardId);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch<{ items: GoalStudent[]; total: number }>(`/goals/students${query ? `?${query}` : ""}`);
}

export async function atribuirGoalAoAluno(dados: {
  userId: string;
  goalRewardId: string;
  courseId: string;
}) {
  return apiFetch<{ message: string; goalStudent: GoalStudent }>("/goals/students", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarProgressoAluno(
  id: string,
  dados: {
    progress?: number;
    isCompleted?: boolean;
    goalRewardId?: string;
    courseId?: string;
  }
) {
  return apiFetch<{ message: string; goalStudent: GoalStudent }>(`/goals/students/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarGoalStudent(id: string) {
  return apiFetch<{ message: string }>(`/goals/students/${id}`, {
    method: "DELETE",
  });
}

export async function resgatarRecompensa(id: string) {
  return apiFetch<{ message: string; goalStudent: GoalStudent }>(`/goals/students/${id}/claim`, {
    method: "POST",
  });
}
