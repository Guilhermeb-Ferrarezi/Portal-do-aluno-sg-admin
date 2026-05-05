import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  atualizarRankingEvent,
  criarRankingEvent,
  getRankingEventsByType,
  getRankingPoints,
  scheduleRankingEvent,
} from "./rankings";

const okResponse = <T,>(result: T) =>
  new Response(JSON.stringify({ success: true, errors: [], result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("rankings api", () => {
  const pointsBaseUrl = "https://portal.santos-tech.com/api";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("busca ranking de pontos e retorna o result da resposta customizada", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        okResponse([{ userId: 1, name: "Ana", totalPoints: 1200 }])
      );

    await expect(getRankingPoints()).resolves.toEqual([
      { userId: 1, name: "Ana", totalPoints: 1200 },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      `${pointsBaseUrl}/Point/GetRankingPoints`,
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
  });

  it("envia o tipo de evento na query string", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(okResponse([]));

    await getRankingEventsByType(2);

    expect(fetchMock).toHaveBeenCalledWith(
      `${pointsBaseUrl}/Point/GetRankingEvent?eventType=2`,
      expect.any(Object)
    );
  });

  it("agenda evento enviando o id como JSON no corpo", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okResponse(true));

    await expect(scheduleRankingEvent(42)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      `${pointsBaseUrl}/Point/ScheduleRankingEvent`,
      expect.objectContaining({
        method: "POST",
        body: "42",
      })
    );
  });

  it("propaga erros da resposta customizada", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errors: ["Ranking indisponivel"],
          result: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(getRankingPoints()).rejects.toThrow("Ranking indisponivel");
  });

  it("cria evento usando o contrato de awards retornado pelo backend", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      okResponse({
        id: 7,
        eventName: "Premiação Notas",
        eventType: 1,
        durationMinutes: 60,
        startTime: "2026-04-28T12:00:00Z",
        endTime: "2026-04-28T13:00:00Z",
        awards: [
          {
            id: 3,
            awardName: "Mochila",
            awardPositionRanking: 1,
            awardDescription: "Primeiro lugar",
            awardPictureUrl: "",
          },
        ],
      })
    );

    await expect(
      criarRankingEvent({
        eventName: "Premiação Notas",
        eventType: 1,
        durationMinutes: 60,
        startTime: "2026-04-28T12:00:00Z",
        awards: [
          {
            awardName: "Mochila",
            awardPositionRanking: 1,
            awardDescription: "Primeiro lugar",
            awardPictureUrl: "",
          },
        ],
      })
    ).resolves.toMatchObject({
      id: 7,
      eventType: 1,
      awards: [{ id: 3, awardName: "Mochila" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${pointsBaseUrl}/Point/RankingEvent`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("atualiza evento sem chamar endpoint de agendamento separado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      okResponse({
        id: 7,
        eventName: "Premiação Pontos",
        eventType: 2,
        durationMinutes: 120,
        startTime: "2026-04-28T12:00:00Z",
        endTime: "2026-04-28T14:00:00Z",
        awards: [],
      })
    );

    await atualizarRankingEvent(7, {
      eventName: "Premiação Pontos",
      eventType: 2,
      durationMinutes: 120,
      startTime: "2026-04-28T12:00:00Z",
      awards: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${pointsBaseUrl}/Point/RankingEvent/7`,
      expect.objectContaining({ method: "PUT" })
    );
  });
});
