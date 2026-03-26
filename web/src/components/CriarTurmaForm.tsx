import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
} from "./animate-ui";
import { Loader2, Plus, Search, Check, Users, UserPlus } from "lucide-react";
import {
  criarTurma,
  listarCursos,
  listarModulosPorCurso,
  listarAlunos,
  adicionarAlunosNaTurma,
  type Curso,
  type Modulo,
  type User,
  type Turma,
} from "../services/api";

interface CriarTurmaFormProps {
  onCreated?: () => void;
}

export default function CriarTurmaForm({ onCreated }: CriarTurmaFormProps) {
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  );

  const [nome, setNome] = React.useState("");
  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");

  const [dataInicio, setDataInicio] = React.useState("");
  const [duracaoSemanas, setDuracaoSemanas] = React.useState(12);
  const [cronogramaAtivo, setCronogramaAtivo] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Modal Adicionar Alunos
  const [modalAdicionarAberto, setModalAdicionarAberto] = React.useState(false);
  const [turmaAcabadaCriar, setTurmaAcabadaCriar] = React.useState<Turma | null>(null);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [adicionando, setAdicionando] = React.useState(false);
  const [buscaAluno, setBuscaAluno] = React.useState("");

  const alunosFiltrados = React.useMemo(() => {
    const q = buscaAluno.toLowerCase();
    if (!q) return alunosDisponiveis;
    return alunosDisponiveis.filter(
      (a) => a.nome.toLowerCase().includes(q) || (a.usuario ?? "").toLowerCase().includes(q),
    );
  }, [alunosDisponiveis, buscaAluno]);

  async function carregarModulosDoCurso(courseId: string) {
    if (!courseId) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }
    const mods = await listarModulosPorCurso(courseId);
    setModulosCurso(mods);
    setModuloIdSelecionado(mods[0]?.id ?? "");
  }

  React.useEffect(() => {
    listarCursos()
      .then((data) => {
        const items = Array.isArray(data) ? data : (data as any).items ?? [];
        setCursos(items);
        const firstId = items[0]?.id ?? "";
        setCourseIdSelecionado(firstId);
        if (firstId) carregarModulosDoCurso(firstId).catch(console.error);
      })
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    if (!courseIdSelecionado) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }
    carregarModulosDoCurso(courseIdSelecionado).catch(console.error);
  }, [courseIdSelecionado]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setToastMsg({ type: "error", msg: "Nome da turma é obrigatório" });
      return;
    }

    try {
      setSaving(true);
      const criarDados: Record<string, unknown> = {
        nome,
        tipo: "turma",
        categoria: "programacao",
        descricao: null,
        data_inicio: dataInicio || null,
        duracao_semanas: duracaoSemanas,
        cronograma_ativo: cronogramaAtivo,
      };
      if (courseIdSelecionado) criarDados.course_id = Number(courseIdSelecionado);
      if (moduloIdSelecionado) criarDados.current_module_id = Number(moduloIdSelecionado);

      const created = await criarTurma(criarDados as any);
      const turmaCriada = created.turma;
      setToastMsg({ type: "success", msg: "Turma criada! Agora adicione alunos." });

      setNome("");
      setDataInicio("");
      setDuracaoSemanas(12);
      setCronogramaAtivo(false);

      if (turmaCriada) {
        setTurmaAcabadaCriar(turmaCriada);
        const alunos = await listarAlunos();
        setAlunosDisponiveis(alunos);
        setModalAdicionarAberto(true);
      }

      onCreated?.();
    } catch (err) {
      setToastMsg({ type: "error", msg: err instanceof Error ? err.message : "Erro ao criar turma" });
    } finally {
      setSaving(false);
    }
  }

  function fecharModalAdicionar() {
    setModalAdicionarAberto(false);
    setTurmaAcabadaCriar(null);
    setAlunosSelecionados([]);
    setAlunosDisponiveis([]);
    setBuscaAluno("");
  }

  async function handleAdicionarAlunos() {
    if (!turmaAcabadaCriar || alunosSelecionados.length === 0) return;
    try {
      setAdicionando(true);
      await adicionarAlunosNaTurma(turmaAcabadaCriar.id, alunosSelecionados);
      setToastMsg({ type: "success", msg: "Alunos adicionados com sucesso!" });
      fecharModalAdicionar();
    } catch (err) {
      setToastMsg({ type: "error", msg: err instanceof Error ? err.message : "Erro ao adicionar alunos" });
    } finally {
      setAdicionando(false);
    }
  }

  const disabled = saving || !nome.trim() || !courseIdSelecionado || !moduloIdSelecionado;
  const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
  const helperTextClass = "text-xs leading-5 text-muted-foreground";
  const inputClass =
    "h-11 rounded-xl border-border/70 bg-background/80 text-foreground shadow-none transition placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
  const selectClass = "h-11 w-full rounded-xl border border-border/70 bg-background/80 px-3 text-sm text-foreground shadow-none outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";
  const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
  const allFilteredSelected =
    alunosFiltrados.length > 0 && alunosFiltrados.every((aluno) => alunosSelecionados.includes(aluno.id));

  return (
    <>
      <AnimatedToast
        message={toastMsg?.msg || null}
        type={toastMsg?.type || "success"}
        duration={3000}
        onClose={() => setToastMsg(null)}
      />

      <Card className="col-span-full rounded-[28px] border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Criar Nova Turma</CardTitle>
          <CardDescription>Preencha os dados para criar uma nova turma.</CardDescription>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2 lg:col-span-2">
                <span className={fieldLabelClass}>Nome da Turma *</span>
                <Input
                  className={inputClass}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="ex: Turma A 2024"
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={fieldLabelClass}>Curso *</span>
                <AnimatedSelect
                  className={selectClass}
                  value={courseIdSelecionado}
                  onChange={(e) => setCourseIdSelecionado(e.target.value)}
                >
                  <option value="" disabled>Selecione um curso</option>
                  {cursos
                    .filter((c) => !c.isPaid)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                </AnimatedSelect>
              </label>

              <div className="flex flex-col gap-2">
                <span className={fieldLabelClass}>Módulo Inicial</span>
                <Input
                  className={cn(inputClass, "cursor-not-allowed opacity-70")}
                  value={
                    modulosCurso.length > 0
                      ? `${modulosCurso[0].indexOrder}. ${modulosCurso[0].nome}`
                      : "Nenhum módulo disponível"
                  }
                  readOnly
                  disabled
                />
                <p className={helperTextClass}>A turma sempre inicia no primeiro módulo do curso.</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-muted/25 p-4 sm:p-5">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Configuração de Cronograma</h3>
                <p className={helperTextClass}>Opcional, para liberação semanal automática de exercícios.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className={fieldLabelClass}>Data de Início da Turma</span>
                  <Input
                    className={inputClass}
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                  <p className={helperTextClass}>
                    Data em que a turma começa para cálculo do cronograma.
                  </p>
                </label>

                <label className="flex flex-col gap-2">
                  <span className={fieldLabelClass}>Duração do Cronograma</span>
                  <Input
                    className={inputClass}
                    type="number"
                    min="1"
                    max="52"
                    value={duracaoSemanas}
                    onChange={(e) => setDuracaoSemanas(parseInt(e.target.value) || 12)}
                  />
                  <p className={helperTextClass}>Defina a quantidade de semanas da trilha.</p>
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition",
                    cronogramaAtivo
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/70 bg-background/80 hover:bg-muted/50"
                  )}
                  onClick={() => setCronogramaAtivo((prev) => !prev)}
                  aria-pressed={cronogramaAtivo}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">Ativar Cronograma Automático</div>
                    <div className={helperTextClass}>
                      Se ativado, os exercícios serão liberados conforme o planejamento.
                    </div>
                  </div>
                  <span
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition",
                      cronogramaAtivo ? "border-primary/50 bg-primary" : "border-border bg-muted"
                    )}
                    aria-hidden="true"
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm transition",
                        cronogramaAtivo && "translate-x-5"
                      )}
                    />
                  </span>
                </button>
              </div>
            </div>

            <AnimatedButton className={cn(primaryButtonClass, "self-start")} type="submit" disabled={disabled}>
              {saving
                ? iconLabel(<Loader2 size={16} />, "Criando...")
                : iconLabel(<Plus size={16} />, "Criar Turma")}
            </AnimatedButton>
          </form>
        </CardContent>
      </Card>

      <Dialog open={modalAdicionarAberto} onOpenChange={(open) => !open && fecharModalAdicionar()}>
        <DialogContent
          overlayClassName="bg-black/70 backdrop-blur-sm"
          className="max-w-[720px] gap-0 border-border/70 bg-card/95 p-0"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle>Adicionar Alunos</DialogTitle>
                <p className="text-sm leading-6 text-muted-foreground">{turmaAcabadaCriar?.nome}</p>
              </div>
              {alunosSelecionados.length > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                >
                  <UserPlus />
                  {alunosSelecionados.length} selecionado{alunosSelecionados.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {alunosDisponiveis.length === 0 ? (
            <div className="grid place-items-center gap-3 px-6 py-12 text-center text-muted-foreground">
              <div className="inline-flex size-16 items-center justify-center rounded-full bg-muted/60">
                <Users size={28} />
              </div>
              <p className="max-w-sm text-sm leading-6">
                Nenhum aluno disponível para adicionar agora.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    className={cn(inputClass, "pl-9")}
                    type="text"
                    placeholder="Buscar aluno por nome ou usuário..."
                    value={buscaAluno}
                    onChange={(e) => setBuscaAluno(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                  <span className="text-xs font-medium text-muted-foreground">
                    {alunosFiltrados.length} aluno{alunosFiltrados.length !== 1 ? "s" : ""} encontrado{alunosFiltrados.length !== 1 ? "s" : ""}
                  </span>
                  <AnimatedButton
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      const todosIds = alunosFiltrados.map((a) => a.id);
                      if (allFilteredSelected) {
                        setAlunosSelecionados(alunosSelecionados.filter((id) => !todosIds.includes(id)));
                      } else {
                        setAlunosSelecionados([...new Set([...alunosSelecionados, ...todosIds])]);
                      }
                    }}
                  >
                    {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </AnimatedButton>
                </div>
              </div>

              <div className="max-h-[360px] overflow-y-auto rounded-[24px] border border-border/70 bg-background/70 p-2">
                <div className="flex flex-col gap-2">
                  {alunosFiltrados.map((aluno) => {
                    const isSelected = alunosSelecionados.includes(aluno.id);

                    return (
                      <label
                        key={aluno.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition",
                          isSelected
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/60 bg-background/60 hover:bg-muted/50"
                        )}
                      >
                        <input
                          className="sr-only"
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAlunosSelecionados([...alunosSelecionados, aluno.id]);
                            } else {
                              setAlunosSelecionados(alunosSelecionados.filter((id) => id !== aluno.id));
                            }
                          }}
                        />
                        <span
                          className={cn(
                            "inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-transparent"
                          )}
                        >
                          <Check size={14} strokeWidth={3} />
                        </span>
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {aluno.nome.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">{aluno.nome}</div>
                          <div className="truncate text-sm text-muted-foreground">@{aluno.usuario ?? aluno.nome}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="max-[640px]:flex-col">
            <AnimatedButton onClick={fecharModalAdicionar} className={secondaryButtonClass} disabled={adicionando}>
              Pular por enquanto
            </AnimatedButton>
            <AnimatedButton
              onClick={handleAdicionarAlunos}
              className={primaryButtonClass}
              disabled={adicionando || alunosSelecionados.length === 0}
            >
              {adicionando
                ? iconLabel(<Loader2 size={16} />, "Adicionando...")
                : iconLabel(<UserPlus size={16} />, `Adicionar (${alunosSelecionados.length})`)}
            </AnimatedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
