import { expect, test, type Page } from "@playwright/test";

type Goal = {
  id: string;
  name: string;
  description: string | null;
  type: number | null;
  imageUrl: string | null;
  rewardsCount: number;
};

type GoalReward = {
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

type GoalStudent = {
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
    type: number | null;
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

type FixtureState = {
  courses: Array<{ id: string; nome: string; descricao: string }>;
  badges: Array<{ id: string; name: string; description: string; iconUrl: string; createdAt: string }>;
  goals: Goal[];
  rewards: GoalReward[];
  students: GoalStudent[];
  users: Array<{ id: string; nome: string; email: string; usuario?: string }>;
};

type SetupOptions = {
  fixtures?: Partial<FixtureState>;
};

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

function defaultFixtures(): FixtureState {
  const goals: Goal[] = [
    {
      id: "goal-1",
      name: "Meta React",
      description: "Domine os fundamentos do React",
      type: 1,
      imageUrl: null,
      rewardsCount: 3,
    },
    {
      id: "goal-2",
      name: "Meta Vue",
      description: "Avance no ecossistema Vue",
      type: 3,
      imageUrl: null,
      rewardsCount: 1,
    },
  ];

  const rewards: GoalReward[] = [
    {
      id: "reward-1",
      goalId: "goal-1",
      badgeId: "badge-1",
      courseId: "course-1",
      points: 50,
      createdAt: "2026-01-01T00:00:00.000Z",
      endDateTarget: "2026-12-31T00:00:00.000Z",
      rewardType: 0,
      startDateTarget: null,
      pointsTarget: 100,
      goalName: "Meta React",
      badgeName: "Persistencia",
      badgeIconUrl: null,
      courseName: "Curso Alpha",
    },
    {
      id: "reward-2",
      goalId: "goal-1",
      badgeId: "badge-2",
      courseId: "course-1",
      points: 75,
      createdAt: "2026-01-02T00:00:00.000Z",
      endDateTarget: "2026-12-31T00:00:00.000Z",
      rewardType: 0,
      startDateTarget: null,
      pointsTarget: 100,
      goalName: "Meta React",
      badgeName: "Velocidade",
      badgeIconUrl: null,
      courseName: "Curso Alpha",
    },
    {
      id: "reward-3",
      goalId: "goal-1",
      badgeId: "badge-3",
      courseId: "course-2",
      points: 90,
      createdAt: "2026-01-03T00:00:00.000Z",
      endDateTarget: "2026-12-31T00:00:00.000Z",
      rewardType: 0,
      startDateTarget: null,
      pointsTarget: 120,
      goalName: "Meta React",
      badgeName: "Consistencia",
      badgeIconUrl: null,
      courseName: "Curso Beta",
    },
    {
      id: "reward-4",
      goalId: "goal-2",
      badgeId: "badge-4",
      courseId: "course-2",
      points: 40,
      createdAt: "2026-01-04T00:00:00.000Z",
      endDateTarget: "2026-12-31T00:00:00.000Z",
      rewardType: 0,
      startDateTarget: null,
      pointsTarget: 80,
      goalName: "Meta Vue",
      badgeName: "Explorador",
      badgeIconUrl: null,
      courseName: "Curso Beta",
    },
  ];

  return {
    courses: [
      { id: "course-1", nome: "Curso Alpha", descricao: "Curso de teste para metas" },
      { id: "course-2", nome: "Curso Beta", descricao: "Curso complementar para recompensas" },
    ],
    badges: Array.from({ length: 14 }, (_, index) => ({
      id: `badge-${index + 1}`,
      name: index === 0 ? "Persistencia" : index === 1 ? "Velocidade" : index === 2 ? "Consistencia" : index === 3 ? "Explorador" : `Badge ${index + 1}`,
      description: `Descricao da badge ${index + 1}`,
      iconUrl: "",
      createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    })),
    goals,
    rewards,
    students: [
      {
        id: "student-1",
        userId: "user-1",
        goalRewardId: "reward-1",
        courseId: "course-1",
        progress: 35,
        isCompleted: false,
        completedAt: null,
        rewardClaimed: false,
        rewardClaimedAt: null,
        user: {
          id: "user-1",
          nome: "Alice Silva",
          email: "alice@example.com",
        },
        goal: {
          name: "Meta React",
          description: "Domine os fundamentos do React",
          imageUrl: null,
          type: 1,
        },
        reward: {
          badgeId: "badge-1",
          badgeName: "Persistencia",
          badgeIconUrl: null,
          courseName: "Curso Alpha",
          rewardType: 0,
          points: 50,
          pointsTarget: 100,
          startDateTarget: null,
          endDateTarget: "2026-12-31T00:00:00.000Z",
        },
      },
    ],
    users: [
      { id: "user-1", nome: "Alice Silva", email: "alice@example.com", usuario: "alice" },
      { id: "user-2", nome: "Bruno Costa", email: "bruno@example.com", usuario: "bruno" },
    ],
  };
}

function mergeFixtures(overrides?: Partial<FixtureState>): FixtureState {
  const base = defaultFixtures();
  return {
    courses: overrides?.courses ?? base.courses,
    badges: overrides?.badges ?? base.badges,
    goals: overrides?.goals ?? base.goals,
    rewards: overrides?.rewards ?? base.rewards,
    students: overrides?.students ?? base.students,
    users: overrides?.users ?? base.users,
  };
}

function paginate<T>(items: T[], limitParam: string | null, offsetParam: string | null) {
  const limit = limitParam ? Number(limitParam) : items.length;
  const offset = offsetParam ? Number(offsetParam) : 0;
  const safeLimit = Number.isFinite(limit) ? limit : items.length;
  const safeOffset = Number.isFinite(offset) ? offset : 0;
  return items.slice(safeOffset, safeOffset + safeLimit);
}

async function setupAdminSession(page: Page, options: SetupOptions = {}) {
  const fakeToken = makeFakeJwt({ sub: "99", usuario: "admin-test", role: 3 });
  const fixture = mergeFixtures(options.fixtures);
  const state: FixtureState = {
    courses: [...fixture.courses],
    badges: [...fixture.badges],
    goals: [...fixture.goals],
    rewards: [...fixture.rewards],
    students: [...fixture.students],
    users: [...fixture.users],
  };
  const assignmentPayloads: Array<{ userId: string; goalRewardId: string; courseId: string }> = [];

  await page.addInitScript(
    ({ token, refreshToken, nome }: { token: string; refreshToken: string; nome: string }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("nome", nome);
    },
    { token: fakeToken, refreshToken: "fake-refresh-token", nome: "Admin Teste" }
  );

  await page.route(
    (url) => {
      try {
        return new URL(url).pathname.startsWith("/api/");
      } catch {
        return false;
      }
    },
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const { pathname, searchParams } = url;

      const json = (body: unknown) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      if (pathname === "/api/users/me" && request.method() === "GET") {
        return json({
          id: "admin-1",
          nome: "Admin Teste",
          email: "admin@example.com",
          role: "admin",
          ativo: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        });
      }

      if (pathname === "/api/turmas" && request.method() === "GET") {
        return json([]);
      }

      if (pathname === "/api/courses" && request.method() === "GET") {
        return json(state.courses);
      }

      if (pathname === "/api/goals" && request.method() === "GET") {
        const q = searchParams.get("q")?.trim().toLowerCase() || "";
        const filtered = state.goals.filter((goal) => {
          if (!q) return true;
          return goal.name.toLowerCase().includes(q) || (goal.description || "").toLowerCase().includes(q);
        });
        return json({
          items: paginate(filtered, searchParams.get("limit"), searchParams.get("offset")),
          total: filtered.length,
        });
      }

      if (pathname === "/api/goals/rewards" && request.method() === "GET") {
        const goalId = searchParams.get("goalId");
        const courseId = searchParams.get("courseId");
        const filtered = state.rewards.filter((reward) => {
          if (goalId && reward.goalId !== goalId) return false;
          if (courseId && reward.courseId !== courseId) return false;
          return true;
        });
        return json({
          items: paginate(filtered, searchParams.get("limit"), searchParams.get("offset")),
          total: filtered.length,
        });
      }

      if (pathname === "/api/goals/students" && request.method() === "GET") {
        const courseId = searchParams.get("courseId");
        const goalRewardId = searchParams.get("goalRewardId");
        const filtered = state.students.filter((student) => {
          if (courseId && student.courseId !== courseId) return false;
          if (goalRewardId && student.goalRewardId !== goalRewardId) return false;
          return true;
        });
        return json({
          items: paginate(filtered, searchParams.get("limit"), searchParams.get("offset")),
          total: filtered.length,
        });
      }

      if (pathname === "/api/badges" && request.method() === "GET") {
        return json({
          items: state.badges,
          total: state.badges.length,
        });
      }

      if (pathname === "/api/users" && request.method() === "GET" && searchParams.get("role") === "aluno") {
        return json(state.users);
      }

      if (pathname === "/api/goals/students" && request.method() === "POST") {
        const payload = (await request.postDataJSON()) as { userId: string; goalRewardId: string; courseId: string };
        assignmentPayloads.push(payload);
        const user = state.users.find((item) => item.id === payload.userId);
        const reward = state.rewards.find((item) => item.id === payload.goalRewardId);
        const goal = reward ? state.goals.find((item) => item.id === reward.goalId) : null;

        if (!user || !reward || !goal) {
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: "Dados invalidos" }),
          });
        }

        const goalStudent: GoalStudent = {
          id: `student-${state.students.length + 1}`,
          userId: user.id,
          goalRewardId: reward.id,
          courseId: payload.courseId,
          progress: 0,
          isCompleted: false,
          completedAt: null,
          rewardClaimed: false,
          rewardClaimedAt: null,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
          },
          goal: {
            name: goal.name,
            description: goal.description,
            imageUrl: goal.imageUrl,
            type: goal.type,
          },
          reward: {
            badgeId: reward.badgeId,
            badgeName: reward.badgeName,
            badgeIconUrl: reward.badgeIconUrl,
            courseName: reward.courseName,
            rewardType: reward.rewardType,
            points: reward.points,
            pointsTarget: reward.pointsTarget,
            startDateTarget: reward.startDateTarget,
            endDateTarget: reward.endDateTarget,
          },
        };

        state.students.unshift(goalStudent);
        return json({ message: "Atribuicao criada", goalStudent });
      }

      return json({ success: true });
    }
  );

  return { assignmentPayloads };
}

