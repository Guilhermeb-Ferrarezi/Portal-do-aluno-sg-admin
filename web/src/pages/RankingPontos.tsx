import React from "react";
import { Trophy, Coins } from "lucide-react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import { AnimatedToast } from "../components/animate-ui";
import { getRankingPoints, type PointRanking } from "../services/api";

const cardClass =
  "rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.16)]";

function Avatar({ src, name }: { src?: string | null; name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-border/60"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {initials || "?"}
    </div>
  );
}

function PodiumCard({
  entry,
  position,
}: {
  entry: PointRanking;
  position: 1 | 2 | 3;
}) {
  const colors: Record<typeof position, string> = {
    1: "border-amber-400/50 bg-gradient-to-b from-amber-400/15 to-transparent",
    2: "border-slate-300/40 bg-gradient-to-b from-slate-300/12 to-transparent",
    3: "border-orange-400/40 bg-gradient-to-b from-orange-500/12 to-transparent",
  };
  const labels: Record<typeof position, string> = {
    1: "1º lugar",
    2: "2º lugar",
    3: "3º lugar",
  };

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-[24px] border p-5 text-center ${colors[position]}`}
      data-testid={`podium-${position}`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {labels[position]}
      </div>
      <div className="relative">
        <Avatar src={entry.profilePictureUrl} name={entry.name} />
        <Trophy
          size={18}
          className="absolute -top-2 -right-2 fill-amber-400 text-amber-500"
        />
      </div>
      <div className="text-base font-semibold text-foreground">{entry.name}</div>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
        <Coins size={14} />
        {entry.totalPoints.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

export default function RankingPontosPage() {
  const [list, setList] = React.useState<PointRanking[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getRankingPoints()
      .then((data) => {
        if (cancelled) return;
        const sorted = [...data].sort((a, b) => b.totalPoints - a.totalPoints);
        setList(sorted);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar ranking");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const top3 = list?.slice(0, 3) ?? [];
  const rest = list?.slice(3) ?? [];

  return (
    <DashboardLayout
      title="Ranking de Pontos"
      subtitle="Lista global ordenada pela pontuação total dos alunos."
    >
      <AnimatedToast
        message={error}
        type="error"
        onClose={() => setError(null)}
      />
      <div className="flex flex-col gap-6">
        {list === null ? (
          <div className={`${cardClass} animate-pulse text-sm text-muted-foreground`}>
            Carregando ranking...
          </div>
        ) : list.length === 0 ? (
          <div className={`${cardClass} text-sm text-muted-foreground`}>
            Nenhum aluno pontuou ainda.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {top3[1] && <PodiumCard entry={top3[1]} position={2} />}
              {top3[0] && <PodiumCard entry={top3[0]} position={1} />}
              {top3[2] && <PodiumCard entry={top3[2]} position={3} />}
            </div>

            {rest.length > 0 && (
              <div className={cardClass}>
                <table
                  className="w-full text-sm"
                  data-testid="ranking-pontos-table"
                >
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="w-12 px-2 py-3">#</th>
                      <th className="px-2 py-3">Aluno</th>
                      <th className="w-32 px-2 py-3 text-right">Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((entry, idx) => (
                      <tr
                        key={entry.userId}
                        className="border-t border-border/60"
                      >
                        <td className="px-2 py-3 text-muted-foreground">
                          {idx + 4}
                        </td>
                        <td className="flex items-center gap-3 px-2 py-3">
                          <Avatar
                            src={entry.profilePictureUrl}
                            name={entry.name}
                          />
                          <span className="font-medium text-foreground">
                            {entry.name}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-foreground">
                          {entry.totalPoints.toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
