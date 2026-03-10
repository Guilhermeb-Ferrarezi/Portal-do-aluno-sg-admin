import React from "react";
import Pagination from "./Pagination";
import PaginatedSelect from "./PaginatedSelect";
import MultipleChoiceQuestion from "./Exercise/MultipleChoiceQuestion";
import {
  ScaleIn,
  AnimatedRadioLabel,
  AnimatedButton,
  AnimatedToast,
  ConditionalFieldAnimation,
  AnimatedSelect,
  FadeInUp,
  AnimatedToggle,
} from "./animate-ui";
import {
  Laptop,
  Monitor,
  PenLine,
  ListChecks,
  Trash2,
  Eye,
  Sparkles,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import {
  criarExercicio,
  listarCursos,
  listarModulos,
  listarModulosPorCurso,
  listarFasesDoModulo,
  listarTurmas,
  anexarExercicioArquivo,
  type Curso,
  type Modulo,
  type Fase,
  type Turma,
} from "../services/api";
import { useToastActions } from "../contexts/ToastContext";
import "../pages/Exercises.css";

type CategoriaExercicio = "programacao" | "informatica";
type RequiredFieldKey = "titulo" | "descricao" | "curso" | "modulo" | "fase" | "prazo" | "multipla" | "ordem";

function inferCategoriaFromCourseName(courseName: string | null | undefined): CategoriaExercicio {
  const normalized = (courseName ?? "").toLowerCase();
  if (normalized.includes("inform") || normalized.includes("excel") || normalized.includes("office")) {
    return "informatica";
  }
  return "programacao";
}

function getDefaultMultiplaQuestoes() {
  return [{
    pergunta: "",
    opcoes: [
      { letter: "A", text: "" },
      { letter: "B", text: "" },
      { letter: "C", text: "" },
      { letter: "D", text: "" },
    ],
    respostaCorreta: "",
  }];
}

function normalizeListPayload<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as { items?: T[] }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

interface CriarExercicioFormProps {
  onCreated?: () => void;
}

export default function CriarExercicioForm({ onCreated }: CriarExercicioFormProps) {
  const { addToast } = useToastActions();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [gabarito, setGabarito] = React.useState("");
  const [cursosDisponiveis, setCursosDisponiveis] = React.useState<Curso[]>([]);
  const [cursoIdSelecionado, setCursoIdSelecionado] = React.useState("");
  const [todosModulosDisponiveis, setTodosModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [moduloSelectBusca, setModuloSelectBusca] = React.useState("");
  const [moduloSelectPagina, setModuloSelectPagina] = React.useState(1);
  const [moduloSelectTotalPages, setModuloSelectTotalPages] = React.useState(1);
  const [moduloSelectCarregando, setModuloSelectCarregando] = React.useState(false);
  const [moduloSelecionadoCache, setModuloSelecionadoCache] = React.useState<Modulo | null>(null);
  const [fasesDisponiveis, setFasesDisponiveis] = React.useState<Fase[]>([]);
  const [faseSelectBusca, setFaseSelectBusca] = React.useState("");
  const [faseSelectPagina, setFaseSelectPagina] = React.useState(1);
  const [faseSelectTotalPages, setFaseSelectTotalPages] = React.useState(1);
  const [faseSelectCarregando, setFaseSelectCarregando] = React.useState(false);
  const [faseSelecionadaCache, setFaseSelecionadaCache] = React.useState<Fase | null>(null);
  const [moduloIdSelecionado, setModuloIdSelecionado] = React.useState("");
  const [faseIdSelecionada, setFaseIdSelecionada] = React.useState("");
  const [prazo, setPrazo] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("");
  const [indexOrder, setIndexOrder] = React.useState("");
  const [pointsRedeem, setPointsRedeem] = React.useState("");
  const [exercisePeriod, setExercisePeriod] = React.useState("");
  const [isFinalExercise, setIsFinalExercise] = React.useState(false);
  const [isDailyTask, setIsDailyTask] = React.useState(false);
  const [categoria, setCategoria] = React.useState<CategoriaExercicio>("programacao");
  const [componenteInterativo, setComponenteInterativo] = React.useState("escrita");
  const [multiplaQuestoes, setMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>(() => getDefaultMultiplaQuestoes());
  const [anexosAtivo, setAnexosAtivo] = React.useState(false);
  const [anexoArquivo, setAnexoArquivo] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [fieldWarnings, setFieldWarnings] = React.useState<Partial<Record<RequiredFieldKey, string>>>({});
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [cursoCardsFiltro, setCursoCardsFiltro] = React.useState("");
  const [cursoCardsPagina, setCursoCardsPagina] = React.useState(1);
  const [cursoCardsItensPorPagina, setCursoCardsItensPorPagina] = React.useState(5);
  const [mostrarDetalhesCurso, setMostrarDetalhesCurso] = React.useState(false);

  const createDepsLoadedRef = React.useRef(false);
  const createDepsLoadingRef = React.useRef(false);

  const moduloSelecionado = React.useMemo(
    () => modulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ?? moduloSelecionadoCache ?? todosModulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ?? null,
    [moduloSelecionadoCache, modulosDisponiveis, todosModulosDisponiveis, moduloIdSelecionado]
  );

  const faseSelecionada = React.useMemo(
    () => fasesDisponiveis.find((f) => f.id === faseIdSelecionada) ?? faseSelecionadaCache ?? null,
    [fasesDisponiveis, faseIdSelecionada, faseSelecionadaCache]
  );

  const cursoSelecionado = React.useMemo(
    () => cursosDisponiveis.find((c) => c.id === cursoIdSelecionado) ?? null,
    [cursosDisponiveis, cursoIdSelecionado]
  );

  const modulosDoCursoSelecionado = React.useMemo(
    () => todosModulosDisponiveis.filter((m) => m.courseId === cursoIdSelecionado),
    [todosModulosDisponiveis, cursoIdSelecionado]
  );

  const cursosToggleOrdenados = React.useMemo(() => {
    const cursosGratuitos = cursosDisponiveis.filter((c) => c.isPaid !== true);
    if (turmasDisponiveis.length === 0) return cursosGratuitos;
    const cursoIdsPorTurma = new Set(
      turmasDisponiveis.filter((t) => t.tipo === "turma" && t.courseId).map((t) => t.courseId as string)
    );
    if (cursoIdsPorTurma.size === 0) return cursosGratuitos;
    return cursosGratuitos.filter((c) => cursoIdsPorTurma.has(c.id));
  }, [cursosDisponiveis, turmasDisponiveis]);

  const cursosToggleFiltrados = React.useMemo(() => {
    const termo = cursoCardsFiltro.trim().toLowerCase();
    if (!termo) return cursosToggleOrdenados;
    return cursosToggleOrdenados.filter((c) => {
      const nome = c.nome?.toLowerCase() ?? "";
      const desc = c.descricao?.toLowerCase() ?? "";
      return nome.includes(termo) || desc.includes(termo);
    });
  }, [cursosToggleOrdenados, cursoCardsFiltro]);

  const cursosCardsTotalPaginas = Math.max(1, Math.ceil(cursosToggleFiltrados.length / cursoCardsItensPorPagina));

  const cursosTogglePaginados = React.useMemo(() => {
    const inicio = (cursoCardsPagina - 1) * cursoCardsItensPorPagina;
    return cursosToggleFiltrados.slice(inicio, inicio + cursoCardsItensPorPagina);
  }, [cursosToggleFiltrados, cursoCardsPagina, cursoCardsItensPorPagina]);

  function clearFieldWarning(field: RequiredFieldKey) {
    setFieldWarnings((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSelecionarCurso(courseId: string) {
    clearFieldWarning("curso");
    clearFieldWarning("modulo");
    clearFieldWarning("fase");
    clearFieldWarning("ordem");
    const trocouCurso = courseId !== cursoIdSelecionado;
    if (trocouCurso) {
      setModuloIdSelecionado("");
      setModulosDisponiveis([]);
      setModuloSelecionadoCache(null);
      setModuloSelectBusca("");
      setModuloSelectPagina(1);
      setModuloSelectTotalPages(1);
      setFaseIdSelecionada("");
      setFasesDisponiveis([]);
      setFaseSelecionadaCache(null);
      setFaseSelectBusca("");
      setFaseSelectPagina(1);
      setFaseSelectTotalPages(1);
      setMostrarDetalhesCurso(false);
    }
    setCursoIdSelecionado(courseId);
    const curso = cursosDisponiveis.find((item) => item.id === courseId);
    if (!curso) return;
    const categoriaInferida = inferCategoriaFromCourseName(curso.nome);
    if (categoriaInferida !== categoria) {
      setCategoria(categoriaInferida);
      setComponenteInterativo("escrita");
    }
  }

  function collectRequiredFieldWarnings(params: {
    tituloFinal: string;
    descricaoFinal: string;
    moduloNome: string;
    phaseIdNum: number;
    courseIdNum: number;
  }) {
    const warnings: Partial<Record<RequiredFieldKey, string>> = {};
    const isInteractiveComponentInformatica = categoria === "informatica" && componenteInterativo !== "";
    if (!isInteractiveComponentInformatica && params.tituloFinal.length < 2) {
      warnings.titulo = "Titulo obrigatorio (minimo 2 caracteres).";
    }
    if (!isInteractiveComponentInformatica && params.descricaoFinal.length < 2) {
      warnings.descricao = "Descricao obrigatoria (minimo 2 caracteres).";
    }
    if (!Number.isFinite(params.courseIdNum) || params.courseIdNum <= 0) {
      warnings.curso = "Selecione um curso.";
    }
    if (!params.moduloNome) {
      warnings.modulo = "Selecione um modulo.";
    }
    if (!Number.isFinite(params.phaseIdNum) || params.phaseIdNum <= 0) {
      warnings.fase = "Selecione uma fase.";
    }
    if (!prazo) {
      warnings.prazo = "Prazo obrigatorio.";
    }
    if (componenteInterativo === "multipla" && multiplaQuestoes.some((q) => !q.respostaCorreta || q.opcoes.some((o) => !o.text))) {
      warnings.multipla = "Complete todas as opcoes e a resposta correta.";
    }
    return warnings;
  }

  function parseDifficultyValue(value: string) {
    const normalized = value.trim();
    if (!normalized) return null;

    const legacyMap: Record<string, number> = {
      normal: 1,
      lower: 2,
      prova_semanal: 3,
    };

    const mapped = legacyMap[normalized] ?? Number(normalized);
    if (!Number.isInteger(mapped) || mapped < 1) return null;
    return mapped;
  }

  function buildMultiplaQuestoesPayload(
    questoes: Array<{ pergunta: string; opcoes: Array<{ letter: string; text: string }>; respostaCorreta: string }>,
    perguntaBase: string
  ) {
    const fallbackPergunta = perguntaBase.trim();
    return questoes.map((questao, index) => ({
      ...questao,
      pergunta: fallbackPergunta || `Questão ${index + 1}`,
    }));
  }

  function resetForm() {
    setFieldWarnings({});
    setTitulo("");
    setDescricao("");
    setGabarito("");
    setCursoIdSelecionado("");
    setModuloIdSelecionado("");
    setModuloSelecionadoCache(null);
    setModuloSelectBusca("");
    setModuloSelectPagina(1);
    setModuloSelectTotalPages(1);
    setFaseIdSelecionada("");
    setMostrarDetalhesCurso(false);
    setPrazo("");
    setVideoUrl("");
    setDifficulty("");
    setIndexOrder("");
    setPointsRedeem("");
    setExercisePeriod("");
    setIsFinalExercise(false);
    setIsDailyTask(false);
    setCategoria("programacao");
    setComponenteInterativo("escrita");
    setMultiplaQuestoes(getDefaultMultiplaQuestoes());
    setAnexosAtivo(false);
    setAnexoArquivo(null);
  }

  async function ensureCreateDependenciesLoaded(force = false) {
    if (createDepsLoadingRef.current) return;
    if (createDepsLoadedRef.current && !force) return;
    createDepsLoadingRef.current = true;
    try {
      const [cursosResult, modulosResult, turmasResult] = await Promise.allSettled([
        listarCursos(),
        listarModulos(),
        listarTurmas(),
      ]);
      if (cursosResult.status === "fulfilled") {
        setCursosDisponiveis(normalizeListPayload<Curso>(cursosResult.value as Curso[] | { items?: Curso[] }));
        createDepsLoadedRef.current = true;
      }
      if (modulosResult.status === "fulfilled") {
        setTodosModulosDisponiveis(normalizeListPayload<Modulo>(modulosResult.value as Modulo[] | { items?: Modulo[] }));
      }
      if (turmasResult.status === "fulfilled") {
        const turmas = Array.isArray(turmasResult.value) ? turmasResult.value : (turmasResult.value as any)?.items ?? [];
        setTurmasDisponiveis(turmas);
      }
    } catch (e) {
      console.error("Erro ao carregar dependencias de criacao:", e);
    } finally {
      createDepsLoadingRef.current = false;
    }
  }

  React.useEffect(() => {
    void ensureCreateDependenciesLoaded();
  }, []);

  React.useEffect(() => {
    if (!cursoIdSelecionado) {
      setModulosDisponiveis([]);
      setModuloIdSelecionado("");
      setModuloSelecionadoCache(null);
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      return;
    }

    let ativo = true;
    setModuloSelectCarregando(true);

    listarModulosPorCurso(cursoIdSelecionado, {
      page: moduloSelectPagina,
      limit: 8,
      q: moduloSelectBusca || undefined,
    })
      .then((response) => {
        if (!ativo) return;

        const modulos = normalizeListPayload<Modulo>(response as Modulo[] | { items?: Modulo[] });
        setModulosDisponiveis(modulos);

        if (!Array.isArray(response)) {
          setModuloSelectTotalPages(response.pagination.totalPages);
        } else {
          setModuloSelectTotalPages(1);
        }

        if (modulos.length > 0) {
          setTodosModulosDisponiveis((prev) => {
            const map = new Map<string, Modulo>();
            prev.forEach((m) => map.set(m.id, m));
            modulos.forEach((m) => map.set(m.id, m));
            return Array.from(map.values());
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        if (ativo) setModuloSelectCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [cursoIdSelecionado, moduloSelectBusca, moduloSelectPagina]);

  React.useEffect(() => {
    const found = modulosDisponiveis.find((m) => m.id === moduloIdSelecionado) ?? null;
    if (found) {
      setModuloSelecionadoCache(found);
    }
  }, [moduloIdSelecionado, modulosDisponiveis]);

  React.useEffect(() => {
    if (!cursoSelecionado) return;
    const categoriaInferida = inferCategoriaFromCourseName(cursoSelecionado.nome);
    if (categoriaInferida !== categoria) {
      setCategoria(categoriaInferida);
      setComponenteInterativo("escrita");
    }
  }, [cursoSelecionado]);

  React.useEffect(() => { setCursoCardsPagina(1); }, [cursoCardsFiltro]);
  React.useEffect(() => { if (cursoCardsPagina > cursosCardsTotalPaginas) setCursoCardsPagina(cursosCardsTotalPaginas); }, [cursoCardsPagina, cursosCardsTotalPaginas]);

  React.useEffect(() => {
    if (!moduloIdSelecionado) {
      setFasesDisponiveis([]);
      setFaseIdSelecionada("");
      setFaseSelecionadaCache(null);
      setFaseSelectBusca("");
      setFaseSelectPagina(1);
      setFaseSelectTotalPages(1);
      return;
    }

    let ativo = true;
    setFaseSelectCarregando(true);

    listarFasesDoModulo(moduloIdSelecionado, {
      page: faseSelectPagina,
      limit: 8,
      q: faseSelectBusca || undefined,
    })
      .then((response) => {
        if (!ativo) return;

        if (Array.isArray(response)) {
          setFasesDisponiveis(response);
          setFaseSelectTotalPages(1);
          setFaseIdSelecionada((prev) => (prev && response.some((f) => f.id === prev) ? prev : prev));
          return;
        }

        setFasesDisponiveis(response.items);
        setFaseSelectTotalPages(response.pagination.totalPages);
        setFaseIdSelecionada((prev) => (prev && response.items.some((f) => f.id === prev) ? prev : prev));
      })
      .catch(console.error)
      .finally(() => {
        if (ativo) setFaseSelectCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [faseSelectBusca, faseSelectPagina, moduloIdSelecionado]);

  React.useEffect(() => {
    const found = fasesDisponiveis.find((f) => f.id === faseIdSelecionada) ?? null;
    if (found) {
      setFaseSelecionadaCache(found);
    }
  }, [fasesDisponiveis, faseIdSelecionada]);

  async function handleSubmit() {
    try {
      setSaving(true);
      setErro(null);

      const gabaritoLimpo = gabarito.trim();
      const descricaoFinal = descricao.trim();
      const tituloFinal = titulo.trim();
      const tipoSelecionado: "escrita" | "multipla" = componenteInterativo === "multipla" ? "multipla" : "escrita";
      const dificuldadeNum = parseDifficultyValue(difficulty);
      const ordemNum = indexOrder.trim() ? Number(indexOrder) : null;
      const pontosNum = pointsRedeem.trim() ? Number(pointsRedeem) : null;
      const videoUrlLimpa = videoUrl.trim();
      const courseIdNum = Number(cursoIdSelecionado);
      const phaseIdNum = Number(faseIdSelecionada);

      if (indexOrder.trim() && (!Number.isInteger(ordemNum) || Number(ordemNum) < 1)) {
        setErro("Ordem deve ser um numero inteiro maior ou igual a 1.");
        setSaving(false);
        return;
      }
      if (pointsRedeem.trim() && (!Number.isInteger(pontosNum) || Number(pontosNum) < 0)) {
        setErro("Pontos deve ser um numero inteiro maior ou igual a 0.");
        setSaving(false);
        return;
      }
      if (videoUrlLimpa) {
        try { new URL(videoUrlLimpa); } catch { setErro("Video URL invalida."); setSaving(false); return; }
      }
      if (difficulty.trim() && dificuldadeNum === null) {
        setErro("Selecione uma dificuldade valida.");
        setSaving(false);
        return;
      }

      const moduloNome = moduloSelecionado?.nome?.trim() ?? "";
      const faseNome = faseSelecionada?.nome?.trim() ?? null;
      const requiredWarnings = collectRequiredFieldWarnings({ tituloFinal, descricaoFinal, moduloNome, phaseIdNum, courseIdNum });

      if (Object.keys(requiredWarnings).length > 0) {
        setFieldWarnings(requiredWarnings);
        setErro("Preencha os campos obrigatorios em destaque.");
        setSaving(false);
        return;
      }
      setFieldWarnings({});

      const dados: Record<string, unknown> = {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        phase_id: phaseIdNum,
        course_id: courseIdNum,
        modulo: moduloNome,
        tema: faseNome,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        video_url: videoUrlLimpa || null,
        difficulty: dificuldadeNum,
        index_order: ordemNum,
        is_final_exercise: isFinalExercise,
        is_daily_task: isDailyTask,
        points_redeem: pontosNum,
        exercise_period: exercisePeriod ? new Date(exercisePeriod).toISOString() : null,
        publicado: true,
        published_at: null,
        categoria,
        ...(gabaritoLimpo && categoria === "programacao" ? { gabarito: gabaritoLimpo } : {}),
        ...(tipoSelecionado ? { tipoExercicio: tipoSelecionado } : {}),
        ...(componenteInterativo === "multipla" ? { multipla_regras: JSON.stringify({ Questoes: buildMultiplaQuestoesPayload(multiplaQuestoes, descricaoFinal) }) } : {}),
        permitir_repeticao: false,
        max_tentativas: null,
        penalidade_por_tentativa: 0,
        intervalo_reenvio: null,
      };

      const created = await criarExercicio(dados as any);
      const exercicioId = (created as any)?.exercicio?.id ?? null;
      addToast("Exercicio criado!", "success", 3000);

      if (exercicioId && anexosAtivo && anexoArquivo) {
        await anexarExercicioArquivo(exercicioId, anexoArquivo);
      }

      resetForm();
      onCreated?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar Exercicio";
      if (message.toLowerCase().includes("index disponivel") || message.toLowerCase().includes("menor ordem")) {
        setFieldWarnings((prev) => ({ ...prev, ordem: message }));
      }
      setErro(message);
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || !titulo.trim() || !cursoIdSelecionado || !moduloIdSelecionado || !faseIdSelecionada || !prazo;

  return (
    <div className="estruturaCard" style={{ gridColumn: "1 / -1" }}>
      <AnimatedToast message={erro} type="error" duration={4000} onClose={() => setErro(null)} />

      <FadeInUp duration={0.28}>
        <div className="createExerciseCard">
          <h2 className="exFormTitle">Criar novo exercicio</h2>

          <div className="exFormGrid">
            <div className="exInputGroup">
              <span className="exLabel">Nome do exercício *</span>
              <input
                className={`exInput ${fieldWarnings.titulo ? "isWarning" : ""}`}
                placeholder="ex: Exercicio 15.3: Layout Responsivo"
                value={titulo}
                onChange={(e) => { setTitulo(e.target.value); clearFieldWarning("titulo"); }}
              />
              {fieldWarnings.titulo && <small className="exFieldWarning">{fieldWarnings.titulo}</small>}
            </div>

            <div className="exInputGroup">
              <span className="exLabel">Pergunta *</span>
              <textarea
                className={`exTextarea ${fieldWarnings.descricao ? "isWarning" : ""}`}
                placeholder="Descreva a pergunta do exercício em detalhes..."
                value={descricao}
                onChange={(e) => { setDescricao(e.target.value); clearFieldWarning("descricao"); }}
              />
              {fieldWarnings.descricao && <small className="exFieldWarning">{fieldWarnings.descricao}</small>}
            </div>

            {/* TIPO DE EXERCICIO - Programacao */}
            {categoria === "programacao" && (
              <>
                <div className="exInputGroup">
                  <span className="exLabel">Tipo de Exercicio</span>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                    <AnimatedRadioLabel name="tipoExCriar" value="escrita" checked={componenteInterativo === "escrita"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Escrita" icon={<PenLine size={14} />} />
                    <AnimatedRadioLabel name="tipoExCriar" value="multipla" checked={componenteInterativo === "multipla"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Multipla Escolha" icon={<ListChecks size={14} />} />
                  </div>
                </div>

                {componenteInterativo === "multipla" && (
                  <ScaleIn>
                    <>
                      <div style={{ background: "var(--background-secondary)", border: "1px solid #fcd34d", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", margin: "0 0 12px 0" }}>
                          {iconLabel(<ListChecks size={14} />, "Configurar Questoes de Multipla Escolha:")}
                        </p>
                        {multiplaQuestoes.map((questao, qIndex) => (
                          <div key={`prog-q-${qIndex}`} style={{ background: "var(--card)", padding: "12px", borderRadius: "6px", marginBottom: "12px", border: "1px solid #fde68a" }}>
                            <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>Questao {qIndex + 1}</h4>
                            <div style={{ marginBottom: "8px" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Opcoes:</span>
                              {questao.opcoes.map((opcao, oIndex) => (
                                <input key={`prog-op-${qIndex}-${opcao.letter}`} className="exInput" type="text" value={opcao.text} onChange={(e) => { const n = [...multiplaQuestoes]; n[qIndex].opcoes[oIndex].text = e.target.value; setMultiplaQuestoes(n); }} placeholder={`Opcao ${opcao.letter}`} style={{ marginBottom: "6px" }} />
                              ))}
                            </div>
                            <div style={{ marginBottom: "8px" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Resposta Correta:</span>
                              <AnimatedSelect className="exSelect" value={questao.respostaCorreta} onChange={(e) => { const n = [...multiplaQuestoes]; n[qIndex].respostaCorreta = e.target.value; setMultiplaQuestoes(n); }}>
                                <option value="">-- Selecione --</option>
                                {questao.opcoes.map((o) => (<option key={o.letter} value={o.letter}>{o.letter}: {o.text}</option>))}
                              </AnimatedSelect>
                            </div>
                            {multiplaQuestoes.length > 1 && (
                              <button type="button" onClick={() => setMultiplaQuestoes(multiplaQuestoes.filter((_, i) => i !== qIndex))} style={{ padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                                {iconLabel(<Trash2 size={14} />, "Remover Questao")}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ background: "var(--background-secondary)", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px", marginTop: "12px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: "0 0 12px 0" }}>{iconLabel(<Eye size={14} />, "Pre-visualizacao:")}</p>
                        {multiplaQuestoes.map((questao, idx) => (
                          <div key={`preview-${idx}`} style={{ marginBottom: "16px" }}>
                            <MultipleChoiceQuestion question={`Q${idx + 1}: ${descricao.trim() || "Enunciado do exercício"}`} options={questao.opcoes} selectedAnswer="" onAnswer={() => {}} />
                          </div>
                        ))}
                      </div>
                    </>
                  </ScaleIn>
                )}
                {fieldWarnings.multipla && <small className="exFieldWarning">{fieldWarnings.multipla}</small>}
              </>
            )}

            {/* TIPO DE EXERCICIO - Informatica */}
            {categoria === "informatica" && (
              <>
                <div className="exInputGroup">
                  <span className="exLabel">Componente Interativo</span>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                    <AnimatedRadioLabel name="compInfoCriar" value="escrita" checked={componenteInterativo === "escrita"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Escrita" icon={<PenLine size={14} />} />
                    <AnimatedRadioLabel name="compInfoCriar" value="multipla" checked={componenteInterativo === "multipla"} onChange={(e) => setComponenteInterativo(e.target.value)} label="Multipla Escolha" icon={<ListChecks size={14} />} />
                  </div>
                </div>
                <ConditionalFieldAnimation isVisible={componenteInterativo === "multipla"}>
                  <div style={{ background: "#f9fafb", border: "2px dashed #e5e7eb", borderRadius: "12px", padding: "20px", marginTop: "16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 0, marginBottom: "16px" }}>
                      {iconLabel(<ListChecks size={14} />, "Criar Questoes")} ({multiplaQuestoes.length})
                    </p>
                    {multiplaQuestoes.map((questao, qIndex) => (
                      <div key={`info-q-${qIndex}`} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                        <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1f2937" }}>Questao {qIndex + 1}</h4>
                        {questao.opcoes.map((opcao, oIndex) => (
                          <div key={`info-op-${qIndex}-${opcao.letter}`} style={{ marginBottom: "12px" }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>Opcao {opcao.letter}</label>
                            <input type="text" placeholder={`Digite a Opcao ${opcao.letter}...`} value={opcao.text} onChange={(e) => { const n = [...multiplaQuestoes]; n[qIndex].opcoes[oIndex].text = e.target.value; setMultiplaQuestoes(n); }} style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                        ))}
                        <div style={{ marginBottom: "12px" }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 0, marginBottom: "8px" }}>Resposta Correta:</p>
                          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                            {questao.opcoes.map((opcao) => (
                              <label key={opcao.letter} style={{ display: "flex", alignItems: "center", fontSize: "14px", cursor: "pointer" }}>
                                <input type="radio" name={`respostaCorreta_criar_${qIndex}`} value={opcao.letter} checked={questao.respostaCorreta === opcao.letter} onChange={(e) => { const n = [...multiplaQuestoes]; n[qIndex].respostaCorreta = e.target.value; setMultiplaQuestoes(n); }} style={{ marginRight: "6px", cursor: "pointer" }} />
                                {opcao.letter}
                              </label>
                            ))}
                          </div>
                        </div>
                        {multiplaQuestoes.length > 1 && (
                          <button type="button" onClick={() => setMultiplaQuestoes(multiplaQuestoes.filter((_, i) => i !== qIndex))} style={{ padding: "6px 12px", background: "#fecaca", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
                            {iconLabel(<Trash2 size={14} />, "Remover Questao")}
                          </button>
                        )}
                      </div>
                    ))}
                    {multiplaQuestoes.length > 0 && descricao.trim() && (
                      <div style={{ background: "var(--card)", border: "2px solid var(--line)", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0c4a6e", marginTop: 0, marginBottom: "12px" }}>{iconLabel(<Eye size={14} />, "PREVIEW - Como o aluno vai ver:")}</p>
                        <MultipleChoiceQuestion question={`Q1: ${descricao.trim()}`} options={multiplaQuestoes[0].opcoes} onAnswer={() => {}} />
                      </div>
                    )}
                  </div>
                </ConditionalFieldAnimation>
              </>
            )}

            {/* CURSO / MODULO / FASE / PRAZO */}
            <div className="exInputRow">
              <div className="exInputGroup">
                <span className="exLabel">Curso *</span>
                <div className="exCoursesFilterRow">
                  <input
                    className="exInput"
                    value={cursoCardsFiltro}
                    onChange={(e) => setCursoCardsFiltro(e.target.value)}
                    placeholder="Filtrar cursos por nome ou descrição"
                  />
                  {cursoCardsFiltro.trim() && (
                    <button type="button" className="exCoursesFilterClearBtn" onClick={() => setCursoCardsFiltro("")}>
                      Limpar
                    </button>
                  )}
                </div>
                <div className={`exToggleGroup ${fieldWarnings.curso ? "isWarning" : ""}`}>
                  {cursosTogglePaginados.map((curso) => {
                    const cursoCategoria = inferCategoriaFromCourseName(curso.nome);
                    const isAtivo = curso.id === cursoIdSelecionado;
                    return (
                      <label key={curso.id} className={`exToggleOption ${isAtivo ? "active" : ""}`}>
                        <input
                          className="exToggleInput"
                          type="radio"
                          name="course_id_criar"
                          value={curso.id}
                          checked={isAtivo}
                          onChange={() => handleSelecionarCurso(curso.id)}
                        />
                        <span className="exToggleDot" aria-hidden="true" />
                        <span className="exToggleLabel">
                          {iconLabel(cursoCategoria === "informatica" ? <Monitor size={14} /> : <Laptop size={14} />, curso.nome)}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {fieldWarnings.curso && <small className="exFieldWarning">{fieldWarnings.curso}</small>}
                <div className="exCourseCardsActions">
                  <div className={`exCourseCardsSelected ${cursoSelecionado ? "" : "isEmpty"}`}>
                    <span className="exCourseCardsSelectedLabel">
                      {iconLabel(<BookOpen size={13} />, cursoSelecionado ? "Curso selecionado" : "Selecao de curso")}
                    </span>
                    <strong className="exCourseCardsSelectedValue">
                      {cursoSelecionado ? cursoSelecionado.nome : "Selecione um curso para ver detalhes"}
                    </strong>
                  </div>
                  <button type="button" className="exCourseDetailsBtn" onClick={() => setMostrarDetalhesCurso((prev) => !prev)} disabled={!cursoSelecionado}>
                    {iconLabel(<Eye size={14} />, mostrarDetalhesCurso ? "Ocultar detalhes" : "Ver detalhes")}
                  </button>
                </div>
                {cursosToggleFiltrados.length === 0 && (
                  <small style={{ color: "#94a3b8", marginTop: "6px" }}>Nenhum curso encontrado no banco.</small>
                )}
                <Pagination
                  currentPage={cursoCardsPagina}
                  itemsPerPage={cursoCardsItensPorPagina}
                  totalItems={cursosToggleFiltrados.length}
                  onPageChange={setCursoCardsPagina}
                  onItemsPerPageChange={setCursoCardsItensPorPagina}
                />
                <ConditionalFieldAnimation isVisible={Boolean(cursoSelecionado && mostrarDetalhesCurso)}>
                  <div className="exCourseDetailsPanel">
                    <div className="exCourseDetailsGrid">
                      <div className="exCourseDetailItem">
                        <small>Categoria</small>
                        <strong>{inferCategoriaFromCourseName(cursoSelecionado?.nome) === "informatica" ? "Informática" : "Programação"}</strong>
                      </div>
                      <div className="exCourseDetailItem">
                        <small>Modelo</small>
                        <strong>{cursoSelecionado?.isPaid ? "Pago" : "Gratuito"}</strong>
                      </div>
                      <div className="exCourseDetailItem">
                        <small>Módulos cadastrados</small>
                        <strong>{modulosDoCursoSelecionado.length}</strong>
                      </div>
                      <div className="exCourseDetailItem">
                        <small>ID do curso</small>
                        <strong>{cursoSelecionado?.id}</strong>
                      </div>
                    </div>
                    {cursoSelecionado?.descricao && <p className="exCourseDescription">{cursoSelecionado.descricao}</p>}
                    {modulosDoCursoSelecionado.length > 0 && (
                      <div className="exCourseModulesPreview">
                        <small>Trilha de modulos</small>
                        <div className="exCourseModulesChips">
                          {modulosDoCursoSelecionado.slice(0, 5).map((m) => (
                            <span key={m.id} className="exCourseModuleChip">{m.nome}</span>
                          ))}
                          {modulosDoCursoSelecionado.length > 5 && (
                            <span className="exCourseModuleChip isMore">+{modulosDoCursoSelecionado.length - 5} modulos</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ConditionalFieldAnimation>
              </div>
            </div>

            <div className="exInputRow">
              <div className="exInputGroup">
                <span className="exLabel">Modulo *</span>
                <div className={`exFieldWarnWrap ${fieldWarnings.modulo ? "isWarning" : ""}`}>
                  <PaginatedSelect
                    value={moduloIdSelecionado}
                    onChange={(value) => {
                      setModuloIdSelecionado(value);
                      const found = modulosDisponiveis.find((m) => m.id === value) ?? null;
                      if (found) setModuloSelecionadoCache(found);
                      setFaseIdSelecionada("");
                      clearFieldWarning("modulo");
                      clearFieldWarning("fase");
                      clearFieldWarning("ordem");
                    }}
                    options={modulosDisponiveis.map((m) => ({ value: m.id, label: m.nome, meta: m.indexOrder ? `Ordem #${m.indexOrder}` : undefined }))}
                    selectedOption={moduloSelecionado ? {
                      value: moduloSelecionado.id,
                      label: moduloSelecionado.nome,
                      meta: moduloSelecionado.indexOrder ? `Ordem #${moduloSelecionado.indexOrder}` : undefined,
                    } : null}
                    placeholder={cursoIdSelecionado ? "Selecione um modulo" : "Selecione um curso primeiro"}
                    disabled={!cursoIdSelecionado}
                    allowPageSizeChange={false}
                    emptyText="Nenhum modulo encontrado"
                    remote={{
                      query: moduloSelectBusca,
                      onQueryChange: setModuloSelectBusca,
                      page: moduloSelectPagina,
                      totalPages: moduloSelectTotalPages,
                      onPageChange: setModuloSelectPagina,
                      loading: moduloSelectCarregando,
                    }}
                  />
                </div>
                {fieldWarnings.modulo && <small className="exFieldWarning">{fieldWarnings.modulo}</small>}
              </div>

              <div className="exInputGroup">
                <span className="exLabel">Fase *</span>
                <div className={`exFieldWarnWrap ${fieldWarnings.fase ? "isWarning" : ""}`}>
                  <PaginatedSelect
                    value={faseIdSelecionada}
                    onChange={(value) => {
                      setFaseIdSelecionada(value);
                      const found = fasesDisponiveis.find((f) => f.id === value) ?? null;
                      if (found) setFaseSelecionadaCache(found);
                      clearFieldWarning("fase");
                      clearFieldWarning("ordem");
                    }}
                    options={fasesDisponiveis.map((f) => ({ value: f.id, label: f.nome, meta: `Semana ${f.weekNumber}` }))}
                    selectedOption={faseSelecionada ? {
                      value: faseSelecionada.id,
                      label: faseSelecionada.nome,
                      meta: `Semana ${faseSelecionada.weekNumber}`,
                    } : null}
                    placeholder={moduloIdSelecionado ? "Selecione uma fase" : "Selecione um modulo primeiro"}
                    disabled={!moduloIdSelecionado}
                    allowPageSizeChange={false}
                    emptyText="Nenhuma fase encontrada"
                    remote={{
                      query: faseSelectBusca,
                      onQueryChange: setFaseSelectBusca,
                      page: faseSelectPagina,
                      totalPages: faseSelectTotalPages,
                      onPageChange: setFaseSelectPagina,
                      loading: faseSelectCarregando,
                    }}
                  />
                </div>
                {fieldWarnings.fase && <small className="exFieldWarning">{fieldWarnings.fase}</small>}
              </div>

              <div className="exInputGroup">
                <span className="exLabel">Prazo *</span>
                <input className={`exInput ${fieldWarnings.prazo ? "isWarning" : ""}`} type="datetime-local" value={prazo} onChange={(e) => { setPrazo(e.target.value); clearFieldWarning("prazo"); }} />
                {fieldWarnings.prazo && <small className="exFieldWarning">{fieldWarnings.prazo}</small>}
              </div>
            </div>

            <div className="exInputRow">
              <div className="exInputGroup">
                <span className="exLabel">Video URL</span>
                <input className="exInput" type="url" placeholder="https://..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                <small style={{ color: "#666", marginTop: "4px" }}>Link opcional de apoio para este exercicio.</small>
              </div>
              <div className="exInputGroup">
                <span className="exLabel">Dificuldade</span>
                <AnimatedSelect className="exSelect" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="1">Normal</option>
                  <option value="2">Lower (Recuperação)</option>
                  <option value="3">Prova Semanal</option>
                </AnimatedSelect>
              </div>
            </div>

            <div className="exInputRow">
              <div className="exInputGroup">
                <span className="exLabel">Pontos de resgate</span>
                <input className="exInput" type="number" min="0" placeholder="0" value={pointsRedeem} onChange={(e) => setPointsRedeem(e.target.value)} />
              </div>
              <div className="exInputGroup">
                <span className="exLabel">Periodo do exercicio</span>
                <input className="exInput" type="datetime-local" value={exercisePeriod} onChange={(e) => setExercisePeriod(e.target.value)} />
              </div>
            </div>

            <div className="exInputRow">
              <div className="exInputGroup">
                <div
                  className={`exStatusToggle ${isFinalExercise ? "isActive" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsFinalExercise(!isFinalExercise)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsFinalExercise(!isFinalExercise);
                    }
                  }}
                >
                  <AnimatedToggle checked={isFinalExercise} onChange={setIsFinalExercise} />
                  <span className="exStatusToggleContent">
                    <span className="exStatusToggleTitle">Exercicio final</span>
                    <span className="exStatusToggleDescription">Marque se este for o exercicio de fechamento da fase.</span>
                  </span>
                </div>
              </div>
              <div className="exInputGroup">
                <div
                  className={`exStatusToggle ${isDailyTask ? "isActive" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsDailyTask(!isDailyTask)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsDailyTask(!isDailyTask);
                    }
                  }}
                >
                  <AnimatedToggle checked={isDailyTask} onChange={setIsDailyTask} />
                  <span className="exStatusToggleContent">
                    <span className="exStatusToggleTitle">Tarefas diárias</span>
                    <span className="exStatusToggleDescription">Mostra este exercicio na aba de tarefa diaria.</span>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <AnimatedButton className="exSubmitBtn" onClick={handleSubmit} disabled={disabled} loading={saving} style={{ flex: 1 }}>
                {iconLabel(<Sparkles size={16} />, "Publicar Exercicio")}
              </AnimatedButton>
            </div>

            <div className="exFormnaote">
              {iconLabel(<Lightbulb size={16} />, "Exercicios podem ser publicados para turmas, alunos especificos ou para todos.")}
            </div>
          </div>
        </div>
      </FadeInUp>
    </div>
  );
}