async function openAddMetaModal(page: Page) {
  await page.getByRole("button", { name: /Adicionar meta/i }).click();
  const dialog = page.getByRole("dialog", { name: /Adicionar Meta/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("metas", () => {
  async function openMetasPage(page: Page, options?: SetupOptions) {
    return setupAdminSession(page, options).then(async (result) => {
      await page.goto("/dashboard/operacao/metas");
      await expect(page.getByRole("heading", { name: /Metas por curso/i })).toBeVisible();
      return result;
    });
  }

  test("abre o modal com os blocos principais e permite selecionar curso e medalha", async ({ page }) => {
    await openMetasPage(page);
    const dialog = await openAddMetaModal(page);

    await expect(page.getByTestId("add-goal-modal")).toBeVisible();
    await expect(dialog.getByText("Contexto da meta")).toBeVisible();
    await expect(dialog.getByText("Regras e recompensa")).toBeVisible();
    await expect(dialog.getByText("Medalhas vinculadas")).toBeVisible();

    await dialog.getByRole("button", { name: /Selecionar curso/i }).click();
    await dialog.getByRole("button", { name: /Curso Alpha/i }).click();
    await expect(dialog.getByRole("button", { name: /Curso Alpha/i })).toBeVisible();

    await dialog.getByRole("button", { name: /Adicionar medalha/i }).click();
    await dialog.getByRole("button", { name: /Persistencia/i }).click();
    await expect(dialog.getByRole("button", { name: /Persistencia/i })).toBeVisible();
  });

  test("permite selecionar medalha fora da dobra e limpar selecao no modal de meta", async ({ page }) => {
    await openMetasPage(page);
    const dialog = await openAddMetaModal(page);

    await dialog.getByRole("button", { name: /Adicionar medalha/i }).click();
    const offscreenBadge = dialog.getByRole("button", { name: /Badge 12/i });
    await offscreenBadge.scrollIntoViewIfNeeded();
    await offscreenBadge.click();

    await dialog.getByRole("button", { name: /Adicionar medalha/i }).click();
    await dialog.getByRole("button", { name: /Velocidade/i }).click();

    await expect(dialog.getByText("2 selecionadas")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Badge 12/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Velocidade/i })).toBeVisible();

    await dialog.getByRole("button", { name: /Limpar tudo/i }).click();
    await expect(dialog.getByText("0 selecionadas")).toBeVisible();
    await expect(dialog.getByText("Nenhuma medalha selecionada.")).toBeVisible();
  });

  test("exibe controles condicionais para metas por quantidade de pontos", async ({ page }) => {
    await openMetasPage(page);
    const dialog = await openAddMetaModal(page);
    await dialog.getByLabel("Tipo de meta").selectOption("3");

    await expect(dialog.getByLabel("Subtipo")).toBeVisible();
    await expect(dialog.getByLabel("Pontos alvo")).toBeVisible();

    await dialog.getByLabel("Subtipo").selectOption("between-dates");
    await expect(dialog.getByLabel("Inicio da janela")).toBeVisible();
    await expect(dialog.getByLabel("Fim da janela")).toBeVisible();
  });

  test("navega para recompensas e expande grupo com lista maior que duas recompensas", async ({ page }) => {
    await openMetasPage(page);
    await page.getByRole("button", { name: /^Recompensas$/i }).click();

    await expect(page.getByRole("heading", { name: /Recompensas ativas/i })).toBeVisible();
    await expect(page.getByText("Meta React")).toBeVisible();
    await expect(page.getByText(/Curso Alpha - Persistencia/i)).toBeVisible();
    await expect(page.getByText(/Curso Alpha - Velocidade/i)).toBeVisible();
    await expect(page.getByText(/Curso Beta - Consistencia/i)).not.toBeVisible();

    await page.getByRole("button", { name: /Ver mais 1 recompensa/i }).click();
    await expect(page.getByText(/Curso Beta - Consistencia/i)).toBeVisible();
    await page.getByRole("button", { name: /Mostrar menos/i }).click();
    await expect(page.getByText(/Curso Beta - Consistencia/i)).not.toBeVisible();
  });

  test("atribui aluno a uma recompensa pela aba de alunos", async ({ page }) => {
    const { assignmentPayloads } = await openMetasPage(page);
    await page.getByRole("button", { name: /^Alunos$/i }).click();
    await page.getByRole("button", { name: /Atribuir aluno/i }).click();

    const dialog = page.getByRole("dialog", { name: /Atribuir meta a aluno/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /Selecionar aluno/i }).click();
    await dialog.getByRole("button", { name: /Bruno Costa/i }).click();

    await dialog.getByRole("button", { name: /Selecionar recompensa/i }).click();
    await dialog.getByRole("button", { name: /Meta React/i }).first().click();

    await expect(dialog.getByRole("button", { name: /Curso Alpha/i })).toBeVisible();
    await dialog.getByRole("button", { name: /^Atribuir$/i }).click();

    await expect(page.getByText("Aluno atribuido")).toBeVisible();
    await expect(page.getByText("Bruno Costa")).toBeVisible();
    await expect(assignmentPayloads).toEqual([
      {
        userId: "user-2",
        goalRewardId: "reward-1",
        courseId: "course-1",
      },
    ]);
  });
});
