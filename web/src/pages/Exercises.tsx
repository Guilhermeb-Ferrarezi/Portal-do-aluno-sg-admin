import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination";
import MonacoEditor from "../components/MonacoEditor";
import MouseInteractiveBox from "../components/Exercise/MouseInteractiveBox";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
import { ScaleIn, AnimatedRadioLabel, AnimatedButton, AnimatedToast, ConditionalFieldAnimation, AnimatedSelect, FadeInUp, AnimatedToggle } from "../components/animate-ui";
import { criarExercicio, atualizarExercicio, deletarExercicio, listarExercicios, listarTurmas, listarAlunos, getRole, type Exercicio, type Turma, type User } from "../services/api";
import "./Exercises.css";

export default function ExerciciosPage() {
  const navigate = useNavigate();
  const role = getRole() ?? "aluno";
  const canCreate = role === "admin" || role === "professor";
  const canManageTemplates = role === "admin";

  const [items, setItems] = React.useState<Exercicio[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // form
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [gabarito, setGabarito] = React.useState("");
  const gabaritoLang = "javascript"; // Linguagem padrão, não editável
  const [modulo, setModulo] = React.useState("");
  const [tema, setTema] = React.useState("");
  const [prazo, setPrazo] = React.useState(""); // datetime-local
  const [publishNow, setPublishNow] = React.useState(true); // Publicar agora ou agendar
  const [publishedAt, setPublishedAt] = React.useState(""); // datetime-local
  const [isTemplate, setIsTemplate] = React.useState(false); // Template ou Atividade Normal

  // Quando marca como template, forçar publicação imediata
  React.useEffect(() => {
    if (isTemplate && !publishNow) {
      setPublishNow(true);
    }
  }, [isTemplate, publishNow]);
  const [categoria, setCategoria] = React.useState("programacao"); // programacao ou informatica
  const [componenteInterativo, setComponenteInterativo] = React.useState("nenhum"); // nenhum, mouse, multipla, escrita, ou código
  const [diaNumero, setDiaNumero] = React.useState(1); // Número do dia para componentes interativos
  // Regras para Mouse Interativo
  const [mouseRegras, setMouseRegras] = React.useState({
    clicksSimples: 0,
    duplosClicks: 0,
    clicksDireitos: 0,
  });
  // Regras para Múltipla Escolha
  const [multiplaQuestoes, setMultiplaQuestoes] = React.useState<Array<{
    pergunta: string;
    opcoes: Array<{ letter: string; text: string }>;
    respostaCorreta: string;
  }>>([{
    pergunta: "",
    opcoes: [
      { letter: "A", text: "" },
      { letter: "B", text: "" },
      { letter: "C", text: "" },
      { letter: "D", text: "" }
    ],
    respostaCorreta: ""
  }]);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [modoAtribuicao, setModoAtribuicao] = React.useState<"turma" | "aluno">("turma");
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);

  // Filtros
  const [moduloFiltro, setModuloFiltro] = React.useState("");
  const [tipoFiltro, setTipoFiltro] = React.useState(""); // codigo, texto, todas
  const [buscaFiltro, setBuscaFiltro] = React.useState("");

  // Turmas
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [turmaFiltro, setTurmaFiltro] = React.useState("todas");

  // Alunos
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunoFiltro, setAlunoFiltro] = React.useState("");

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);


  // Modal de confirmação
  const [modalDeletar, setModalDeletar] = React.useState<{
    isOpen: boolean;
    exercicioId: string | null;
    exercicioTitulo: string | null;
  }>({ isOpen: false, exercicioId: null, exercicioTitulo: null });

  async function load() {
    try {
      setLoading(true);
      setErro(null);
      const data = await listarExercicios();
      setItems(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar exercícios");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();

    // Carregar turmas e alunos disponíveis se for professor/admin
    if (canCreate) {
      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((e) => console.error("Erro ao carregar turmas:", e));

      listarAlunos()
        .then(setAlunosDisponiveis)
        .catch((e) => console.error("Erro ao carregar alunos:", e));
    }
  }, []);

  async function handleSubmit() {
    try {
      setSaving(true);
      setErro(null);
      setOkMsg(null);

      const gabaritoLimpo = gabarito.trim();

      // Auto-gerar descrição se for componente interativo em Informática
      let descricaoFinal = descricao.trim();
      let tituloFinal = titulo.trim();

      // Apenas auto-gerar títulos para Informática (Programação usa títulos customizados)
      if (categoria === "informatica" && componenteInterativo) {
        let nomeComponente = "";
        if (componenteInterativo === "mouse") {
          nomeComponente = "Mouse";
        } else if (componenteInterativo === "multipla") {
          nomeComponente = "Pergunta Múltipla";
        }

        tituloFinal = `Dia ${diaNumero}: ${nomeComponente}`;
        descricaoFinal = `Dia ${diaNumero}: ${nomeComponente}`;
      }

      const dados: any = {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        modulo: modulo.trim(),
        tema: tema.trim() ? tema.trim() : null,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        publicado: publishNow,
        published_at: publishNow ? null : (publishedAt ? new Date(publishedAt).toISOString() : null),
        is_template: isTemplate,
        categoria: categoria,
        ...(gabaritoLimpo && categoria === "programacao" ? { gabarito: gabaritoLimpo } : {}),
        // Adicionar regras do mouse se for componente interativo
        ...(componenteInterativo === "mouse" ? {
          mouse_regras: JSON.stringify(mouseRegras)
        } : {}),
        // Adicionar regras de múltipla escolha se for componente interativo
        ...(componenteInterativo === "multipla" ? {
          multipla_regras: JSON.stringify({ questoes: multiplaQuestoes })
        } : {}),
      };

      if (modoAtribuicao === "turma" && turmasSelecionadas.length > 0) {
        dados.turma_ids = turmasSelecionadas;
      } else if (modoAtribuicao === "aluno" && alunosSelecionados.length > 0) {
        dados.aluno_ids = alunosSelecionados;
      }

      if (editandoId) {
        // Atualizar exercício existente
        await atualizarExercicio(editandoId, dados);
        setOkMsg("Exercício atualizado!");
        setEditandoId(null);
      } else {
        // Criar novo exercício
        await criarExercicio(dados);
        setOkMsg("Exercício criado!");
      }

      setTitulo("");
      setDescricao("");
      setGabarito("");
      setModulo("");
      setTema("");
      setPrazo("");
      setPublishNow(true);
      setPublishedAt("");
      setIsTemplate(false);
      setCategoria("programacao");
      setComponenteInterativo("");
      setDiaNumero(1);
      setMouseRegras({ clicksSimples: 0, duplosClicks: 0, clicksDireitos: 0 });
      setTurmasSelecionadas([]);
      setAlunosSelecionados([]);
      setModoAtribuicao("turma");
      setMultiplaQuestoes([{
        pergunta: "",
        opcoes: [
          { letter: "A", text: "" },
          { letter: "B", text: "" },
          { letter: "C", text: "" },
          { letter: "D", text: "" }
        ],
        respostaCorreta: ""
      }]);
      setTurmasSelecionadas([]);

      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar exercício");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(exercicio: Exercicio) {
    setTitulo(exercicio.titulo);
    setDescricao(exercicio.descricao);
    setGabarito("");
    setModulo(exercicio.modulo);
    setTema(exercicio.tema || "");
    setIsTemplate(exercicio.is_template || false);

    // Converter data de ISO para formato datetime-local
    if (exercicio.prazo) {
      const date = new Date(exercicio.prazo);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setPrazo(`${year}-${month}-${day}T${hours}:${minutes}`);
    }

    // Carregar turmas do exercício se existirem
    if (exercicio.turmas) {
      setTurmasSelecionadas(exercicio.turmas.map((t) => t.id));
    } else {
      setTurmasSelecionadas([]);
    }

    // Restaurar categoria
    setCategoria(exercicio.categoria || "programacao");

    // Restaurar componente interativo baseado em regras
    if (exercicio.mouse_regras) {
      setComponenteInterativo("mouse");
      try {
        const regras = JSON.parse(exercicio.mouse_regras);
        setMouseRegras(regras);
      } catch (e) {
        console.error("Erro ao parsear mouse_regras:", e);
        setComponenteInterativo("");
      }
    } else if (exercicio.multipla_regras) {
      setComponenteInterativo("multipla");
      try {
        const regras = JSON.parse(exercicio.multipla_regras);
        setMultiplaQuestoes(regras.questoes || []);
      } catch (e) {
        console.error("Erro ao parsear multipla_regras:", e);
        setComponenteInterativo("");
      }
    } else {
      setComponenteInterativo("");
    }

    // Restaurar diaNumero do título (se aplicável)
    const diaMatch = exercicio.titulo.match(/^Dia (\d+):/);
    if (diaMatch) {
      setDiaNumero(parseInt(diaMatch[1], 10));
    } else {
      setDiaNumero(1);
    }

    setEditandoId(exercicio.id);
    setOkMsg(null);
    setErro(null);

    // Scroll até o formulário
    setTimeout(() => {
      const formElement = document.querySelector(".createExerciseCard");
      formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleCancel() {
    setTitulo("");
    setDescricao("");
    setGabarito("");
    setModulo("");
    setTema("");
    setPrazo("");
    setIsTemplate(false);
    setCategoria("programacao");
    setComponenteInterativo("");
    setDiaNumero(1);
    setMouseRegras({ clicksSimples: 0, duplosClicks: 0, clicksDireitos: 0 });
    setMultiplaQuestoes([{
      pergunta: "",
      opcoes: [
        { letter: "A", text: "" },
        { letter: "B", text: "" },
        { letter: "C", text: "" },
        { letter: "D", text: "" }
      ],
      respostaCorreta: ""
    }]);
    setTurmasSelecionadas([]);
    setEditandoId(null);
    setOkMsg(null);
  }

  function abrirModalDeletar(id: string, titulo: string) {
    setModalDeletar({ isOpen: true, exercicioId: id, exercicioTitulo: titulo });
  }

  function fecharModalDeletar() {
    setModalDeletar({ isOpen: false, exercicioId: null, exercicioTitulo: null });
  }

  async function confirmarDeletar() {
    if (!modalDeletar.exercicioId) return;

    try {
      setSaving(true);
      setErro(null);
      setOkMsg(null);

      await deletarExercicio(modalDeletar.exercicioId);
      setOkMsg("Exercício deletado com sucesso!");

      fecharModalDeletar();
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao deletar exercício");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    // Função mantida para compatibilidade, mas agora abre o modal
    const exercicio = items.find((ex) => ex.id === id);
    abrirModalDeletar(id, exercicio?.titulo || "Exercício");
  }

  // Validação especial para componentes interativos
  const isInteractiveComponentInformatica = categoria === "informatica" && componenteInterativo !== "";
  const disabled =
    saving ||
    componenteInterativo === "nenhum" || // Tipo "Nenhum" não pode ser publicado
    modulo.trim().length < 1 ||
    (!isInteractiveComponentInformatica && titulo.trim().length < 2) ||
    (!isInteractiveComponentInformatica && descricao.trim().length < 2) ||
    (componenteInterativo === "multipla" && multiplaQuestoes.some(q => !q.pergunta || !q.respostaCorreta || q.opcoes.some(o => !o.text)));

  return (
    <DashboardLayout title="Exercícios" subtitle="Veja e pratique os exercícios disponíveis">
      <div className="exercisesContainer">
        {/* HEADER COM BOTÃO */}
        <div className="exercisesHeader">
          <div className="headerActions">
            {canManageTemplates && (
              <button
                className="templateScheduleBtn"
                onClick={() => navigate("/dashboard/templates")}
              >
                Cronograma (Templates)
              </button>
            )}
          </div>
          <button className="refreshBtn" onClick={load} disabled={loading}>
            {loading ? "⏳ Carregando..." : "🔄 Atualizar"}
          </button>
        </div>

        {/* MENSAGENS */}
        {erro && (
          <div className="exMessage error">
            <span>❌</span>
            <span>{erro}</span>
          </div>
        )}

        <AnimatedToast
          message={okMsg}
          type="success"
          duration={3000}
          onClose={() => setOkMsg(null)}
        />

        {!canCreate && (
          <div className="exMessage warning">
            <span>🔒</span>
            <div>
              <div style={{ fontWeight: 700 }}>Você não tem permissão para criar exercícios</div>
              <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>
                Apenas professores e administradores podem criar exercícios.
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO DE CRIAR */}
        {canCreate && (
          <FadeInUp duration={0.28}>
          <div className="createExerciseCard">
            <h2 className="exFormTitle">Criar novo exercício</h2>

            <div className="exFormGrid">
              <div className="exInputGroup">
                <label className="exLabel">Título *</label>
                <input
                  className="exInput"
                  placeholder="ex: Exercício 15.3: Layout Responsivo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div className="exInputGroup">
                <label className="exLabel">Descrição *</label>
                <textarea
                  className="exTextarea"
                  placeholder="Descreva o exercício em detalhes..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  disabled={categoria === "informatica" && componenteInterativo !== ""}
                />
              </div>

              {/* CATEGORIA - PROGRAMAÇÃO vs INFORMATICA */}
              <div className="exInputRow">
                <div className="exInputGroup">
                  <label className="exLabel" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="categoria"
                      value="programacao"
                      checked={categoria === "programacao"}
                      onChange={(e) => {
                        setCategoria(e.target.value as any);
                        setComponenteInterativo("");
                      }}
                      style={{ marginRight: "8px", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 600 }}>💻 Programação</span>
                  </label>
                </div>

                <div className="exInputGroup">
                  <label className="exLabel" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="categoria"
                      value="informatica"
                      checked={categoria === "informatica"}
                      onChange={(e) => {
                        setCategoria(e.target.value as any);
                        setComponenteInterativo("");
                      }}
                      style={{ marginRight: "8px", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 600 }}>📚 Informática</span>
                  </label>
                </div>
              </div>

              {/* TEMPLATE VS ATIVIDADE */}
              <div className="exInputRow">
                <div className="exInputGroup">
                  <label className="exLabel" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="tipoAtividade"
                      value="atividade"
                      checked={!isTemplate}
                      onChange={() => setIsTemplate(false)}
                      style={{ marginRight: "8px", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 600 }}>📝 Atividade Padrão</span>
                  </label>
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Atividade padrão para a turma
                  </small>
                </div>

                <div className="exInputGroup">
                  <label className="exLabel" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="tipoAtividade"
                      value="template"
                      checked={isTemplate}
                      onChange={() => setIsTemplate(true)}
                      style={{ marginRight: "8px", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 600 }}>📦 Template (Reutilizável)</span>
                  </label>
                  <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Template reutilizável
                  </small>
                </div>
              </div>

              {/* COMPONENTES INTERATIVOS - Para Programação */}
              {categoria === "programacao" && (
                <>
                  <div className="exInputGroup">
                    <label className="exLabel">Tipo de Exercício</label>
                    <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                      <AnimatedRadioLabel
                        name="tipoExercicio"
                        value="nenhum"
                        checked={componenteInterativo === "nenhum"}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Nenhum (Normal)"
                        icon="📝"
                      />
                      <AnimatedRadioLabel
                        name="tipoExercicio"
                        value=""
                        checked={componenteInterativo === ""}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Código (Monaco)"
                        icon="💻"
                      />
                      <AnimatedRadioLabel
                        name="tipoExercicio"
                        value="escrita"
                        checked={componenteInterativo === "escrita"}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Escrita"
                        icon="✍️"
                      />
                      <AnimatedRadioLabel
                        name="tipoExercicio"
                        value="multipla"
                        checked={componenteInterativo === "multipla"}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Múltipla Escolha"
                        icon="❓"
                      />
                    </div>
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                      Selecione o tipo de exercício para Programação
                    </small>
                  </div>

                  {/* GABARITO / CÓDIGO ESPERADO - Apenas para tipo Código */}
                  {componenteInterativo === "" && (
                    <ScaleIn>
                    <div className="exInputGroup">
                      <label className="exLabel">Gabarito / Codigo esperado</label>
                      <MonacoEditor
                        value={gabarito}
                        onChange={(v) => setGabarito(v || "")}
                        language={gabaritoLang}
                        height="240px"
                        theme="dark"
                      />
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Esse texto sera usado para comparar se a resposta do aluno esta parecida com o esperado.
                      </small>
                    </div>
                    </ScaleIn>
                  )}

                  {/* EXERCÍCIO DE ESCRITA - Para Programação */}
                  {componenteInterativo === "escrita" && (
                    <ScaleIn>
                    <div className="exInputGroup">
                      <label className="exLabel">Resposta/Gabarito Esperado</label>
                      <textarea
                        className="exInput"
                        value={gabarito}
                        onChange={(e) => setGabarito(e.target.value)}
                        placeholder="Digite o gabarito ou resposta esperada para o exercício de escrita..."
                        style={{ minHeight: "200px", fontFamily: "inherit", resize: "vertical" }}
                      />
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Este texto será usado como referência para avaliar a resposta do aluno.
                      </small>
                    </div>
                    </ScaleIn>
                  )}

                  {/* QUESTÕES DE MÚLTIPLA ESCOLHA - Para Programação */}
                  {componenteInterativo === "multipla" && (
                    <ScaleIn>
                    <>
                      <div style={{ background: "var(--background-secondary)", border: "1px solid #fcd34d", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", margin: "0 0 12px 0" }}>
                          ❓ Configurar Questões de Múltipla Escolha:
                        </p>

                        {multiplaQuestoes.map((questao, qIndex) => (
                          <div key={qIndex} style={{ background: "var(--card)", padding: "12px", borderRadius: "6px", marginBottom: "12px", border: "1px solid #fde68a" }}>
                            <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>Questão {qIndex + 1}</h4>

                            <div style={{ marginBottom: "8px" }}>
                              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Pergunta:</label>
                              <input
                                className="exInput"
                                type="text"
                                value={questao.pergunta}
                                onChange={(e) => {
                                  const novas = [...multiplaQuestoes];
                                  novas[qIndex].pergunta = e.target.value;
                                  setMultiplaQuestoes(novas);
                                }}
                                placeholder="Digite a pergunta"
                              />
                            </div>

                            <div style={{ marginBottom: "8px" }}>
                              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Opções:</label>
                              {questao.opcoes.map((opcao, oIndex) => (
                                <input
                                  key={oIndex}
                                  className="exInput"
                                  type="text"
                                  value={opcao.text}
                                  onChange={(e) => {
                                    const novas = [...multiplaQuestoes];
                                    novas[qIndex].opcoes[oIndex].text = e.target.value;
                                    setMultiplaQuestoes(novas);
                                  }}
                                  placeholder={`Opção ${opcao.letter}`}
                                  style={{ marginBottom: "6px" }}
                                />
                              ))}
                            </div>

                            <div style={{ marginBottom: "8px" }}>
                              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: "4px" }}>Resposta Correta:</label>
                              <AnimatedSelect
                                className="exSelect"
                                value={questao.respostaCorreta}
                                onChange={(e) => {
                                  const novas = [...multiplaQuestoes];
                                  novas[qIndex].respostaCorreta = e.target.value;
                                  setMultiplaQuestoes(novas);
                                }}
                              >
                                <option value="">-- Selecione --</option>
                                {questao.opcoes.map((opcao) => (
                                  <option key={opcao.letter} value={opcao.letter}>
                                    {opcao.letter}: {opcao.text}
                                  </option>
                                ))}
                              </AnimatedSelect>
                            </div>

                            {multiplaQuestoes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMultiplaQuestoes(multiplaQuestoes.filter((_, i) => i !== qIndex));
                                }}
                                style={{
                                  padding: "6px 12px",
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                🗑️ Remover Questão
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            setMultiplaQuestoes([
                              ...multiplaQuestoes,
                              {
                                pergunta: "",
                                opcoes: [
                                  { letter: "A", text: "" },
                                  { letter: "B", text: "" },
                                  { letter: "C", text: "" },
                                  { letter: "D", text: "" }
                                ],
                                respostaCorreta: ""
                              }
                            ]);
                          }}
                          style={{
                            padding: "8px 16px",
                            background: "#dcfce7",
                            color: "#166534",
                            border: "1px solid #86efac",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: 600,
                            marginTop: "8px",
                          }}
                        >
                          ➕ Adicionar Outra Questão
                        </button>
                      </div>

                      <div style={{ background: "var(--background-secondary)", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px", marginTop: "12px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: "0 0 12px 0" }}>
                          👁️ Pré-visualização:
                        </p>
                        {multiplaQuestoes.map((questao, idx) => (
                          <div key={idx} style={{ marginBottom: "16px" }}>
                            <MultipleChoiceQuestion
                              question={`Q${idx + 1}: ${questao.pergunta}`}
                              options={questao.opcoes}
                              selectedAnswer=""
                              onAnswer={() => {}}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                    </ScaleIn>
                  )}
                </>
              )}

              {/* COMPONENTES INTERATIVOS - Apenas para Informática */}
              {categoria === "informatica" && (
                <>
                  <div className="exInputGroup">
                    <label className="exLabel">Componente Interativo</label>
                    <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                      <AnimatedRadioLabel
                        name="componenteInterativoInformatica"
                        value=""
                        checked={componenteInterativo === ""}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Nenhum (Normal)"
                        icon="📝"
                      />
                      <AnimatedRadioLabel
                        name="componenteInterativoInformatica"
                        value="escrita"
                        checked={componenteInterativo === "escrita"}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Escrita"
                        icon="✍️"
                      />
                      <AnimatedRadioLabel
                        name="componenteInterativoInformatica"
                        value="mouse"
                        checked={componenteInterativo === "mouse"}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Mouse"
                        icon="🖱️"
                      />
                      <AnimatedRadioLabel
                        name="componenteInterativoInformatica"
                        value="multipla"
                        checked={componenteInterativo === "multipla"}
                        onChange={(e) => setComponenteInterativo(e.target.value)}
                        label="Múltipla Escolha"
                        icon="❓"
                      />
                    </div>
                    <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                      Selecione o tipo de componente para Informática
                    </small>
                  </div>

                  {/* EXERCÍCIO DE ESCRITA - Para Informática */}
                  {componenteInterativo === "escrita" && (
                    <ScaleIn>
                    <div className="exInputGroup">
                      <label className="exLabel">Resposta/Gabarito Esperado</label>
                      <textarea
                        className="exInput"
                        value={gabarito}
                        onChange={(e) => setGabarito(e.target.value)}
                        placeholder="Digite o gabarito ou resposta esperada para o exercício de escrita..."
                        style={{ minHeight: "200px", fontFamily: "inherit", resize: "vertical" }}
                      />
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Este texto será usado como referência para avaliar a resposta do aluno.
                      </small>
                    </div>
                    </ScaleIn>
                  )}

                  {/* Campo "Dia #" quando um componente é selecionado */}
                  <ConditionalFieldAnimation isVisible={componenteInterativo !== ""}>
                    <div className="exInputGroup">
                      <label className="exLabel">Dia #</label>
                      <input
                        className="exInput"
                        type="number"
                        min="1"
                        value={diaNumero}
                        onChange={(e) => setDiaNumero(parseInt(e.target.value) || 1)}
                        placeholder="Digite o número do dia"
                      />
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Título será: "Dia {diaNumero}: {componenteInterativo === "mouse" ? "Mouse" : "Pergunta Múltipla"}"
                      </small>
                    </div>
                  </ConditionalFieldAnimation>

                  {/* REGRAS DO MOUSE - Apenas para componente Mouse */}
                  <ConditionalFieldAnimation isVisible={componenteInterativo === "mouse"}>
                    <>
                      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "14px", marginTop: "12px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", margin: "0 0 12px 0" }}>
                          ⚙️ Definir Regras de Sucesso:
                        </p>

                        <div className="exInputRow">
                          <div className="exInputGroup">
                            <label className="exLabel">Cliques Esquerdos</label>
                            <input
                              className="exInput"
                              type="number"
                              min="0"
                              value={mouseRegras.clicksSimples}
                              onChange={(e) => setMouseRegras({ ...mouseRegras, clicksSimples: parseInt(e.target.value) || 0 })}
                              placeholder="Ex: 5"
                            />
                            <small style={{ fontSize: 11, color: "var(--muted)" }}>Quantos cliques simples são necessários?</small>
                          </div>

                          <div className="exInputGroup">
                            <label className="exLabel">Duplos Cliques</label>
                            <input
                              className="exInput"
                              type="number"
                              min="0"
                              value={mouseRegras.duplosClicks}
                              onChange={(e) => setMouseRegras({ ...mouseRegras, duplosClicks: parseInt(e.target.value) || 0 })}
                              placeholder="Ex: 3"
                            />
                            <small style={{ fontSize: 11, color: "var(--muted)" }}>Quantos duplos cliques são necessários?</small>
                          </div>

                          <div className="exInputGroup">
                            <label className="exLabel">Cliques Direitos</label>
                            <input
                              className="exInput"
                              type="number"
                              min="0"
                              value={mouseRegras.clicksDireitos}
                              onChange={(e) => setMouseRegras({ ...mouseRegras, clicksDireitos: parseInt(e.target.value) || 0 })}
                              placeholder="Ex: 2"
                            />
                            <small style={{ fontSize: 11, color: "var(--muted)" }}>Quantos cliques direitos são necessários?</small>
                          </div>
                        </div>
                      </div>
                    </>
                  </ConditionalFieldAnimation>

                  {/* PREVIEW DO COMPONENTE MOUSE */}
                  <ConditionalFieldAnimation isVisible={componenteInterativo === "mouse"}>
                    <div style={{
                      background: "#f9fafb",
                      border: "2px dashed #e5e7eb",
                      borderRadius: "12px",
                      padding: "20px",
                      marginTop: "16px",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 0, marginBottom: "12px" }}>
                        📋 PREVIEW - Como o aluno vai ver:
                      </p>
                      <MouseInteractiveBox
                        title="🖱️ Interação com Mouse"
                        instruction="Clique, duplo-clique ou clique direito para registrar suas ações"
                      />
                    </div>
                  </ConditionalFieldAnimation>

                  {/* FORMULÁRIO DINÂMICO PARA MÚLTIPLA ESCOLHA */}
                  <ConditionalFieldAnimation isVisible={componenteInterativo === "multipla"}>
                    <div style={{
                      background: "#f9fafb",
                      border: "2px dashed #e5e7eb",
                      borderRadius: "12px",
                      padding: "20px",
                      marginTop: "16px",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginTop: 0, marginBottom: "16px" }}>
                        📋 Criar Questões ({multiplaQuestoes.length})
                      </p>

                      {/* Loop através de cada questão */}
                      {multiplaQuestoes.map((questao, qIndex) => (
                        <div key={qIndex} style={{
                          background: "var(--card)",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          padding: "16px",
                          marginBottom: "16px",
                        }}>
                          <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1f2937" }}>
                            Questão {qIndex + 1}
                          </h4>

                          {/* Campo de pergunta */}
                          <div style={{ marginBottom: "12px" }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                              Pergunta
                            </label>
                            <input
                              type="text"
                              placeholder="Digite a pergunta..."
                              value={questao.pergunta}
                              onChange={(e) => {
                                const novaQuestoes = [...multiplaQuestoes];
                                novaQuestoes[qIndex].pergunta = e.target.value;
                                setMultiplaQuestoes(novaQuestoes);
                              }}
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #d1d5db",
                                borderRadius: "4px",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>

                          {/* Campos de opções */}
                          {questao.opcoes.map((opcao, oIndex) => (
                            <div key={oIndex} style={{ marginBottom: "12px" }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                                Opção {opcao.letter}
                              </label>
                              <input
                                type="text"
                                placeholder={`Digite a opção ${opcao.letter}...`}
                                value={opcao.text}
                                onChange={(e) => {
                                  const novaQuestoes = [...multiplaQuestoes];
                                  novaQuestoes[qIndex].opcoes[oIndex].text = e.target.value;
                                  setMultiplaQuestoes(novaQuestoes);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "4px",
                                  fontSize: "14px",
                                  fontFamily: "inherit",
                                  boxSizing: "border-box",
                                }}
                              />
                            </div>
                          ))}

                          {/* Radio buttons para resposta correta */}
                          <div style={{ marginBottom: "12px" }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 0, marginBottom: "8px" }}>
                              Resposta Correta:
                            </p>
                            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                              {questao.opcoes.map((opcao) => (
                                <label key={opcao.letter} style={{ display: "flex", alignItems: "center", fontSize: "14px", cursor: "pointer" }}>
                                  <input
                                    type="radio"
                                    name={`respostaCorreta_${qIndex}`}
                                    value={opcao.letter}
                                    checked={questao.respostaCorreta === opcao.letter}
                                    onChange={(e) => {
                                      const novaQuestoes = [...multiplaQuestoes];
                                      novaQuestoes[qIndex].respostaCorreta = e.target.value;
                                      setMultiplaQuestoes(novaQuestoes);
                                    }}
                                    style={{ marginRight: "6px", cursor: "pointer" }}
                                  />
                                  {opcao.letter}
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Botão remover questão */}
                          {multiplaQuestoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setMultiplaQuestoes(multiplaQuestoes.filter((_, i) => i !== qIndex));
                              }}
                              style={{
                                padding: "6px 12px",
                                background: "#fecaca",
                                color: "#991b1b",
                                border: "1px solid #fca5a5",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 500,
                              }}
                            >
                              ❌ Remover Questão
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Botão adicionar questão */}
                      <button
                        type="button"
                        onClick={() => {
                          setMultiplaQuestoes([...multiplaQuestoes, {
                            pergunta: "",
                            opcoes: [
                              { letter: "A", text: "" },
                              { letter: "B", text: "" },
                              { letter: "C", text: "" },
                              { letter: "D", text: "" }
                            ],
                            respostaCorreta: ""
                          }]);
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "#dbeafe",
                          color: "#0c4a6e",
                          border: "1px solid #93c5fd",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                          marginBottom: "16px",
                        }}
                      >
                        ➕ Adicionar Outra Questão
                      </button>

                      {/* PREVIEW DINÂMICO DA PRIMEIRA QUESTÃO */}
                      {multiplaQuestoes.length > 0 && multiplaQuestoes[0].pergunta && (
                        <div style={{
                          background: "var(--card)",
                          border: "2px solid var(--line)",
                          borderRadius: "8px",
                          padding: "16px",
                          marginTop: "16px",
                        }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#0c4a6e", marginTop: 0, marginBottom: "12px" }}>
                            👁️ PREVIEW - Como o aluno vai ver:
                          </p>
                          <MultipleChoiceQuestion
                            question={`Q1: ${multiplaQuestoes[0].pergunta}`}
                            options={multiplaQuestoes[0].opcoes}
                            onAnswer={() => {}}
                          />
                        </div>
                      )}
                    </div>
                  </ConditionalFieldAnimation>
                </>
              )}

              <div className="exInputRow">
                <div className="exInputGroup">
                  <label className="exLabel">Módulo *</label>
                  <input
                    className="exInput"
                    placeholder="ex: MÓDULO 4"
                    value={modulo}
                    onChange={(e) => setModulo(e.target.value)}
                  />
                </div>

                <div className="exInputGroup">
                  <label className="exLabel">Tema</label>
                  <input
                    className="exInput"
                    placeholder="ex: HTML5 e CSS3 Avançado"
                    value={tema}
                    onChange={(e) => setTema(e.target.value)}
                  />
                </div>

                <div className="exInputGroup">
                  <label className="exLabel">Prazo</label>
                  <input
                    className="exInput"
                    type="datetime-local"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                  />
                </div>
              </div>

              {/* AGENDAMENTO DE PUBLICAÇÃO */}
              <div className="exInputRow">
                <div className="exInputGroup">
                  <label className="exLabel" style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", cursor: "pointer" }}>
                    <AnimatedToggle
                      checked={publishNow}
                      onChange={setPublishNow}
                      disabled={isTemplate}
                    />
                    Publicar agora
                  </label>
                </div>
              </div>

              <ConditionalFieldAnimation isVisible={!publishNow && !isTemplate}>
                <div className="exInputRow">
                  <div className="exInputGroup" style={{ cursor: "pointer" }}>
                    <label className="exLabel" style={{ cursor: "pointer" }}>📅 Agendar Publicação</label>
                    <input
                      className="exInput"
                      type="datetime-local"
                      value={publishedAt}
                      onChange={(e) => setPublishedAt(e.target.value)}
                      required={!publishNow}
                      style={{ cursor: "pointer" }}
                    />
                    <small style={{ color: "#666", marginTop: "4px" }}>
                      O exercício será visível a partir dessa data e hora
                    </small>
                  </div>
                </div>
              </ConditionalFieldAnimation>

              {isTemplate && (
                <div style={{ padding: "12px", background: "#dbeafe", borderRadius: "4px", color: "#075985", fontSize: "14px", marginTop: "12px" }}>
                  ℹ️ Templates são sempre publicados imediatamente para poderem ser reutilizados
                </div>
              )}

              {canCreate && (turmasDisponiveis.length > 0 || alunosDisponiveis.length > 0) && (
                <>
                  <div className="exInputGroup">
                    <label className="exLabel">Atribuição</label>
                    <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                      <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px" }}>
                        <input
                          type="radio"
                          name="modoAtribuicao"
                          value="turma"
                          checked={modoAtribuicao === "turma"}
                          onChange={() => {
                            setModoAtribuicao("turma");
                            setAlunosSelecionados([]);
                          }}
                          style={{ marginRight: "6px", cursor: "pointer" }}
                        />
                        👥 Turma Específica
                      </label>
                      <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px" }}>
                        <input
                          type="radio"
                          name="modoAtribuicao"
                          value="aluno"
                          checked={modoAtribuicao === "aluno"}
                          onChange={() => {
                            setModoAtribuicao("aluno");
                            setTurmasSelecionadas([]);
                          }}
                          style={{ marginRight: "6px", cursor: "pointer" }}
                        />
                        👤 Aluno Específico
                      </label>
                    </div>
                  </div>

                  {modoAtribuicao === "turma" && turmasDisponiveis.length > 0 && (
                    <div className="exInputGroup">
                      <label className="exLabel">Turmas</label>
                      <AnimatedSelect
                        className="exSelect"
                        multiple
                        value={turmasSelecionadas}
                        onChange={(e) =>
                          setTurmasSelecionadas(
                            Array.from(e.target.selectedOptions, (opt) => opt.value)
                          )
                        }
                        size={3}
                      >
                        {turmasDisponiveis.map((turma) => (
                          <option key={turma.id} value={turma.id}>
                            {turma.nome}
                          </option>
                        ))}
                      </AnimatedSelect>
                      <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Segure Ctrl/Cmd para selecionar múltiplas turmas. Deixe vazio para "Todos".
                      </small>
                    </div>
                  )}

                  {modoAtribuicao === "aluno" && alunosDisponiveis.length > 0 && (
                    <>
                      <div className="exInputGroup">
                        <label className="exLabel">Pesquisar Alunos</label>
                        <input
                          type="text"
                          className="exInput"
                          placeholder="🔍 Digite nome ou usuário..."
                          value={alunoFiltro}
                          onChange={(e) => setAlunoFiltro(e.target.value)}
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="exInputGroup">
                        <label className="exLabel">Alunos</label>
                        <AnimatedSelect
                          className="exSelect"
                          multiple
                          value={alunosSelecionados}
                          onChange={(e) =>
                            setAlunosSelecionados(
                              Array.from(e.target.selectedOptions, (opt) => opt.value)
                            )
                          }
                          size={3}
                        >
                          {alunosDisponiveis
                            .filter(
                              (aluno) =>
                                alunoFiltro === "" ||
                                aluno.nome.toLowerCase().includes(alunoFiltro.toLowerCase()) ||
                                aluno.usuario.toLowerCase().includes(alunoFiltro.toLowerCase())
                            )
                            .map((aluno) => (
                              <option key={aluno.id} value={aluno.id}>
                                {aluno.nome} ({aluno.usuario})
                              </option>
                            ))}
                        </AnimatedSelect>
                        <small style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                          Segure Ctrl/Cmd para selecionar múltiplos alunos
                        </small>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* AVISO: Tipo "Nenhum" não pode ser publicado */}
              {componenteInterativo === "nenhum" && (
                <ConditionalFieldAnimation isVisible={true} duration={0.3}>
                  <div style={{
                    padding: "12px",
                    marginBottom: "12px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: "500",
                  }}>
                    ⚠️ <strong>Tipo "Nenhum"</strong> é apenas um seletor para alunos. Não é possível publicar um exercício com este tipo. Escolha um tipo válido: Código, Escrita ou Digitação.
                  </div>
                </ConditionalFieldAnimation>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                <AnimatedButton
                  className="exSubmitBtn"
                  onClick={handleSubmit}
                  disabled={disabled}
                  loading={saving}
                  style={{ flex: 1 }}
                >
                  {editandoId ? "💾 Atualizar Exercício" : "✨ Publicar Exercício"}
                </AnimatedButton>
                {editandoId && (
                  <AnimatedButton
                    className="exSubmitBtn"
                    onClick={handleCancel}
                    disabled={saving}
                    style={{
                      background: "linear-gradient(135deg, #6b7280, #4b5563)",
                      flex: 1,
                    }}
                  >
                    ❌ Cancelar
                  </AnimatedButton>
                )}
              </div>

              <div className="exFormNote">
                💡 Exercícios criados ficam visíveis para todos os alunos automaticamente.
              </div>
            </div>
          </div>
          </FadeInUp>
        )}

        {/* FILTROS DE EXERCÍCIOS */}
        <div className="filtersSection">
          {/* Linha 1: Busca por título */}
          <div className="filterRow">
            <div className="filterGroup" style={{ flex: 1 }}>
              <input
                className="exInput"
                type="text"
                placeholder="🔍 Buscar por titulo..."
                value={buscaFiltro}
                onChange={(e) => setBuscaFiltro(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Linha 2: Módulo, Tipo, Turmas, Aluno */}
          <div className="filterRow" style={{ gap: "12px" }}>
            {/* Filtro de modulo */}
            <div className="filterGroup">
              <select
                className="exSelect"
                value={moduloFiltro}
                onChange={(e) => setModuloFiltro(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">📚 Todos os Módulos</option>
                {Array.from(new Set(items.map((ex) => ex.modulo)))
                  .sort()
                  .map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
              </select>
            </div>

            {/* Filtro de tipo */}
            <div className="filterGroup">
              <select
                className="exSelect"
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">📝 Todos os Tipos</option>
                <option value="codigo">💻 Código</option>
                <option value="texto">📄 Texto</option>
              </select>
            </div>

            {/* Filtro de turmas */}
            {turmasDisponiveis.length > 0 && (
              <div className="filterGroup">
                <select
                  className="exSelect"
                  value={turmaFiltro}
                  onChange={(e) => setTurmaFiltro(e.target.value)}
                  style={{ minWidth: 180 }}
                >
                  <option value="todas">👥 Todas as turmas</option>
                  {turmasDisponiveis.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* LISTA DE EXERCÍCIOS */}
        <div>
          {loading && items.length === 0 ? (
            <div className="loadingState">
              <div className="spinner" />
              Carregando exercícios...
            </div>
          ) : !loading && items.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon">📚</div>
              <div className="emptyTitle">Nenhum exercício disponível</div>
              <p style={{ margin: "8px 0 0 0", color: "var(--muted)" }}>
                Volte mais tarde para novos exercícios!
              </p>
            </div>
          ) : (
            <>
              {/* Filtros e Paginação */}
              <div style={{ marginBottom: "16px" }}>
                {(() => {
                  const filteredExercises = items.filter((ex) => {
                    if (ex.is_template) return false;
                    // Filtro de busca por titulo
                    if (
                      buscaFiltro &&
                      !ex.titulo.toLowerCase().includes(buscaFiltro.toLowerCase())
                    ) {
                      return false;
                    }

                    // Filtro de modulo
                    if (moduloFiltro && ex.modulo !== moduloFiltro) {
                      return false;
                    }

                    // Filtro de tipo
                    if (tipoFiltro && ex.tipoExercicio !== tipoFiltro) {
                      return false;
                    }

                    // Filtro de turma
                    if (turmaFiltro === "todas") return true;
                    return ex.turmas?.some((t) => t.id === turmaFiltro);
                  });

                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

                  return (
                    <>
                      <div className="exercisesList">
                        {paginatedExercises.map((ex) => (
                <div
                  key={ex.id}
                  className={`exerciseCard ${canCreate ? "canEdit" : ""}`}
                  onClick={() => navigate(`/dashboard/exercicios/${ex.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      navigate(`/dashboard/exercicios/${ex.id}`);
                    }
                  }}
                >
                  {canCreate && (
                    <div className="exerciseActions">
                      <button
                        className="exerciseEditBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(ex);
                        }}
                        title="Editar exercício"
                      >
                        ✏️
                      </button>
                      <button
                        className="exerciseDeleteBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ex.id);
                        }}
                        title="Deletar exercício"
                      >
                        🗑️
                      </button>
                    </div>
                  )}

                  <div className="exerciseHeader">
                    <div className="exerciseInfo">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 className="exerciseTitle">{ex.titulo}</h3>
                        {}
                        {ex.publishedAt && new Date(ex.publishedAt) > new Date() && (
                          <span className="exerciseBadge" style={{ background: "#3b82f6", color: "white" }} title="Exercício programado para publicação">
                            📅 Programado
                          </span>
                        )}
                        {ex.tipoExercicio && (
                          <span className="exerciseBadge" title={ex.tipoExercicio === "codigo" ? "Exercício de código" : "Exercício de digitação"}>
                            {ex.tipoExercicio === "codigo" ? "💻" : "✍️"}
                          </span>
                        )}
                      </div>
                      <div className="exerciseModule">
                        {ex.modulo}
                        {ex.tema && (
                          <span className="exerciseTopic">{ex.tema}</span>
                        )}
                      </div>
                    </div>
                    <div className="exerciseMeta">
                      <div className={`exerciseDeadline ${
                        ex.prazo && new Date(ex.prazo) < new Date() ? "overdue" : ""
                      }`}>
                        {ex.prazo
                          ? new Date(ex.prazo).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Sem prazo"
                        }
                      </div>
                    </div>
                  </div>

                  <div className="exerciseDescription">{ex.descricao}</div>

                  {/* Badges de acesso/turmas */}
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ex.turmas && ex.turmas.length > 0 ? (
                      <>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            borderRadius: "12px",
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#1e40af",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                          }}
                        >
                          🏛️ {ex.turmas.length} turma{ex.turmas.length > 1 ? "s" : ""}
                        </span>
                        {ex.turmas.map((turma) => (
                          <span
                            key={turma.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              fontSize: "10px",
                              fontWeight: 600,
                              borderRadius: "12px",
                              background:
                                turma.tipo === "turma"
                                  ? "rgba(59, 130, 246, 0.1)"
                                  : "rgba(168, 85, 247, 0.1)",
                              color:
                                turma.tipo === "turma" ? "#2563eb" : "#a855f7",
                              border:
                                turma.tipo === "turma"
                                  ? "1px solid rgba(59, 130, 246, 0.2)"
                                  : "1px solid rgba(168, 85, 247, 0.2)",
                            }}
                            title={`${turma.tipo}: ${turma.nome}`}
                          >
                            {turma.nome}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          borderRadius: "12px",
                          background: "rgba(34, 197, 94, 0.15)",
                          color: "#15803d",
                          border: "1px solid rgba(34, 197, 94, 0.3)",
                        }}
                        title="Disponível para todos os alunos"
                      >
                        🌐 Para Todos
                      </span>
                    )}
                  </div>
                </div>
                        ))}
                      </div>

                      <Pagination
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={filteredExercises.length}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                      />
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* MODAL DE CONFIRMAÇÃO PARA DELETAR */}
        <ConfirmModal
          isOpen={modalDeletar.isOpen}
          title="Deletar Exercício"
          message={`Tem certeza que deseja deletar "${modalDeletar.exercicioTitulo}"? Esta ação não pode ser desfeita e todas as submissões serão perdidas.`}
          confirmText="Deletar"
          cancelText="Cancelar"
          onConfirm={confirmarDeletar}
          onCancel={fecharModalDeletar}
          danger={true}
          isLoading={saving}
        />
      </div>
    </DashboardLayout>
  );
}
