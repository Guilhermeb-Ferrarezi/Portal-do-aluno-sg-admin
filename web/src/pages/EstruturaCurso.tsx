import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import PaginatedSelect from "../components/PaginatedSelect";
import {
  listarCursos,
  criarCurso,
  listarModulosPorCurso,
  listarFasesDoModulo,
  criarModulo,
  criarFase,
  deletarCurso,
  deletarModulo,
  deletarFase,
  type Curso,
  type Modulo,
  type Fase,
} from "../services/api";
import { AnimatedButton, AnimatedToast } from "../components/animate-ui";
import { Loader2, Plus, Layers, GitBranch, Trash2 } from "lucide-react";
import "./EstruturaCurso.css";

type AbaEstrutura = "curso" | "modulo" | "fase";
type DetalheModalState =
  | { tipo: "curso"; item: Curso }
  | { tipo: "modulo"; item: Modulo }
  | { tipo: "fase"; item: Fase }
  | null;

export default function EstruturaCursoPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [toastMsg, setToastMsg] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [cursos, setCursos] = React.useState<Curso[]>([]);
  const [courseIdSelecionado, setCourseIdSelecionado] = React.useState("");

  const [modulosCurso, setModulosCurso] = React.useState<Modulo[]>([]);
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");

  const [fasesModulo, setFasesModulo] = React.useState<Fase[]>([]);

  const [novoCursoNome, setNovoCursoNome] = React.useState("");
  const [novoCursoDescricao, setNovoCursoDescricao] = React.useState("");
  const [novoCursoPago, setNovoCursoPago] = React.useState(false);
  const [criandoCurso, setCriandoCurso] = React.useState(false);

  const [novoModuloNome, setNovoModuloNome] = React.useState("");
  const [novoModuloDescricao, setNovoModuloDescricao] = React.useState("");
  const [criandoModulo, setCriandoModulo] = React.useState(false);

  const [novaFaseNome, setNovaFaseNome] = React.useState("");
  const [novaFaseWeek, setNovaFaseWeek] = React.useState(1);
  const [criandoFase, setCriandoFase] = React.useState(false);

  const [filtroCursoId, setFiltroCursoId] = React.useState("");
  const [paginaCursos, setPaginaCursos] = React.useState(1);
  const [itensCursos, setItensCursos] = React.useState(10);

  const [filtroModuloId, setFiltroModuloId] = React.useState("");
  const [paginaModulos, setPaginaModulos] = React.useState(1);
  const [itensModulos, setItensModulos] = React.useState(10);

  const [filtroFaseId, setFiltroFaseId] = React.useState("");
  const [paginaFases, setPaginaFases] = React.useState(1);
  const [itensFases, setItensFases] = React.useState(10);
  const [detalheModal, setDetalheModal] = React.useState<DetalheModalState>(null);
  const [deletandoDetalhe, setDeletandoDetalhe] = React.useState(false);

  const abaAtiva: AbaEstrutura = React.useMemo(() => {
    if (location.pathname.endsWith("/modulos")) return "modulo";
    if (location.pathname.endsWith("/fases")) return "fase";
    return "curso";
  }, [location.pathname]);

  const rotaAba = (aba: AbaEstrutura) => {
    if (aba === "modulo") return "/dashboard/estrutura-curso/modulos";
    if (aba === "fase") return "/dashboard/estrutura-curso/fases";
    return "/dashboard/estrutura-curso/cursos";
  };

  const carregarCursos = React.useCallback(async () => {
    const data = await listarCursos();
    setCursos(data);
    setCourseIdSelecionado((prev) => (data.some((c) => c.id === prev) ? prev : data[0]?.id || ""));
  }, []);

  React.useEffect(() => {
    carregarCursos().catch((e) =>
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao carregar cursos" })
    );
  }, [carregarCursos]);

  React.useEffect(() => {
    if (!courseIdSelecionado) {
      setModulosCurso([]);
      setModuloIdSelecionado("");
      return;
    }

    listarModulosPorCurso(courseIdSelecionado)
      .then((mods) => {
        setModulosCurso(mods);
        setModuloIdSelecionado((prev) => (mods.some((m) => m.id === prev) ? prev : mods[0]?.id || ""));
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

  React.useEffect(() => setPaginaCursos(1), [filtroCursoId, itensCursos]);
  React.useEffect(() => setPaginaModulos(1), [filtroModuloId, courseIdSelecionado, itensModulos]);
  React.useEffect(() => setPaginaFases(1), [filtroFaseId, moduloIdSelecionado, itensFases]);

  async function handleCriarCurso(e: React.FormEvent) {
    e.preventDefault();
    if (!novoCursoNome.trim()) {
      setToastMsg({ type: "error", msg: "Informe o nome do curso" });
      return;
    }

    try {
      setCriandoCurso(true);
      const result = await criarCurso({
        nome: novoCursoNome.trim(),
        descricao: novoCursoDescricao.trim() || null,
        is_paid: novoCursoPago,
      });

      setNovoCursoNome("");
      setNovoCursoDescricao("");
      setNovoCursoPago(false);
      setToastMsg({ type: "success", msg: "Curso criado com sucesso" });

      await carregarCursos();
      if (result.curso?.id) {
        setCourseIdSelecionado(result.curso.id);
      }
      navigate(rotaAba("modulo"));
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar curso" });
    } finally {
      setCriandoCurso(false);
    }
  }

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
      navigate(rotaAba("fase"));
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : "Erro ao criar módulo" });
    } finally {
      setCriandoModulo(false);
    }
  }

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

  const cursosFiltrados = React.useMemo(() => {
    return cursos.filter((c) => {
      const matchesSelect = !filtroCursoId || c.id === filtroCursoId;
      return matchesSelect;
    });
  }, [cursos, filtroCursoId]);

  const modulosFiltrados = React.useMemo(() => {
    return modulosCurso.filter((m) => {
      const matchesSelect = !filtroModuloId || m.id === filtroModuloId;
      return matchesSelect;
    });
  }, [modulosCurso, filtroModuloId]);

  const fasesFiltradas = React.useMemo(() => {
    return fasesModulo.filter((f) => {
      const matchesSelect = !filtroFaseId || f.id === filtroFaseId;
      return matchesSelect;
    });
  }, [fasesModulo, filtroFaseId]);

  const paginaCursosItens = cursosFiltrados.slice((paginaCursos - 1) * itensCursos, paginaCursos * itensCursos);
  const paginaModulosItens = modulosFiltrados.slice((paginaModulos - 1) * itensModulos, paginaModulos * itensModulos);
  const paginaFasesItens = fasesFiltradas.slice((paginaFases - 1) * itensFases, paginaFases * itensFases);

  const cursoSelecionado = React.useMemo(
    () => cursos.find((curso) => curso.id === courseIdSelecionado) || null,
    [cursos, courseIdSelecionado]
  );

  const moduloSelecionado = React.useMemo(
    () => modulosCurso.find((modulo) => modulo.id === moduloIdSelecionado) || null,
    [modulosCurso, moduloIdSelecionado]
  );

  async function handleDeletarDetalhe() {
    if (!detalheModal || deletandoDetalhe) return;

    const nome = detalheModal.item.nome || "item";
    const tipoLabel =
      detalheModal.tipo === "curso"
        ? "curso"
        : detalheModal.tipo === "modulo"
          ? "módulo"
          : "fase";

    if (!window.confirm(`Tem certeza que deseja deletar ${tipoLabel} "${nome}"?`)) {
      return;
    }

    try {
      setDeletandoDetalhe(true);

      if (detalheModal.tipo === "curso") {
        await deletarCurso(detalheModal.item.id);
        await carregarCursos();
      } else if (detalheModal.tipo === "modulo") {
        await deletarModulo(detalheModal.item.id);
        if (courseIdSelecionado) {
          const mods = await listarModulosPorCurso(courseIdSelecionado);
          setModulosCurso(mods);
          const nextId = mods[0]?.id || "";
          setModuloIdSelecionado(nextId);
        } else {
          setModulosCurso([]);
          setModuloIdSelecionado("");
        }
      } else {
        await deletarFase(detalheModal.item.id);
        if (moduloIdSelecionado) {
          const fases = await listarFasesDoModulo(moduloIdSelecionado);
          setFasesModulo(fases);
        } else {
          setFasesModulo([]);
        }
      }

      setToastMsg({ type: "success", msg: `${tipoLabel} deletado com sucesso` });
      setDetalheModal(null);
    } catch (e) {
      setToastMsg({ type: "error", msg: e instanceof Error ? e.message : `Erro ao deletar ${tipoLabel}` });
    } finally {
      setDeletandoDetalhe(false);
    }
  }

  return (
    <DashboardLayout title="Estrutura do Curso" subtitle="Criação e listagem separadas por página">
      <div className="estruturaContainerSingle">
        <AnimatedToast
          message={toastMsg?.msg || null}
          type={toastMsg?.type || "success"}
          duration={3000}
          onClose={() => setToastMsg(null)}
        />

        <div className="estruturaTabs" role="tablist" aria-label="Etapas de estrutura">
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "curso" ? "active" : ""}`} onClick={() => navigate(rotaAba("curso"))}>
            <Plus size={16} /> Criar curso
          </button>
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "modulo" ? "active" : ""}`} onClick={() => navigate(rotaAba("modulo"))}>
            <Layers size={16} /> Criar módulo
          </button>
          <button type="button" className={`estruturaTabBtn ${abaAtiva === "fase" ? "active" : ""}`} onClick={() => navigate(rotaAba("fase"))}>
            <GitBranch size={16} /> Criar fase
          </button>
        </div>

        <div className="estruturaOverview" aria-label="Resumo da estrutura">
          <div className="estruturaOverviewCard">
            <span>Cursos</span>
            <strong>{cursos.length}</strong>
          </div>
          <div className="estruturaOverviewCard">
            <span>Módulos</span>
            <strong>{modulosCurso.length}</strong>
          </div>
          <div className="estruturaOverviewCard">
            <span>Fases</span>
            <strong>{fasesModulo.length}</strong>
          </div>
        </div>

        {abaAtiva === "curso" && (
          <div className="estruturaGrid">
            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Criar Curso</h2>
                <p>Formulário de criação de curso.</p>
              </div>
              <form onSubmit={handleCriarCurso} className="estruturaForm">
                <label>Nome do curso *</label>
                <input value={novoCursoNome} onChange={(e) => setNovoCursoNome(e.target.value)} placeholder="Ex: Programação Full Stack" />

                <label>Descrição</label>
                <textarea value={novoCursoDescricao} onChange={(e) => setNovoCursoDescricao(e.target.value)} placeholder="Opcional" />

                <label className="estruturaSwitchRow">
                  <input type="checkbox" className="estruturaSwitchInput" checked={novoCursoPago} onChange={(e) => setNovoCursoPago(e.target.checked)} />
                  <span className="estruturaSwitchTrack" aria-hidden="true">
                    <span className="estruturaSwitchThumb" />
                  </span>
                  <span className="estruturaSwitchText">{novoCursoPago ? "Curso pago" : "Curso gratuito"}</span>
                </label>

                <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoCurso}>
                  {criandoCurso ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar curso</>}
                </AnimatedButton>
              </form>
            </div>

            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Cursos Disponíveis</h2>
                <p>Filtre e navegue pelos cursos cadastrados.</p>
              </div>
              <div className="estruturaForm">
                <PaginatedSelect
                  value={filtroCursoId}
                  onChange={setFiltroCursoId}
                  options={cursos.map((c) => ({
                    value: c.id,
                    label: c.nome,
                    meta: c.isPaid ? "Pago" : "Gratuito",
                  }))}
                  placeholder="Busque ou selecione um curso"
                  emptyText="Nenhum curso para selecionar"
                />
                {filtroCursoId && (
                  <button type="button" className="filtroLimparBtn" onClick={() => setFiltroCursoId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="viewerList" style={{ marginTop: 10 }}>
                {paginaCursosItens.length === 0 ? (
                  <div className="viewerEmpty">Nenhum curso encontrado.</div>
                ) : (
                  paginaCursosItens.map((curso) => (
                    <button
                      key={curso.id}
                      type="button"
                      className={`viewerItem ${curso.id === courseIdSelecionado ? "active" : ""}`}
                      onClick={() => {
                        setCourseIdSelecionado(curso.id);
                        setDetalheModal({ tipo: "curso", item: curso });
                      }}
                    >
                      <span className="viewerItemTitle">{curso.nome}</span>
                      <span className="viewerItemMeta">{curso.isPaid ? "Pago" : "Gratuito"}</span>
                    </button>
                  ))
                )}
              </div>
              <Pagination
                currentPage={paginaCursos}
                itemsPerPage={itensCursos}
                totalItems={cursosFiltrados.length}
                onPageChange={setPaginaCursos}
                onItemsPerPageChange={setItensCursos}
              />
            </div>
          </div>
        )}

        {abaAtiva === "modulo" && (
          <div className="estruturaGrid">
            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Criar Módulo</h2>
                <p>Formulário de criação de módulo.</p>
              </div>
              <form onSubmit={handleCriarModulo} className="estruturaForm">
                <label>Curso *</label>
                <PaginatedSelect
                  value={courseIdSelecionado}
                  onChange={setCourseIdSelecionado}
                  options={cursos.map((curso) => ({
                    value: curso.id,
                    label: curso.nome,
                    meta: curso.isPaid ? "Pago" : "Gratuito",
                  }))}
                  placeholder="Selecione um curso"
                  emptyText="Nenhum curso cadastrado"
                />

                <label>Nome do módulo *</label>
                <input value={novoModuloNome} onChange={(e) => setNovoModuloNome(e.target.value)} placeholder="Ex: JavaScript + DOM" />

                <label>Descrição</label>
                <textarea value={novoModuloDescricao} onChange={(e) => setNovoModuloDescricao(e.target.value)} placeholder="Opcional" />

                <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoModulo}>
                  {criandoModulo ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar módulo</>}
                </AnimatedButton>
              </form>
            </div>

            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Módulos Disponíveis</h2>
                <p>Filtre e visualize os módulos do curso selecionado.</p>
              </div>
              <div className="estruturaForm">
                <PaginatedSelect
                  value={filtroModuloId}
                  onChange={setFiltroModuloId}
                  options={modulosCurso.map((m) => ({
                    value: m.id,
                    label: m.nome,
                    meta: `Ordem #${m.indexOrder}`,
                  }))}
                  placeholder="Filtrar por módulo (lista paginada)"
                  disabled={!courseIdSelecionado}
                  emptyText="Nenhum módulo para selecionar"
                />
                {filtroModuloId && (
                  <button type="button" className="filtroLimparBtn" onClick={() => setFiltroModuloId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="viewerList" style={{ marginTop: 10 }}>
                {!courseIdSelecionado ? (
                  <div className="viewerEmpty">Selecione um curso para listar módulos.</div>
                ) : paginaModulosItens.length === 0 ? (
                  <div className="viewerEmpty">Nenhum módulo encontrado.</div>
                ) : (
                  paginaModulosItens.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      className={`viewerItem ${mod.id === moduloIdSelecionado ? "active" : ""}`}
                      onClick={() => {
                        setModuloIdSelecionado(mod.id);
                        setDetalheModal({ tipo: "modulo", item: mod });
                      }}
                    >
                      <span className="viewerItemTitle">{mod.nome}</span>
                      <span className="viewerItemMeta">#{mod.indexOrder}</span>
                    </button>
                  ))
                )}
              </div>
              <Pagination
                currentPage={paginaModulos}
                itemsPerPage={itensModulos}
                totalItems={modulosFiltrados.length}
                onPageChange={setPaginaModulos}
                onItemsPerPageChange={setItensModulos}
              />
            </div>
          </div>
        )}

        {abaAtiva === "fase" && (
          <div className="estruturaGrid">
            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Criar Fase</h2>
                <p>Formulário de criação de fase.</p>
              </div>
              <form onSubmit={handleCriarFase} className="estruturaForm">
                <label>Módulo *</label>
                <PaginatedSelect
                  value={moduloIdSelecionado}
                  onChange={setModuloIdSelecionado}
                  options={modulosCurso.map((mod) => ({
                    value: mod.id,
                    label: mod.nome,
                    meta: `Ordem #${mod.indexOrder}`,
                  }))}
                  placeholder={courseIdSelecionado ? "Selecione um módulo" : "Selecione um curso primeiro"}
                  disabled={!courseIdSelecionado}
                  emptyText="Nenhum módulo cadastrado para este curso"
                />

                <label>Nome da fase *</label>
                <input value={novaFaseNome} onChange={(e) => setNovaFaseNome(e.target.value)} placeholder="Ex: Semana 1 - Introdução" />

                <label>Semana</label>
                <input type="number" min={1} value={novaFaseWeek} onChange={(e) => setNovaFaseWeek(Math.max(1, Number(e.target.value) || 1))} />

                <AnimatedButton className="estruturaSubmitBtn" type="submit" disabled={criandoFase || !moduloIdSelecionado}>
                  {criandoFase ? <><Loader2 size={16} /> Criando...</> : <><Plus size={16} /> Criar fase</>}
                </AnimatedButton>
              </form>
            </div>

            <div className="estruturaCard">
              <div className="estruturaCardHead">
                <h2>Fases Disponíveis</h2>
                <p>Filtre e visualize as fases do módulo selecionado.</p>
              </div>
              <div className="estruturaForm">
                <PaginatedSelect
                  value={filtroFaseId}
                  onChange={setFiltroFaseId}
                  options={fasesModulo.map((f) => ({
                    value: f.id,
                    label: f.nome,
                    meta: `Semana ${f.weekNumber}`,
                  }))}
                  placeholder="Filtrar por fase (lista paginada)"
                  disabled={!moduloIdSelecionado}
                  emptyText="Nenhuma fase para selecionar"
                />
                {filtroFaseId && (
                  <button type="button" className="filtroLimparBtn" onClick={() => setFiltroFaseId("")}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="viewerList" style={{ marginTop: 10 }}>
                {!moduloIdSelecionado ? (
                  <div className="viewerEmpty">Selecione um módulo para listar fases.</div>
                ) : paginaFasesItens.length === 0 ? (
                  <div className="viewerEmpty">Nenhuma fase encontrada.</div>
                ) : (
                  paginaFasesItens.map((fase) => (
                    <button
                      key={fase.id}
                      type="button"
                      className="viewerItem"
                      onClick={() => setDetalheModal({ tipo: "fase", item: fase })}
                    >
                      <span className="viewerItemTitle">{fase.nome}</span>
                      <span className="viewerItemMeta">Semana {fase.weekNumber}</span>
                    </button>
                  ))
                )}
              </div>
              <Pagination
                currentPage={paginaFases}
                itemsPerPage={itensFases}
                totalItems={fasesFiltradas.length}
                onPageChange={setPaginaFases}
                onItemsPerPageChange={setItensFases}
              />
            </div>
          </div>
        )}

        <Modal
          isOpen={!!detalheModal}
          onClose={() => setDetalheModal(null)}
          title={
            detalheModal
              ? detalheModal.tipo === "curso"
                ? "Detalhes do curso"
                : detalheModal.tipo === "modulo"
                  ? "Detalhes do módulo"
                  : "Detalhes da fase"
              : "Detalhes"
          }
          size="md"
          footer={
            <>
              <AnimatedButton className="estruturaModalBtn estruturaModalBtnGhost" onClick={() => setDetalheModal(null)}>
                Fechar
              </AnimatedButton>
              <AnimatedButton className="estruturaModalBtn estruturaModalBtnDanger" onClick={handleDeletarDetalhe} disabled={deletandoDetalhe}>
                {deletandoDetalhe ? (
                  <>
                    <Loader2 size={14} /> Deletando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Deletar
                  </>
                )}
              </AnimatedButton>
            </>
          }
        >
          {detalheModal && (
            <div className="estruturaDetalhesGrid">
              <div className="estruturaDetalheRow">
                <span>ID</span>
                <strong>{detalheModal.item.id}</strong>
              </div>
              <div className="estruturaDetalheRow">
                <span>Nome</span>
                <strong>{detalheModal.item.nome}</strong>
              </div>

              {detalheModal.tipo === "curso" && (
                <>
                  <div className="estruturaDetalheRow">
                    <span>Descrição</span>
                    <strong>{detalheModal.item.descricao?.trim() || "Sem descrição"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Tipo</span>
                    <strong>{detalheModal.item.isPaid ? "Pago" : "Gratuito"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Módulos vinculados</span>
                    <strong>{courseIdSelecionado === detalheModal.item.id ? modulosCurso.length : "-"}</strong>
                  </div>
                </>
              )}

              {detalheModal.tipo === "modulo" && (
                <>
                  <div className="estruturaDetalheRow">
                    <span>Curso ID</span>
                    <strong>{detalheModal.item.courseId}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Ordem</span>
                    <strong>#{detalheModal.item.indexOrder}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Descrição</span>
                    <strong>{detalheModal.item.descricao?.trim() || "Sem descrição"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Fases vinculadas</span>
                    <strong>{moduloIdSelecionado === detalheModal.item.id ? fasesModulo.length : "-"}</strong>
                  </div>
                </>
              )}

              {detalheModal.tipo === "fase" && (
                <>
                  <div className="estruturaDetalheRow">
                    <span>Módulo ID</span>
                    <strong>{detalheModal.item.moduleId}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Semana</span>
                    <strong>{detalheModal.item.weekNumber}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Ordem</span>
                    <strong>#{detalheModal.item.indexOrder}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Admin autoriza</span>
                    <strong>{detalheModal.item.adminAuthorize ? "Sim" : "Não"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Criada em</span>
                    <strong>{detalheModal.item.createdAt ? new Date(detalheModal.item.createdAt).toLocaleString("pt-BR") : "-"}</strong>
                  </div>
                  <div className="estruturaDetalheRow">
                    <span>Atualizada em</span>
                    <strong>{detalheModal.item.updatedAt ? new Date(detalheModal.item.updatedAt).toLocaleString("pt-BR") : "-"}</strong>
                  </div>
                </>
              )}

              {detalheModal.tipo === "curso" && cursoSelecionado && courseIdSelecionado === detalheModal.item.id && (
                <div className="estruturaDetalheHint">
                  Curso selecionado atualmente para criação de módulos.
                </div>
              )}

              {detalheModal.tipo === "modulo" && moduloSelecionado && moduloIdSelecionado === detalheModal.item.id && (
                <div className="estruturaDetalheHint">
                  Módulo selecionado atualmente para criação de fases.
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
