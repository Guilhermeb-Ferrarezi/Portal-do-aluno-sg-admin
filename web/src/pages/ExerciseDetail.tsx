import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRole } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import MonacoEditor from "../components/MonacoEditor";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
import MouseInteractiveBox from "../components/Exercise/MouseInteractiveBox";
import ShortcutTrainingBox, { type ShortcutTrainingBoxHandle } from "../components/Exercise/ShortcutTrainingBox";
import { FadeInUp, AnimatedButton, PulseLoader, ConditionalFieldAnimation, AnimatedToast } from "../components/animate-ui";
import {
  obterExercicio,
  enviarSubmissao,
  minhasSubmissoes,
  listarSubmissoesExercicio,
  type Exercicio,
  type Submissao,
} from "../services/api";
import "./ExerciseDetail.css";

// Helper: Determina qual tipo de exercício renderizar baseado nos campos
function determinarTipoRenderizacao(exercicio: Exercicio | null) {
  if (!exercicio) return null;

  // Se tem atalho_tipo, é exercício de atalho
  if (exercicio.atalho_tipo) return "atalho";

  // Se tem multipla_regras e tipoExercicio é "multipla", é múltipla escolha
  if (exercicio.multipla_regras && (exercicio.tipoExercicio === "multipla" ||
    (exercicio.tipoExercicio === "nenhum" && exercicio.multipla_regras))) {
    return "multipla";
  }

  // Se tem mouse_regras e tipoExercicio é "mouse", é mouse interativo
  if (exercicio.mouse_regras && (exercicio.tipoExercicio === "mouse" ||
    (exercicio.tipoExercicio === "nenhum" && exercicio.mouse_regras))) {
    return "mouse";
  }

  // Senão, usa o tipoExercicio
  return exercicio.tipoExercicio || "texto";
}

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = getRole();
  const canReview = role === "admin" || role === "professor";

  // Exercício
  const [exercicio, setExercicio] = React.useState<Exercicio | null>(null);
  const [loadingEx, setLoadingEx] = React.useState(true);
  const [erroEx, setErroEx] = React.useState<string | null>(null);

  // Submissão
  const [resposta, setResposta] = React.useState("");
  const [linguagem, setLinguagem] = React.useState("javascript");
  const [enviando, setEnviando] = React.useState(false);
  const [erroSubmissao, setErroSubmissao] = React.useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = React.useState<string | null>(null);
  const [avisoMsg, setAvisoMsg] = React.useState<string | null>(null);

  // Teste de código
  const [outputTeste, setOutputTeste] = React.useState<string>("");
  const [erroTeste, setErroTeste] = React.useState<string | null>(null);

  // Minhas tentativas
  const [submissoes, setSubmissoes] = React.useState<Submissao[]>([]);

  const [submissoesRecebidas, setSubmissoesRecebidas] = React.useState<Array<Submissao & { alunoNome: string; alunoUsuario: string }>>([]);
  const [loadingRecebidas, setLoadingRecebidas] = React.useState(false);

  // Para exercícios do Dia 1 (múltipla escolha e interativos)
  const [respostasMultipla, setRespostasMultipla] = React.useState<Record<string, string>>({});

  // Para exercícios com Mouse Interativo
  const [mouseCompleted, setMouseCompleted] = React.useState(false);

  // Para exercícios tipo "Nenhum" - seletor de tipo
  const [selectedTipoNenhum, setSelectedTipoNenhum] = React.useState<"codigo" | "texto" | "escrita" | "multipla" | "mouse" | "atalho" | null>(null);
  // Para exercícios de ATALHO: texto de exemplo e estado de conclusão
  const [atalhoSample, setAtalhoSample] = React.useState("");
  const [atalhoCompleted, setAtalhoCompleted] = React.useState(false);
  const [atalhoTextCopied, setAtalhoTextCopied] = React.useState(false);
  const [atalhoTextNotice, setAtalhoTextNotice] = React.useState<string | null>(null);
  const [atalhoTextNoticeType, setAtalhoTextNoticeType] = React.useState<"info" | "error" | "success">("info");
  const [atalhoAutoSubmitted, setAtalhoAutoSubmitted] = React.useState(false);
  const [atalhoAutoNotice, setAtalhoAutoNotice] = React.useState(false);

  // Carregar exercício
  React.useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoadingEx(true);
        const data = await obterExercicio(id);
        setExercicio(data);
      } catch (error) {
        setErroEx(error instanceof Error ? error.message : "Erro ao carregar exercício");
      } finally {
        setLoadingEx(false);
      }
    })();
  }, [id]);

  // (amostras geradas no efeito centralizado abaixo)

  // Auto-submissão quando o atalho é completado
  React.useEffect(() => {
    if (!atalhoCompleted) return;
    if (atalhoAutoSubmitted) return;
    // Apenas enviar se estamos em um exercício válido
    if (!exercicio) return;
    // Não auto-enviar se já enviou e não permite repetição
    if (submissoes.length > 0 && !(exercicio.permitir_repeticao ?? false)) return;
    // Chamar função de envio existente
    (async () => {
      try {
        await handleEnviar();
        setAtalhoAutoSubmitted(true);
        setAtalhoAutoNotice(true);
        setTimeout(() => setAtalhoAutoNotice(false), 4000);
      } catch (err) {
        // Se falhar, não marcar como enviado para tentar novamente
        console.error("Auto-submissão falhou:", err);
      }
    })();
  }, [atalhoCompleted, atalhoAutoSubmitted, exercicio]);

  // Carregar minhas tentativas
  React.useEffect(() => {
    if (!id || !exercicio) return;

    (async () => {
      try {
        const data = await minhasSubmissoes(id);
        setSubmissoes(data);
      } catch (error) {
        console.error("Erro ao carregar submissões:", error);
      }
    })();
  }, [id, exercicio]);

  // Refs e handlers para exercícios do tipo ATALHO (devem ficar no topo do componente)
  const sampleRef = React.useRef<HTMLDivElement | null>(null);
  const shortcutBoxRef = React.useRef<ShortcutTrainingBoxHandle>(null);

  const currentAtalhoTipo = exercicio ? ((exercicio.atalho_tipo as "copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar") ?? "copiar-colar") : "copiar-colar";

  // Atualiza amostra quando exercício ou tipo mudar
  React.useEffect(() => {
    if (!exercicio) return;
    if (currentAtalhoTipo === "copiar-colar-imagens") {
      const svgImage = (color: string, text: string) =>
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><rect width="420" height="220" rx="12" fill="${color}"/><text x="210" y="110" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`)}`;
      const images = [
        svgImage("#4F46E5", "Imagem Exemplo 1"),
        svgImage("#059669", "Imagem Exemplo 2"),
        svgImage("#DC2626", "Imagem Exemplo 3")
      ];
      setAtalhoSample(images[Math.floor(Math.random() * images.length)]);
    } else {
      const texts = [
        "Copie este texto de exemplo: O rápido castor marrom salta sobre o cão preguiçoso.",
        "Selecione e cole: Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "Exemplo: 12345 - teste rápido de copiar e colar!",
        "Frase exemplo: Digite ou cole exatamente este texto para treinar atalhos.",
        "Treino: Abacaxi, banana, uva, morango, limão."
      ];
      setAtalhoSample(texts[Math.floor(Math.random() * texts.length)]);
    }
    setAtalhoCompleted(false);
    setAtalhoTextCopied(false);
    setAtalhoTextNotice(null);
    setAtalhoTextNoticeType("info");
  }, [exercicio, currentAtalhoTipo]);

  // Handler para colagem de imagens (quando aplicável) — pode ser usado em onPaste ou no listener global
  const handleImagePaste = React.useCallback((e: any) => {
    const items = e.clipboardData && Array.from(e.clipboardData.items || []);
    if (!items || items.length === 0) return false;
    for (const item of items) {
      if (item.type && item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            setResposta(result);
            setAtalhoCompleted(true);
          };
          reader.readAsDataURL(file);
          if (e.preventDefault) e.preventDefault();
          return true;
        }
      }
    }
    return false;
  }, []);

  // Handler para input na amostra (selecionar e apagar)
  const handleSampleInput = React.useCallback(() => {
    const el = sampleRef.current;
    if (!el) return;
    const text = el.innerText || "";
    if (text.trim().length === 0) {
      setAtalhoCompleted(true);
    } else {
      setAtalhoCompleted(false);
    }
  }, []);

  // Listener global de paste para capturar imagem mesmo sem foco
  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        if (!exercicio) return;
        const localTipo = (exercicio.atalho_tipo as "copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar") ?? "copiar-colar";
        if (localTipo !== "copiar-colar-imagens") return;
        handleImagePaste(e);
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener("paste", handler as EventListener);
    return () => window.removeEventListener("paste", handler as EventListener);
  }, [exercicio, handleImagePaste]);


  // Carregar submissoes dos alunos (admin/prof)
  React.useEffect(() => {
    if (!id || !canReview) return;

    (async () => {
      try {
        setLoadingRecebidas(true);
        const data = await listarSubmissoesExercicio(id);
        setSubmissoesRecebidas(data);
      } catch (error) {
        console.error("Erro ao carregar submissoes dos alunos:", error);
      } finally {
        setLoadingRecebidas(false);
      }
    })();
  }, [id, canReview]);
  const handleTestarCodigo = () => {
    if (linguagem !== "javascript") {
      setErroTeste("Teste disponível apenas para JavaScript!");
      return;
    }

    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;

    try {
      setErroTeste(null);
      setOutputTeste("");

      // Capturar console.log
      console.log = (...args: any[]) => {
        logs.push(args.map((arg) => String(arg)).join(" "));
        originalLog(...args);
      };

      console.error = (...args: any[]) => {
        logs.push("❌ " + args.map((arg) => String(arg)).join(" "));
        originalError(...args);
      };

      // Executar código
      // eslint-disable-next-line no-eval
      eval(resposta);

      // Restaurar console
      console.log = originalLog;
      console.error = originalError;

      setOutputTeste(logs.length > 0 ? logs.join("\n") : "✅ Código executado sem erros!");
    } catch (error) {
      console.log = originalLog;
      console.error = originalError;
      setErroTeste(error instanceof Error ? error.message : "Erro ao executar código");
      setOutputTeste("");
    }
  };

  const handleEnviar = async () => {
    if (!id || !exercicio) return;

    // Exercícios tipo "nenhum" precisam de um tipo selecionado
    if (exercicio.tipoExercicio === "nenhum" && !selectedTipoNenhum) {
      setErroSubmissao("Por favor, selecione um tipo de exercício antes de enviar.");
      return;
    }

    // Determinar tipo de renderização (usa tipoExercicio e campos auxiliares)
    const tipoRenderizacao = determinarTipoRenderizacao(exercicio);
    const isMultipla = tipoRenderizacao === "multipla";

    // Validação
    if (isMultipla) {
      const multiplaRegras = exercicio.multipla_regras ? JSON.parse(exercicio.multipla_regras) : { questoes: [] };
      const totalQuestoes = multiplaRegras.questoes?.length || 0;
      const respostasCount = Object.keys(respostasMultipla).length;

      if (respostasCount < totalQuestoes) {
        setErroSubmissao(`Por favor, responda todas as ${totalQuestoes} questões.`);
        return;
      }
    } else if (resposta.trim().length === 0 && tipoRenderizacao !== "atalho") {
      setErroSubmissao("A resposta não pode estar vazia");
      return;
    }

    try {
      setEnviando(true);
      setErroSubmissao(null);
      setSucessoMsg(null);
      setAvisoMsg(null);

      // Determinar tipo de resposta - se "nenhum", usar tipo selecionado
      let tipoResposta = exercicio.tipoExercicio || "texto";
      if (tipoResposta === "nenhum" && selectedTipoNenhum) {
        tipoResposta = selectedTipoNenhum;
      }
      // API só aceita "codigo" ou "texto" - mapear tipos especiais
      if (tipoResposta !== "codigo") {
        tipoResposta = "texto";
      }

      // Preparar resposta
      const respostaFinal = isMultipla
        ? JSON.stringify(respostasMultipla)
        : tipoRenderizacao === "atalho"
          ? "Você conseguiu, Parabéns!"
          : resposta.trim();

      const result = await enviarSubmissao(id, {
        resposta: respostaFinal,
        tipo_resposta: tipoResposta,
        linguagem: tipoResposta === "codigo" ? linguagem : undefined,
      });

      // Feedback
      const score = result.submissao?.nota;
      if (isMultipla && score !== null && score !== undefined) {
        if (score >= 70) {
          setSucessoMsg(`✅ Parabéns! Você acertou e obteve ${score}% de aproveitamento!`);
        } else {
          setAvisoMsg(`⚠️ Você obteve ${score}% de acertos. Revise e tente novamente.`);
        }
      } else {
        const verScore = result.submissao?.verificacaoDescricao;
        if (verScore !== null && verScore !== undefined && verScore < 50) {
          setAvisoMsg("⚠️ Resposta enviada, mas parece fora do jeito esperado. Revise o enunciado.");
        } else {
          setSucessoMsg("✅ Resposta enviada com sucesso!");
        }
      }

      setResposta("");
      setRespostasMultipla({});

      // Recarregar submissões
      const data = await minhasSubmissoes(id);
      setSubmissoes(data);
    } catch (error) {
      setErroSubmissao(error instanceof Error ? error.message : "Erro ao enviar resposta");
    } finally {
      setEnviando(false);
    }
  };

  if (loadingEx) {
    return (
      <DashboardLayout title="Exercício" subtitle="Carregando...">
        <div className="exerciseDetailContainer">
          <div className="loadingState">
            <PulseLoader size="medium" color="var(--red)" text="Carregando exercício..." />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (erroEx || !exercicio) {
    return (
      <DashboardLayout title="Exercício" subtitle="Erro">
        <div className="exerciseDetailContainer">
          <FadeInUp delay={0.1} duration={0.4}>
            <div className="exMessage error">
              <span>❌</span>
              <span>{erroEx || "Exercício não encontrado"}</span>
            </div>
          </FadeInUp>
          <AnimatedButton
            className="btnBack"
            onClick={() => navigate("/dashboard/exercicios")}
          >
            ← Voltar aos exercícios
          </AnimatedButton>
        </div>
      </DashboardLayout>
    );
  }

  const prazoData = exercicio.prazo ? new Date(exercicio.prazo) : null;
  const prazoVencido = prazoData ? prazoData < new Date() : false;
  const jaEnviou = submissoes.length > 0 && !(exercicio.permitir_repeticao ?? false);
  const temaTema = exercicio.tema || "Sem tema";
  let tipoExercicio = exercicio.tipoExercicio || "texto";

  // Se é exercício tipo "nenhum" e usuário selecionou um tipo, use o tipo selecionado
  if (exercicio.tipoExercicio === "nenhum" && selectedTipoNenhum) {
    tipoExercicio = selectedTipoNenhum;
  }

  // Usar tipoExercicio para renderização (já considera selectedTipoNenhum)
  const tipoRenderizacao = tipoExercicio;
  const atalhoTextNoticeStyle =
    atalhoTextNoticeType === "success"
      ? { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }
      : atalhoTextNoticeType === "error"
        ? { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }
        : { background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" };

  return (
    <DashboardLayout
      title={exercicio.titulo}
      subtitle={`${exercicio.modulo} • ${temaTema}`}
    >
      <FadeInUp delay={0} duration={0.28}>
        <div className="exerciseDetailContainer">
          {/* BOTÃO VOLTAR */}
          <AnimatedButton
            className="btnBack"
            onClick={() => navigate("/dashboard/exercicios")}
          >
            ← Voltar aos exercícios
          </AnimatedButton>

          {/* GRID 2 COLUNAS */}
          <div className="exerciseDetailGrid">
            {/* COLUNA ESQUERDA: ENUNCIADO */}
            <div className="exerciseDetailLeft">
              <div className="edCard edEnunciado">
                <h2 className="edSubtitle">📋 Enunciado</h2>

                <div className="edMeta">
                  <div className="edMetaItem">
                    <span className="edLabel">Módulo:</span>
                    <strong>{exercicio.modulo}</strong>
                  </div>
                  {exercicio.tema && (
                    <div className="edMetaItem">
                      <span className="edLabel">Tema:</span>
                      <strong>{exercicio.tema}</strong>
                    </div>
                  )}
                  <div className="edMetaItem">
                    <span className="edLabel">Tipo:</span>
                    <strong>
                      {(() => {
                        // Determinar tipo real baseado nos campos
                        let displayText = "Exercício";
                        let displayIcon = "📝";

                        if (exercicio.mouse_regras) {
                          displayType = "mouse";
                          displayIcon = "🖱️";
                          displayText = "Mouse";
                        } else if (exercicio.multipla_regras) {
                          displayType = "multipla";
                          displayIcon = "❓";
                          displayText = "Quiz (Múltipla Escolha)";
                        } else if (exercicio.atalho_tipo) {
                          displayType = "atalho";
                          displayIcon = "⌨️";
                          if (exercicio.atalho_tipo === "copiar-colar") {
                            displayText = "Atalho: Copiar/Colar";
                          } else if (exercicio.atalho_tipo === "copiar-colar-imagens") {
                            displayText = "Atalho: Copiar Imagens";
                          } else if (exercicio.atalho_tipo === "selecionar-deletar") {
                            displayText = "Atalho: Selecionar/Deletar";
                          } else {
                            displayText = "Atalho";
                          }
                        } else if (tipoExercicio === "codigo") {
                          displayIcon = "💻";
                          displayText = "Código";
                        } else if (tipoExercicio === "escrita") {
                          displayIcon = "✍️";
                          displayText = "Escrita/Texto";
                        } else if (tipoExercicio === "nenhum") {
                          displayIcon = "🌐";
                          displayText = "Nenhum (Consulta)";
                        } else {
                          displayIcon = "📝";
                          displayText = "Digitação/Texto";
                        }

                        return `${displayIcon} ${displayText}`;
                      })()}
                    </strong>
                  </div>
                  {prazoData && (
                    <div className={`edMetaItem ${prazoVencido ? "overdue" : ""}`}>
                      <span className="edLabel">Prazo:</span>
                      <strong>
                        {prazoData.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="edDescricao">
                  {exercicio.descricao}
                </div>
              </div>

              {/* TENTATIVAS ANTERIORES */}
              <ConditionalFieldAnimation isVisible={submissoes.length > 0} duration={0.3}>
                <div className="edCard edTentativas">
                  <h3 className="edSubtitle">📊 Minhas Tentativas ({submissoes.length})</h3>

                  <div className="tentativasList">
                    {submissoes.map((sub, idx) => (
                      <FadeInUp key={sub.id} delay={0.05 * (idx + 1)} duration={0.3}>
                        <div className="tentativaItem">
                          <div className="tentativaNumber">
                            Tentativa {submissoes.length - idx}
                            {sub.isLate && (
                              <span style={{
                                marginLeft: "8px",
                                color: "#dc3545",
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}>
                                ⏰ ATRASADA
                              </span>
                            )}
                          </div>

                          {sub.nota !== null && (
                            <div className={`tentativaNota ${sub.corrigida ? "corrigida" : ""}`}>
                              Nota: <strong>{sub.nota}/100</strong>
                            </div>
                          )}

                          <div className="tentativaData">
                            {new Date(sub.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>

                          {sub.verificacaoDescricao !== null && sub.verificacaoDescricao !== undefined && (
                            <div className="tentativaFeedback">
                              <strong>Aderencia ao esperado:</strong> {sub.verificacaoDescricao}%
                            </div>
                          )}

                          {sub.feedbackProfessor && (
                            <div className="tentativaFeedback">
                              <strong>Feedback:</strong> {sub.feedbackProfessor}
                            </div>
                          )}

                          <details className="tentativaDetalhes">
                            <summary>Ver resposta</summary>
                            <div className="tentativaResposta">
                              {sub.tipoResposta === "codigo" ? (
                                <pre>{sub.resposta}</pre>
                              ) : (
                                <p>{sub.resposta}</p>
                              )}
                            </div>
                          </details>
                        </div>
                      </FadeInUp>
                    ))}
                  </div>
                </div>
              </ConditionalFieldAnimation>

              {canReview && (
                <ConditionalFieldAnimation isVisible={true} duration={0.3}>
                  <div className="edCard edTentativas">
                    <h3 className="edSubtitle">📝 Respostas dos alunos ({submissoesRecebidas.length})</h3>

                    {loadingRecebidas ? (
                      <div style={{ padding: "20px", textAlign: "center" }}>
                        <PulseLoader size="small" color="var(--red)" text="Carregando respostas..." />
                      </div>
                    ) : submissoesRecebidas.length === 0 ? (
                      <div style={{ padding: "12px", opacity: 0.6, textAlign: "center" }}>
                        Nenhuma resposta enviada ainda.
                      </div>
                    ) : (
                      <div className="tentativasList">
                        {submissoesRecebidas.map((sub, idx) => (
                          <FadeInUp key={sub.id} delay={0.05 * (idx + 1)} duration={0.3}>
                            <div className="tentativaItem">
                              <div className="tentativaNumber">
                                {sub.alunoNome} <span style={{ opacity: 0.7 }}>@{sub.alunoUsuario}</span>
                              </div>

                              {sub.nota !== null && (
                                <div className={`tentativaNota ${sub.corrigida ? "corrigida" : ""}`}>
                                  Nota: <strong>{sub.nota}/100</strong>
                                </div>
                              )}

                              <div className="tentativaData">
                                {new Date(sub.createdAt).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>

                              {sub.verificacaoDescricao !== null && sub.verificacaoDescricao !== undefined && (
                                <div className="tentativaFeedback">
                                  <strong>Aderencia ao esperado:</strong> {sub.verificacaoDescricao}%
                                </div>
                              )}

                              {sub.feedbackProfessor && (
                                <div className="tentativaFeedback">
                                  <strong>Feedback:</strong> {sub.feedbackProfessor}
                                </div>
                              )}

                              <details className="tentativaDetalhes">
                                <summary>Ver resposta</summary>
                                <div className="tentativaResposta">
                                  {sub.tipoResposta === "codigo" ? (
                                    <pre>{sub.resposta}</pre>
                                  ) : (
                                    <p>{sub.resposta}</p>
                                  )}
                                </div>
                              </details>
                            </div>
                          </FadeInUp>
                        ))}
                      </div>
                    )}
                  </div>
                </ConditionalFieldAnimation>
              )}

            </div>

            {/* COLUNA DIREITA: RESPONDER */}
            <div className="exerciseDetailRight">
              <div className="edCard edResponder">
                <h2 className="edSubtitle">📝 Envie sua resposta</h2>


                {/* MENSAGENS */}
                <ConditionalFieldAnimation isVisible={!!erroSubmissao} duration={0.25}>
                  <div className="exMessage error">
                    <span>❌</span>
                    <span>{erroSubmissao}</span>
                  </div>
                </ConditionalFieldAnimation>

                <ConditionalFieldAnimation isVisible={!!sucessoMsg} duration={0.25}>
                  <div className="exMessage success">
                    <span>✅</span>
                    <span>{sucessoMsg}</span>
                  </div>
                </ConditionalFieldAnimation>

                <ConditionalFieldAnimation isVisible={!!avisoMsg} duration={0.25}>
                  <div className="exMessage warning">
                    <span>⚠️</span>
                    <span>{avisoMsg}</span>
                  </div>
                </ConditionalFieldAnimation>

                {/* RESPOSTA */}
                <div className="edInputGroup">
                  {/* Exercícios com Mouse Interativo - Baseado em tipo */}
                  {exercicio && tipoRenderizacao === "mouse" && (() => {
                    const mouseRegras = exercicio.mouse_regras
                      ? JSON.parse(exercicio.mouse_regras)
                      : { clicksSimples: 0, duplosClicks: 0, clicksDireitos: 0 };

                    return (
                      <div>
                        <div style={{ marginBottom: "20px", padding: "16px", background: "#f0f9ff", border: "1px solid #bfdbfe", borderRadius: "8px" }}>
                          {(mouseRegras.clicksSimples || mouseRegras.duplosClicks || mouseRegras.clicksDireitos) && (
                            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #bfdbfe" }}>
                              <p style={{ fontSize: 12, color: "#1e40af", margin: "0 0 6px 0", fontWeight: 600 }}>
                                🎯 Regras de Sucesso:
                              </p>
                              <ul style={{ fontSize: 12, color: "#1e40af", margin: 0, paddingLeft: "20px" }}>
                                {mouseRegras.clicksSimples > 0 && <li>🖱️ {mouseRegras.clicksSimples} cliques esquerdos</li>}
                                {mouseRegras.duplosClicks > 0 && <li>🖱️🖱️ {mouseRegras.duplosClicks} duplos cliques</li>}
                                {mouseRegras.clicksDireitos > 0 && <li>🖱️→ {mouseRegras.clicksDireitos} cliques direitos</li>}
                              </ul>
                            </div>
                          )}
                        </div>

                        <MouseInteractiveBox
                          title={exercicio.titulo}
                          instruction="Realize os cliques conforme as regras acima. Você verá seu progresso em tempo real!"
                          rules={mouseRegras}
                          onComplete={() => {
                            setMouseCompleted(true);
                            setSucessoMsg("✅ Parabéns! Você completou o desafio do Mouse!");
                          }}
                        />

                        <ConditionalFieldAnimation isVisible={mouseCompleted} duration={0.3}>
                          <div style={{ marginTop: "16px", padding: "12px", background: "#dcfce7", border: "1px solid #86efac", borderRadius: "8px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: 0 }}>
                              ✅ Desafio completado! Agora você pode enviar sua submissão.
                            </p>
                          </div>
                        </ConditionalFieldAnimation>

                        <textarea
                          className="edTextarea"
                          placeholder="Descreva sua experiência realizando este desafio de mouse..."
                          value={resposta}
                          onChange={(e) => setResposta(e.target.value)}
                          rows={6}
                          style={{ marginTop: "16px" }}
                        />
                      </div>
                    );
                  })()}

                  {/* EXERCÍCIOS COM MÚLTIPLA ESCOLHA */}
                  {exercicio && tipoRenderizacao === "multipla" && (() => {
                    const multiplaRegras = exercicio.multipla_regras
                      ? JSON.parse(exercicio.multipla_regras)
                      : { questoes: [] };

                    if (!multiplaRegras.questoes || multiplaRegras.questoes.length === 0) {
                      return (
                        <div style={{ padding: "16px", background: "#fee2e2", borderRadius: "8px" }}>
                          ⚠️ Este exercício não possui questões configuradas.
                        </div>
                      );
                    }

                    return (
                      <div>
                        {/* Instruções */}
                        <div style={{ padding: "16px", background: "#f0f9ff", borderRadius: "8px", marginBottom: "20px" }}>
                          <p style={{ fontWeight: 600, color: "#1e40af" }}>📋 {exercicio.descricao}</p>
                          <p style={{ fontSize: 12, color: "#1e40af" }}>
                            ℹ️ Responda todas as {multiplaRegras.questoes.length} questões
                          </p>
                        </div>

                        {/* Renderizar questões */}
                        {multiplaRegras.questoes.map((questao: any, index: number) => (
                          <FadeInUp key={index} delay={0.05 * (index + 1)} duration={0.3}>
                            <MultipleChoiceQuestion
                              question={`Q${index + 1}: ${questao.pergunta}`}
                              options={questao.opcoes}
                              selectedAnswer={respostasMultipla[`q${index}`]}
                              onAnswer={(answer) => {
                                setRespostasMultipla({ ...respostasMultipla, [`q${index}`]: answer });
                              }}
                            />
                          </FadeInUp>
                        ))}

                        {/* Progresso */}
                        <FadeInUp delay={0.1} duration={0.3}>
                          <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", marginTop: "16px" }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: 0 }}>
                              📊 Progresso: {Object.keys(respostasMultipla).length} / {multiplaRegras.questoes.length} respondidas
                            </p>
                          </div>
                        </FadeInUp>

                        {/* Campo opcional de comentário */}
                        <textarea
                          className="edTextarea"
                          placeholder="(Opcional) Deixe um comentário..."
                          value={resposta}
                          onChange={(e) => setResposta(e.target.value)}
                          rows={4}
                          style={{ marginTop: "16px" }}
                        />
                      </div>
                    );
                  })()}

                  {/* Exercícios de ATALHO */}
                  {exercicio && tipoRenderizacao === "atalho" && (() => {
                    const atalhoTipo = currentAtalhoTipo;

                    return (
                      <div>
                        <ShortcutTrainingBox
                          ref={shortcutBoxRef}
                          title="⌨️ Pratique o Atalho"
                          instruction={atalhoTipo === "copiar-colar" ? "Copie o texto abaixo (Ctrl+C) e cole no campo à direita (Ctrl+V)" : atalhoTipo === "selecionar-deletar" ? "Selecione todo o conteúdo abaixo e pressione Delete para completar" : "Clique com botão direito na imagem → Copiar imagem, depois cole no campo à direita"}
                          shortcutType={atalhoTipo}
                          sample={atalhoSample}
                          onComplete={(events) => {
                            console.log("Atalho completado:", events);
                            setAtalhoCompleted(true);
                          }}
                        />

                        <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>{atalhoTipo === "copiar-colar-imagens" ? "Imagem de exemplo" : "Texto de exemplo"}</label>

                            {atalhoTipo === "copiar-colar-imagens" ? (
                              <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <img
                                  src={atalhoSample}
                                  alt="Copie esta imagem"
                                  style={{ width: "100%", display: "block" }}
                                />
                              </div>
                            ) : atalhoTipo === "copiar-colar" ? (
                              <textarea
                                className="edTextarea"
                                readOnly
                                value={atalhoSample}
                                rows={6}
                                style={{ resize: "none", userSelect: "all" }}
                                onCopy={(e) => {
                                  const target = e.currentTarget;
                                  const start = target.selectionStart ?? 0;
                                  const end = target.selectionEnd ?? 0;
                                  const selectedText = target.value.substring(start, end);
                                  const normalizedSelected = selectedText.trim();
                                  const normalizedExpected = atalhoSample.trim();

                                  if (!normalizedSelected) {
                                    setAtalhoTextCopied(false);
                                    setAtalhoTextNotice("Selecione o texto inteiro antes de copiar.");
                                    setAtalhoTextNoticeType("error");
                                    return;
                                  }

                                  if (normalizedSelected !== normalizedExpected) {
                                    setAtalhoTextCopied(false);
                                    setAtalhoTextNotice("Copie o texto completo de exemplo para continuar.");
                                    setAtalhoTextNoticeType("error");
                                    return;
                                  }

                                  setAtalhoTextCopied(true);
                                  setAtalhoTextNotice("Texto copiado. Agora cole no campo ao lado.");
                                  setAtalhoTextNoticeType("info");
                                  shortcutBoxRef.current?.detectAction("copiar");
                                }}
                              />
                            ) : atalhoTipo === "selecionar-deletar" ? (
                              <div
                                ref={sampleRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={handleSampleInput}
                                className="edTextarea"
                                style={{ minHeight: 140, padding: 12, whiteSpace: "pre-wrap", outline: "none" }}
                              >
                                {atalhoSample}
                              </div>
                            ) : (
                              <textarea
                                className="edTextarea"
                                readOnly
                                value={atalhoSample}
                                rows={6}
                                style={{ resize: "vertical" }}
                              />
                            )}

                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                className="templateBtnView"
                                onClick={() => {
                                  if (atalhoTipo === "copiar-colar-imagens") {
                                    const svgImage = (color: string, text: string) =>
                                      `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><rect width="420" height="220" rx="12" fill="${color}"/><text x="210" y="110" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`)}`;
                                    const images = [
                                      svgImage("#4F46E5", "Imagem Exemplo 1"),
                                      svgImage("#059669", "Imagem Exemplo 2"),
                                      svgImage("#DC2626", "Imagem Exemplo 3")
                                    ];
                                    setAtalhoSample(images[Math.floor(Math.random() * images.length)]);
                                  } else {
                                    const texts = [
                                      "Copie este texto de exemplo: O rápido castor marrom salta sobre o cão preguiçoso.",
                                      "Selecione e cole: Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                                      "Exemplo: 12345 - teste rápido de copiar e colar!",
                                      "Frase exemplo: Digite ou cole exatamente este texto para treinar atalhos.",
                                      "Treino: Abacaxi, banana, uva, morango, limão."
                                    ];
                                    setAtalhoSample(texts[Math.floor(Math.random() * texts.length)]);
                                  }
                                  setAtalhoCompleted(false);
                                  setResposta("");
                                  setAtalhoTextCopied(false);
                                  setAtalhoTextNotice(null);
                                  setAtalhoTextNoticeType("info");
                                }}
                              >
                                🔁 Novo exemplo
                              </button>
                            </div>
                          </div>

                          {/* Campo onde usuário cola o texto/imagem */}
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>{atalhoTipo === "copiar-colar-imagens" ? "Cole a imagem aqui (Botão Direito → Colar)" : atalhoTipo === "copiar-colar" ? "Cole o texto aqui (Ctrl+V)" : atalhoTipo === "selecionar-deletar" ? "(Use a área esquerda para selecionar e apagar)" : "Cole aqui"}</label>

                            {atalhoTipo === "copiar-colar-imagens" ? (
                              <div
                                tabIndex={0}
                                onPaste={(e) => {
                                  const items = e.clipboardData?.items;
                                  if (!items) return;
                                  for (let i = 0; i < items.length; i++) {
                                    if (items[i].type.indexOf("image") !== -1) {
                                      const file = items[i].getAsFile();
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          setResposta(reader.result as string);
                                          setAtalhoCompleted(true);
                                          shortcutBoxRef.current?.detectAction("colar");
                                        };
                                        reader.readAsDataURL(file);
                                        e.preventDefault();
                                        return;
                                      }
                                    }
                                  }
                                  // Não aceitar texto no modo de copiar/colar imagem
                                }}
                                style={{
                                  minHeight: 220,
                                  padding: 20,
                                  borderRadius: 8,
                                  border: resposta ? "2px solid rgba(34,197,94,0.5)" : "2px dashed rgba(255,255,255,0.2)",
                                  background: resposta ? "rgba(34,197,94,0.05)" : "rgba(0,0,0,0.2)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 0.3s ease",
                                  cursor: "text",
                                  outline: "none"
                                }}
                              >
                                {resposta ? (
                                  resposta.startsWith("data:image") ? (
                                    <img src={resposta} alt="Imagem colada" style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} />
                                  ) : (
                                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "rgba(255,255,255,0.8)" }}>{resposta}</div>
                                  )
                                ) : (
                                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>🖱️</div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>Clique aqui com botão direito → Colar</div>
                                  </div>
                                )}
                              </div>
                            ) : atalhoTipo === "copiar-colar" ? (
                              <textarea
                                className="edTextarea"
                                placeholder="Cole o texto aqui (Ctrl+V)"
                                value={resposta}
                                readOnly
                                onPaste={(e) => {
                                  const text = e.clipboardData.getData("text/plain");
                                  const expected = atalhoSample.trim();
                                  const pasted = text.trim();
                                  const copiedOk = atalhoTextCopied;

                                  setResposta(text);
                                  if (!copiedOk) {
                                    setAtalhoCompleted(false);
                                    setAtalhoTextNotice("Primeiro copie o texto de exemplo antes de colar.");
                                    setAtalhoTextNoticeType("error");
                                  } else if (pasted !== expected) {
                                    setAtalhoCompleted(false);
                                    setAtalhoTextNotice("O texto colado n\u00e3o corresponde ao exemplo.");
                                    setAtalhoTextNoticeType("error");
                                  } else {
                                    setAtalhoCompleted(true);
                                    setAtalhoTextNotice("Texto colado corretamente!");
                                    setAtalhoTextNoticeType("success");
                                    shortcutBoxRef.current?.detectAction("colar");
                                  }
                                  e.preventDefault();
                                }}
                                rows={6}
                                style={{ resize: "none", border: atalhoCompleted ? "2px solid rgba(34,197,94,0.6)" : undefined }}
                              />
                            ) : atalhoTipo === "selecionar-deletar" ? (
                              <div style={{ marginTop: 6, color: "#9CA3AF", fontSize: 13 }}>
                                Selecione todo o texto à esquerda e pressione Delete ou Backspace para completar o exercício.
                              </div>
                            ) : (
                              <textarea
                                className="edTextarea"
                                placeholder="Cole o texto aqui após copiar o exemplo"
                                value={resposta}
                                onChange={(e) => setResposta(e.target.value)}
                                rows={6}
                                style={{ resize: "vertical" }}
                              />
                            )}

                            {atalhoTipo === "copiar-colar" && atalhoTextNotice && (
                              <div
                                style={{
                                  ...atalhoTextNoticeStyle,
                                  marginTop: 8,
                                  padding: "8px 10px",
                                  borderRadius: 6,
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                {atalhoTextNotice}
                              </div>
                            )}

                            <div style={{ marginTop: 8, color: atalhoCompleted ? "#166534" : "#6b7280", fontSize: 13 }}>
                              {atalhoCompleted ? "✅ Atalho completado" : "⏳ Complete o exercício de atalho para treinar"}
                            </div>
                            {atalhoAutoNotice && (
                              <div style={{ marginTop: 8, color: "#16a34a", fontSize: 13, fontWeight: 600 }}>
                                ✅ Resposta enviada automaticamente
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Exercícios tipo NENHUM - Seletor de tipo */}
                  {tipoExercicio === "nenhum" && !selectedTipoNenhum && (
                    <ConditionalFieldAnimation isVisible={true} duration={0.3}>
                      <div style={{
                        padding: "24px",
                        marginBottom: "24px",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        border: "2px solid rgba(59, 130, 246, 0.3)",
                        borderRadius: "12px",
                      }}>
                        <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#2563eb", fontSize: "18px", fontWeight: "600" }}>
                          📋 Selecione o tipo de resposta
                        </h3>
                        <p style={{ marginBottom: "20px", color: "var(--text)", fontSize: "14px" }}>
                          Escolha como você gostaria de responder este exercício:
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <button
                            onClick={() => setSelectedTipoNenhum("codigo")}
                            style={{
                              padding: "16px",
                              border: "2px solid rgba(59, 130, 246, 0.2)",
                              borderRadius: "8px",
                              backgroundColor: "var(--background-secondary)",
                              color: "#2563eb",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(59, 130, 246, 0.15)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--background-secondary)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                            }}
                          >
                            💻 Código
                          </button>
                          <button
                            onClick={() => setSelectedTipoNenhum("escrita")}
                            style={{
                              padding: "16px",
                              border: "2px solid rgba(139, 92, 246, 0.2)",
                              borderRadius: "8px",
                              backgroundColor: "var(--background-secondary)",
                              color: "#a855f7",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(168, 85, 247, 0.15)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--background-secondary)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                            }}
                          >
                            ✍️ Escrita
                          </button>
                          <button
                            onClick={() => setSelectedTipoNenhum("texto")}
                            style={{
                              padding: "16px",
                              border: "2px solid rgba(34, 197, 94, 0.2)",
                              borderRadius: "8px",
                              backgroundColor: "var(--background-secondary)",
                              color: "#22c55e",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(34, 197, 94, 0.15)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--background-secondary)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                            }}
                          >
                            📝 Digitação
                          </button>
                          <button
                            onClick={() => setSelectedTipoNenhum("multipla")}
                            style={{
                              padding: "16px",
                              border: "2px solid rgba(236, 72, 153, 0.2)",
                              borderRadius: "8px",
                              backgroundColor: "var(--background-secondary)",
                              color: "#ec4899",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(236, 72, 153, 0.15)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--background-secondary)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                            }}
                          >
                            ❓ Múltipla Escolha
                          </button>
                          <button
                            onClick={() => setSelectedTipoNenhum("mouse")}
                            style={{
                              padding: "16px",
                              border: "2px solid rgba(248, 113, 113, 0.2)",
                              borderRadius: "8px",
                              backgroundColor: "var(--background-secondary)",
                              color: "#f87171",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(248, 113, 113, 0.15)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--background-secondary)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                            }}
                          >
                            🖱️ Mouse Interativo
                          </button>
                          <button
                            onClick={() => setSelectedTipoNenhum("atalho")}
                            style={{
                              padding: "16px",
                              border: "2px solid rgba(251, 146, 60, 0.2)",
                              borderRadius: "8px",
                              backgroundColor: "var(--background-secondary)",
                              color: "#fb923c",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(251, 146, 60, 0.15)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--background-secondary)";
                              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                            }}
                          >
                            ⌨️ Atalho
                          </button>
                        </div>
                      </div>
                    </ConditionalFieldAnimation>
                  )}

                  {/* Exercícios normais de código */}
                  {(tipoExercicio === "codigo" || (tipoExercicio === "nenhum" && selectedTipoNenhum === "codigo")) && (
                    <>
                      <MonacoEditor
                        value={resposta}
                        onChange={(v) => setResposta(v || "")}
                        language={linguagem}
                        onLanguageChange={setLinguagem}
                        height="600px"
                        autoHeight
                        minHeight={600}
                        maxHeight={1200}
                        theme="dark"
                      />

                      {/* TESTE DE CÓDIGO */}
                      <AnimatedButton
                        className="edTestBtn"
                        onClick={handleTestarCodigo}
                        disabled={resposta.trim().length === 0 || linguagem !== "javascript"}
                      >
                        🧪 Testar Código
                      </AnimatedButton>

                      {/* OUTPUT DO TESTE */}
                      <ConditionalFieldAnimation isVisible={!!erroTeste} duration={0.3}>
                        <div className="edTestOutput error">
                          <div className="edTestLabel">❌ Erro:</div>
                          <pre>{erroTeste}</pre>
                        </div>
                      </ConditionalFieldAnimation>

                      <ConditionalFieldAnimation isVisible={!!outputTeste && !erroTeste} duration={0.3}>
                        <div className="edTestOutput success">
                          <div className="edTestLabel">✅ Output:</div>
                          <pre>{outputTeste}</pre>
                        </div>
                      </ConditionalFieldAnimation>
                    </>
                  )}

                  {/* Exercícios normais de texto */}
                  {(tipoExercicio === "texto" || (tipoExercicio === "nenhum" && selectedTipoNenhum === "texto")) && (
                    <textarea
                      className="edTextarea"
                      placeholder="Digite sua resposta aqui..."
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={12}
                    />
                  )}

                  {/* Exercícios de ESCRITA */}
                  {(tipoExercicio === "escrita" || (tipoExercicio === "nenhum" && selectedTipoNenhum === "escrita")) && (
                    <textarea
                      className="edTextarea"
                      placeholder="Escreva sua resposta aqui. Sua resposta será revisada pelo professor..."
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={12}
                    />
                  )}
                </div>

                {/* AVISO DE PRAZO VENCIDO */}
                <ConditionalFieldAnimation isVisible={prazoVencido} duration={0.3}>
                  <div style={{
                    padding: "12px",
                    marginBottom: "12px",
                    backgroundColor: "#f8d7da",
                    border: "1px solid #f5c6cb",
                    borderRadius: "4px",
                    color: "#721c24",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}>
                    ⏰ <strong>Prazo expirado:</strong> Não é mais possível enviar respostas para este exercício.
                  </div>
                </ConditionalFieldAnimation>

                {/* AVISO - Já enviou e não pode repetir */}
                <ConditionalFieldAnimation isVisible={jaEnviou} duration={0.3}>
                  <div style={{
                    padding: "14px 18px",
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: "10px",
                    color: "#166534",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}>
                    ✅ <strong>Resposta já enviada.</strong> Você já completou este exercício.
                  </div>
                </ConditionalFieldAnimation>

                {/* BOTÃO ENVIAR - Oculto para atalhos (auto-submit) e quando já enviou */}
                {tipoRenderizacao !== "atalho" && !jaEnviou && (
                  <AnimatedButton
                    className="edSubmitBtn"
                    onClick={handleEnviar}
                    disabled={
                      resposta.trim().length === 0 ||
                      prazoVencido ||
                      (tipoExercicio === "nenhum" && !selectedTipoNenhum)
                    }
                    loading={enviando}
                  >
                    {prazoVencido
                      ? "❌ Prazo Expirado"
                      : tipoExercicio === "nenhum" && !selectedTipoNenhum
                        ? "👇 Selecione um tipo acima"
                        : "✨ Enviar Resposta"}
                  </AnimatedButton>
                )}

                {/* DICA - Mostra apenas quando há um tipo selecionado */}
                {(tipoExercicio !== "nenhum" || (tipoExercicio === "nenhum" && selectedTipoNenhum)) && (
                  <div className="edHint">
                    {(tipoExercicio === "codigo" || (tipoExercicio === "nenhum" && selectedTipoNenhum === "codigo"))
                      ? "Escolha a linguagem no editor e escreva seu código."
                      : (tipoExercicio === "escrita" || (tipoExercicio === "nenhum" && selectedTipoNenhum === "escrita"))
                        ? "Sua resposta será avaliada pelo professor. Escreva de forma clara e completa."
                        : "Escreva sua resposta de forma clara e objetiva."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeInUp>

      {/* TOASTS */}
      <AnimatedToast
        message={sucessoMsg}
        type="success"
        onClose={() => setSucessoMsg(null)}
      />
      <AnimatedToast
        message={erroSubmissao}
        type="error"
        onClose={() => setErroSubmissao(null)}
      />
      <AnimatedToast
        message={avisoMsg}
        type="info"
        onClose={() => setAvisoMsg(null)}
      />
    </DashboardLayout>
  );
}
