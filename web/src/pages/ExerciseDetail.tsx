import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRole } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import MonacoEditor from "../components/MonacoEditor";
import MultipleChoiceQuestion from "../components/Exercise/MultipleChoiceQuestion";
import MouseInteractiveBox from "../components/Exercise/MouseInteractiveBox";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { AnimatedButton } from "../components/animate-ui/AnimatedButton";
import { AnimatedToast } from "../components/animate-ui/AnimatedToast";
import { ConditionalFieldAnimation } from "../components/animate-ui/ConditionalFieldAnimation";
import { PulseLoader } from "../components/animate-ui/PulseLoader";
import {
  obterExercicio,
  enviarSubmissao,
  minhasSubmissoes,
  listarSubmissoesExercicio,
  type Exercicio,
  type Submissao,
} from "../services/api";
import "./ExerciseDetail.css";

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

    const isMultipla = exercicio.titulo && /^Dia \d+: (Múltipla Escolha|Pergunta Múltipla)$/.test(exercicio.titulo);

    // Validação
    if (isMultipla) {
      const multiplaRegras = exercicio.multipla_regras ? JSON.parse(exercicio.multipla_regras) : { questoes: [] };
      const totalQuestoes = multiplaRegras.questoes?.length || 0;
      const respostasCount = Object.keys(respostasMultipla).length;

      if (respostasCount < totalQuestoes) {
        setErroSubmissao(`Por favor, responda todas as ${totalQuestoes} questões.`);
        return;
      }
    } else if (resposta.trim().length === 0) {
      setErroSubmissao("A resposta não pode estar vazia");
      return;
    }

    try {
      setEnviando(true);
      setErroSubmissao(null);
      setSucessoMsg(null);
      setAvisoMsg(null);

      const tipoResposta = exercicio.tipoExercicio || "texto";

      // Preparar resposta
      const respostaFinal = isMultipla
        ? JSON.stringify(respostasMultipla)
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
  const temaTema = exercicio.tema || "Sem tema";
  const tipoExercicio = exercicio.tipoExercicio || "texto";

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
                  <strong>{tipoExercicio === "codigo" ? "💻 Código" : "✍️ Digitação"}</strong>
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
                {/* Exercícios do Dia 1 - Navegação (Múltipla Escolha) */}
                {exercicio.titulo === "Dia 1: Navegação no Portal" && (
                  <div>
                    <MultipleChoiceQuestion
                      question="Q1: Onde fica o menu principal?"
                      options={[
                        { letter: "A", text: "No topo da página" },
                        { letter: "B", text: "Na barra lateral esquerda" },
                        { letter: "C", text: "No rodapé" },
                        { letter: "D", text: "Não existe menu" },
                      ]}
                      selectedAnswer={respostasMultipla.q1}
                      onAnswer={(answer) => setRespostasMultipla({ ...respostasMultipla, q1: answer })}
                    />

                    <MultipleChoiceQuestion
                      question="Q2: Onde você acessa as aulas?"
                      options={[
                        { letter: "A", text: 'Na aba "Trilha do Curso"' },
                        { letter: "B", text: 'Na aba "Materiais"' },
                        { letter: "C", text: 'Na aba "Videoaulas Bônus"' },
                        { letter: "D", text: 'Em "Dashboard"' },
                      ]}
                      selectedAnswer={respostasMultipla.q2}
                      onAnswer={(answer) => setRespostasMultipla({ ...respostasMultipla, q2: answer })}
                    />

                    <MultipleChoiceQuestion
                      question="Q3: Como você submete um exercício?"
                      options={[
                        { letter: "A", text: "Pelo menu de configurações" },
                        { letter: "B", text: "Clicando no botão de envio na página do exercício" },
                        { letter: "C", text: "Por email" },
                        { letter: "D", text: "Não é possível submeter" },
                      ]}
                      selectedAnswer={respostasMultipla.q3}
                      onAnswer={(answer) => setRespostasMultipla({ ...respostasMultipla, q3: answer })}
                    />

                    <MultipleChoiceQuestion
                      question="Q4: Qual aba mostra seu perfil e informações pessoais?"
                      options={[
                        { letter: "A", text: "Dashboard" },
                        { letter: "B", text: "Exercícios" },
                        { letter: "C", text: "Perfil" },
                        { letter: "D", text: "Turmas" },
                      ]}
                      selectedAnswer={respostasMultipla.q4}
                      onAnswer={(answer) => setRespostasMultipla({ ...respostasMultipla, q4: answer })}
                    />

                    <textarea
                      className="edTextarea"
                      placeholder="Descreva qual foi seu maior desafio ao responder essas questões..."
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={6}
                    />
                  </div>
                )}

                {/* Exercícios do Dia 1 - Conhecendo o Mouse (Interativo) */}
                {exercicio.titulo === "Dia 1: Conhecendo o Mouse" && (
                  <div>
                    <MouseInteractiveBox
                      title="🖱️ Pratique o uso do Mouse"
                      instruction="Clique, duplo-clique ou clique direito na caixa abaixo para praticar. Você verá cada ação registrada!"
                    />

                    <textarea
                      className="edTextarea"
                      placeholder="Descreva qual foi seu maior desafio ao usar o mouse..."
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={6}
                    />
                  </div>
                )}

                {/* Exercícios do Dia 1 - Clique Consciente (Interativo) */}
                {exercicio.titulo === "Dia 1: Clique Consciente" && (
                  <div>
                    <MouseInteractiveBox
                      title="👆 Pratique Diferentes Tipos de Cliques"
                      instruction="Faça cliques simples, duplos e direitos na caixa abaixo para praticar e aprender!"
                    />

                    <textarea
                      className="edTextarea"
                      placeholder="Descreva: Qual tipo de clique foi mais fácil? Qual foi mais desafiador? Perdeu o medo?"
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={6}
                    />
                  </div>
                )}

                {/* NOVO: Exercícios com Mouse Interativo criados dinamicamente */}
                {exercicio && /^Dia \d+: Mouse$/.test(exercicio.titulo) && (() => {
                  const mouseRegras = exercicio.mouse_regras
                    ? JSON.parse(exercicio.mouse_regras)
                    : { clicksSimples: 0, duplosClicks: 0, clicksDireitos: 0 };

                  return (
                    <div>
                      <div style={{ marginBottom: "20px", padding: "16px", background: "#f0f9ff", border: "1px solid #bfdbfe", borderRadius: "8px" }}>
                        <p style={{ fontSize: 14, color: "#1e40af", margin: "0 0 8px 0", fontWeight: 600 }}>
                          📋 Descrição do Desafio:
                        </p>
                        <p style={{ fontSize: 13, color: "#1e40af", margin: 0 }}>
                          {exercicio.descricao}
                        </p>
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
                {exercicio && /^Dia \d+: (Múltipla Escolha|Pergunta Múltipla)$/.test(exercicio.titulo) && (() => {
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

                {/* Exercícios normais de código */}
                {!exercicio.titulo.match(/^Dia \d+: (Mouse|Múltipla Escolha|Pergunta Múltipla)$/) && tipoExercicio === "codigo" && (
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
                {!exercicio.titulo.match(/^Dia \d+: (Mouse|Múltipla Escolha|Pergunta Múltipla)$/) && tipoExercicio === "texto" && (
                  <textarea
                    className="edTextarea"
                    placeholder="Digite sua resposta aqui..."
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

              {/* BOTÃO ENVIAR */}
              <AnimatedButton
                className="edSubmitBtn"
                onClick={handleEnviar}
                disabled={resposta.trim().length === 0 || prazoVencido}
                loading={enviando}
              >
                {prazoVencido ? "❌ Prazo Expirado" : "✨ Enviar Resposta"}
              </AnimatedButton>

              <div className="edHint">
                {tipoExercicio === "codigo"
                  ? "Escolha a linguagem no editor e escreva seu código."
                  : "Escreva sua resposta de forma clara e objetiva."}
              </div>
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
