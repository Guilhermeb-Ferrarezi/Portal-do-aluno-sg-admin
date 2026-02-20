import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import {
  listarCursos,
  listarModulosPorCurso,
  listarFasesDoModulo,
  criarModulo,
  criarFase,
  type Curso,
  type Modulo,
  type Fase,
} from "../services/api";
import { AnimatedButton, AnimatedSelect, AnimatedToast } from "../components/animate-ui";
import { Loader2, Plus } from "lucide-react";
import "./EstruturaCurso.css";

export default function EstruturaCursoPage() {
  const [toastMsg, setToastMsg] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");

  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");
  const [buscaModulo, setBuscaModulo] = React.useState("");
  const [showSugestoesModulo, setShowSugestoesModulo] = React.useState(false);

  const [fasesModulo, setFasesModulo] = React.useState<Fase[]>([]);
  const [buscaFases, setBuscaFases] = React.useState("");

  const [novoModuloNome, setNovoModuloNome] = React.useState("");
  const [novoModuloDescricao, setNovoModuloDescricao] = React.useState("");
  const [criandoModulo, setCriandoModulo] = React.useState(false);

  const [novaFaseNome, setNovaFaseNome] = React.useState("");
  const [novaFaseWeek, setNovaFaseWeek] = React.useState(1);
  const [criandoFase, setCriandoFase] = React.useState(false);

  React.useEffect(() => {
    listarCursos()
      .then((data) => {
        setCursos(data);
        const firstCourseId = data[0]?.id ?? "";
        setCourseIdSelecionado(firstCourseId);
      })
      .catch((e) => setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar cursos" }));
  }, []);

  React.useEffect(() => {
    if (!courseIdSelecionado) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }

    listarModulosPorCurso(courseIdSelecionado)
      .then((mods) => {
        setModulosCurso(mods);
        setModuloIdSelecionado(mods[0]?.id ?? "");
        setBuscaModulo(mods[0]?.nome ?? "");
      })
      .catch((e) => setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar módulos" }));
  }, [courseIdSelecionado]);

  React.useEffect(() => {
    if (!moduloIdSelecionado) {
      setFasesModulo([]);
      return;
    }

    listarFasesDoModulo(moduloIdSelecionado)
      .then(setFasesModulo)
      .catch((e) => setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar fases" }));
  }, [moduloIdSelecionado]);

  async function handleCriarModulo(e: React.FormEvent) {
    e.preventDefault();
    if (!courseIdSelecionado || !novoModuloNome.trim()) {
      setToastMsg({ type: "error", msg: "Selecione o curso e informe o nome do módulo" });
      return;
    }

    try {
      setCriandoModulo(true);
      const result = await criarModulo({
        nome: novoModuloNome.trim(),
        descricao: novoModuloDescricao.trim() || null,
        course_id: Number(courseIdSelecionado),
      });

      setNovoModuloNome("");
      setNovoModuloDescricao("");
      setToastMsg({ type: "success", msg: "Módulo criado com sucesso" });

      const mods = await listarModulosPorCurso(courseIdSelecionado);
      setModulosCurso(mods);
      const nextId = result.modulo.id || mods[0]?.id || "";
      setModuloIdSelecionado(nextId);
      setBuscaModulo(mods.find((m) => m.id === nextId)?.nome || "");
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar módulo" });
    } finally {
      setCriandoModulo(false);
    }
  }

  const termoModulo = buscaModulo.trim().toLowerCase();
  const modulosFiltrados =
    termoModulo.length === 0
      ? []
      : modulosCurso.filter((m) => m.nome.toLowerCase().includes(termoModulo)).slice(0, 8);

  const fasesFiltradas = fasesModulo.filter((fase) => {
    const termo = buscaFases.trim().toLowerCase();
    if (!termo) return true;
    return (
      fase.nome.toLowerCase().includes(termo) ||
      String(fase.weekNumber).includes(termo)
    );
  });
  const buscaFasesAtiva = buscaFases.trim().length > 0;

  async function handleCriarFase(e: React.FormEvent) {
    e.preventDefault();
    if (!moduloIdSelecionado || !novaFaseNome.trim()) {
      setToastMsg({ type: "error", msg: "Selecione o módulo e informe o nome da fase" });
      return;
    }

    try {
      setCriandoFase(true);
      await criarFase(moduloIdSelecionado, {
        nome: novaFaseNome.trim(),
        week_number: novaFaseWeek,
      });

      setNovaFaseNome("");
      setNovaFaseWeek((prev) => prev + 1);
      setToastMsg({ type: "success", msg: "Fase criada com sucesso" });

      const fases = await listarFasesDoModulo(moduloIdSelecionado);
      setFasesModulo(fases);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar fase" });
    } finally {
      setCriandoFase(false);
    }
  }

  return (
    <DashboardLayout title="Estrutura do Curso" subtitle="Crie módulos e fases separado das turmas">
      <div className="estruturaContainer">
        <AnimatedToast
          message={toastMsg?.msg || null}
          type={toastMsg?.type || "success"}
          duration={3000}
          onClose={() => setToastMsg(null)}
        />

        <div className="estruturaCard">
          <div className="estruturaCardHead">
            <h2>Criar Módulo</h2>
            <p>Defina a base de conteúdo do curso.</p>
          </div>
          <form onSubmit={handleCriarModulo} className="estruturaForm">
            <label>Curso *</label>
            <AnimatedSelect
              className="estruturaSelect"
              value={courseIdSelecionado}
              onChange={(e) => setCourseIdSelecionado(e.target.value)}
            >
              <option value="">Selecione um curso</option>
              {cursos.map((curso) => (
                <option key={curso.id} value={curso.id}>
                  {curso.nome}
                </option>
              ))}
            </AnimatedSelect>

            <label>Nome do módulo *</label>
            <input
              value={novoModuloNome}
              onChange={(e) => setNovoModuloNome(e.target.value)}
              placeholder="Ex: JavaScript + DOM"
            />

            <label>Descrição</label>
            <textarea
              value={novoModuloDescricao}
              onChange={(e) => setNovoModuloDescricao(e.target.value)}
              placeholder="Opcional"
            />

            <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoModulo}>
              {criandoModulo ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar módulo</>}
            </AnimatedButton>
          </form>
        </div>

        <div className="estruturaCard">
          <div className="estruturaCardHead">
            <h2>Criar Fase</h2>
            <p>Adicione etapas semanais ao módulo selecionado.</p>
          </div>
          <form onSubmit={handleCriarFase} className="estruturaForm">
            <label>Módulo * (buscar)</label>
            <div className="estruturaBuscaWrap">
              <input
                value={buscaModulo}
                onChange={(e) => {
                  const value = e.target.value;
                  setBuscaModulo(value);
                  setShowSugestoesModulo(value.trim().length > 0);
                  const exato = modulosCurso.find((m) => m.nome.toLowerCase() === value.trim().toLowerCase());
                  if (exato) {
                    setModuloIdSelecionado(exato.id);
                  }
                }}
                onFocus={() => {
                  if (buscaModulo.trim().length > 0) setShowSugestoesModulo(true);
                }}
                placeholder="Digite para buscar módulo"
              />
              {showSugestoesModulo && buscaModulo.trim().length > 0 && modulosFiltrados.length > 0 && (
                <div className="estruturaSugestoes">
                  {modulosFiltrados.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      className={`estruturaSugestaoItem ${mod.id === moduloIdSelecionado ? "active" : ""}`}
                      onClick={() => {
                        setModuloIdSelecionado(mod.id);
                        setBuscaModulo(mod.nome);
                        setShowSugestoesModulo(false);
                      }}
                    >
                      <span className="ordem">{mod.indexOrder}.</span> {mod.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label>Nome da fase *</label>
            <input
              value={novaFaseNome}
              onChange={(e) => setNovaFaseNome(e.target.value)}
              placeholder="Ex: Semana 1 - Introdução"
            />

            <label>Semana</label>
            <input
              type="number"
              min={1}
              value={novaFaseWeek}
              onChange={(e) => setNovaFaseWeek(Math.max(1, Number(e.target.value) || 1))}
            />

            <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoFase || !moduloIdSelecionado}>
              {criandoFase ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar fase</>}
            </AnimatedButton>
          </form>

          <div className="fasesPanel">
            <div className="fasesResumo">
              {moduloIdSelecionado
                ? `${fasesModulo.length} fase(s) cadastrada(s) neste módulo.`
                : "Selecione um módulo para ver as fases."}
            </div>
            {moduloIdSelecionado && (
              <input
                className="fasesBuscaInput"
                value={buscaFases}
                onChange={(e) => setBuscaFases(e.target.value)}
                placeholder="Buscar fases por nome ou semana"
              />
            )}
            {buscaFasesAtiva && (
              <div className="fasesChips">
                {fasesFiltradas.length > 0 ? (
                  fasesFiltradas.map((fase) => (
                    <span key={fase.id} className="faseChip">
                      Sem. {fase.weekNumber}: {fase.nome}
                    </span>
                  ))
                ) : (
                  <div className="fasesVazio">
                    {moduloIdSelecionado
                      ? "Nenhuma fase encontrada para essa busca."
                      : "Selecione um módulo para listar as fases."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
