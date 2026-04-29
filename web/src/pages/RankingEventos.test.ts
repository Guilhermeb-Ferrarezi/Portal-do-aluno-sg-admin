import { describe, expect, it, vi } from "vitest";
import { computeEventStatus } from "./ranking-event-status";

describe("computeEventStatus", () => {
  it("classifica evento futuro como agendado", () => {
    vi.setSystemTime(new Date("2026-01-28T13:59:59Z"));

    expect(computeEventStatus("2026-01-28T14:00:00Z", 60)).toBe("Agendado");
  });

  it("classifica evento dentro da duracao como ativo", () => {
    vi.setSystemTime(new Date("2026-01-28T14:30:00Z"));

    expect(computeEventStatus("2026-01-28T14:00:00Z", 60)).toBe("Ativo");
  });

  it("classifica evento apos duracao como encerrado", () => {
    vi.setSystemTime(new Date("2026-01-28T15:00:01Z"));

    expect(computeEventStatus("2026-01-28T14:00:00Z", 60)).toBe("Encerrado");
  });

  it("trata ISO sem timezone como UTC", () => {
    vi.setSystemTime(new Date("2026-01-28T14:30:00Z"));

    expect(computeEventStatus("2026-01-28T14:00:00", 60)).toBe("Ativo");
  });
});
