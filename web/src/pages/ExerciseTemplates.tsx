import React from "react";
import { useNavigate } from "react-router-dom";
import { getRole } from "../auth/auth";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { AnimatedButton } from "../components/animate-ui/AnimatedButton";
import { AnimatedToast } from "../components/animate-ui/AnimatedToast";
import { ConditionalFieldAnimation } from "../components/animate-ui/ConditionalFieldAnimation";
import { apiFetch, type Turma } from "../services/api";
import "./ExerciseTemplates.css";

type Template = {
  id: string;
  titulo: string;
  descricao: string;
  modulo: string;
  tema: string | null;
  categoria: string;
  tipoExercicio: string;
  createdAt: string;
};

export default function ExerciseTemplates() {
  const navigate = useNavigate();
  const role = getRole();

  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [duplicando, setDuplicando] = React.useState<string | null>(null);
  const [deletando, setDeletando] = React.useState<string | null>(null);

  // Modal para enviar tarefa
  const [modalAberto, setModalAberto] = React.useState(false);
  const [templateSelecionado, setTemplateSelecionado] = React.useState<string | null>(null);
  const [turmas, setTurmas] = React.useState<Turma[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [semanaSelecionada, setSemanaSelecionada] = React.useState<number>(1);
  const [enviandoTarefa, setEnviandoTarefa] = React.useState(false);
  const [carregandoTurmas, setCarregandoTurmas] = React.useState(false);
  const [turmaBuscaFiltro, setTurmaBuscaFiltro] = React.useState("");

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Carregar templates
  React.useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{ templates: Template[] }>("/templates");
        setTemplates(data.templates);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar templates");
      } finally {
        setLoading(false);
      }
    })();
  }, [role, navigate]);

  const handleDuplicar = async (templateId: string, templateTitulo: string) => {
    const novoTitulo = prompt(
      "Digite o nome do novo exercício:",
      `${templateTitulo} (Cópia)`
    );

    if (!novoTitulo) return;

    try {
      setDuplicando(templateId);
      const response = await apiFetch<any>(
        `/templates/${templateId}/duplicate`,
        {
          method: "POST",
          body: JSON.stringify({ nova_titulo: novoTitulo }),
        }
      );

      setMensagem("✅ Exercício duplicado com sucesso! Redirecionando...");
      setTimeout(() => {
        navigate(`/dashboard/exercicios/${response.exercicio.id}`);
      }, 1500);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao duplicar template");
    } finally {
      setDuplicando(null);
    }
  };

  const handleDeletar = async (templateId: string, templateTitulo: string) => {
    if (!window.confirm(`Tem certeza que deseja deletar o template "${templateTitulo}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setDeletando(templateId);
      setErro(null);
      await apiFetch(`/exercicios/${templateId}`, {
        method: "DELETE",
      });

      setMensagem("✅ Template deletado com sucesso!");
      setTemplates(templates.filter(t => t.id !== templateId));
      setTimeout(() => setMensagem(null), 3000);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao deletar template");
    } finally {
      setDeletando(null);
    }
  };

  const abrirModalEnviarTarefa = async (templateId: string) => {
    try {
      setCarregandoTurmas(true);
      setErro(null);
      // Buscar template para pegar categoria
      const templateAtual = templates.find(t => t.id === templateId);
      const data = await apiFetch<Turma[]>("/turmas");

      // Categoria padrão é "programacao"
      const categoriaTemplate = templateAtual?.categoria || "programacao";

      // Filtrar apenas turmas com cronograma ativo e mesma categoria
      const turmasComCronograma = data.filter(t => {
        const categoriaTurma = t.categoria || "programacao";
        return t.dataInicio && t.cronogramaAtivo && categoriaTurma === categoriaTemplate;
      });

      setTurmas(turmasComCronograma);
      setTemplateSelecionado(templateId);
      setTurmasSelecionadas([]);
      setSemanaSelecionada(1);
      setTurmaBuscaFiltro("");
      setModalAberto(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar turmas");
    } finally {
      setCarregandoTurmas(false);
    }
  };

  const handleEnviarTarefa = async () => {
    if (!templateSelecionado || turmasSelecionadas.length === 0) {
      setErro("Selecione pelo menos uma turma");
      return;
    }

    try {
      setEnviandoTarefa(true);
      setErro(null);

      // Enviar para cada turma selecionada
      for (const turmaId of turmasSelecionadas) {
        await apiFetch(`/turmas/${turmaId}/cronograma`, {
          method: "POST",
          body: JSON.stringify({
            semanas: [
              {
                semana: semanaSelecionada,
                exercicios: [templateSelecionado],
              },
            ],
          }),
        });
      }

      setMensagem(`✅ Tarefa enviada para ${turmasSelecionadas.length} turma(s)!`);
      setModalAberto(false);
      setTemplateSelecionado(null);
      setTurmasSelecionadas([]);
      setTurmaBuscaFiltro("");

      setTimeout(() => setMensagem(null), 3000);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao enviar tarefa");
    } finally {
      setEnviandoTarefa(false);
    }
  };

  if (role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout title="Templates de Exercícios" subtitle="Carregando...">
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div className="spinner" />
          Carregando templates...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="📦 Templates de Exercícios"
      subtitle="Gerenciar exercícios pré-prontos reutilizáveis"
    >
      <FadeInUp duration={0.28}>
        <div className="templatesContainer">
          <FadeInUp duration={0.28} delay={0.08}>
            <div className="templatesHeader">
              <p className="templatesDescription">
                Templates são exercícios pré-prontos que você pode duplicar e reutilizar em múltiplas turmas.
                Economize tempo criando uma biblioteca de exercícios!
              </p>
              <AnimatedButton
                className="btnCreateTemplate"
                onClick={() => navigate("/dashboard/exercicios")}
              >
                ✨ Criar Novo Template
              </AnimatedButton>
            </div>
          </FadeInUp>

          {/* MENSAGENS */}
          <AnimatedToast
            message={erro || null}
            type="error"
            duration={4000}
            onClose={() => setErro(null)}
          />

          <AnimatedToast
            message={mensagem || null}
            type="success"
            duration={3000}
            onClose={() => setMensagem(null)}
          />

          {/* TEMPLATES */}
          {templates.length === 0 ? (
            <FadeInUp duration={0.28} delay={0.16}>
              <div className="templateEmpty">
                <div className="templateEmptyIcon">📋</div>
                <h3>Nenhum template criado ainda</h3>
                <p>Vá para Exercícios e marque exercícios como templates para reutilizá-los!</p>
                <AnimatedButton
                  className="btnGoToExercises"
                  onClick={() => navigate("/dashboard/exercicios")}
                >
                  → Ir para Exercícios
                </AnimatedButton>
              </div>
            </FadeInUp>
          ) : (
            <>
              {(() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedTemplates = templates.slice(startIndex, endIndex);

                return (
                  <>
                    <FadeInUp duration={0.28} delay={0.16}>
                      <div className="templatesGrid">
                        {paginatedTemplates.map((template, idx) => (
                          <FadeInUp key={template.id} duration={0.28} delay={0.16 + idx * 0.04}>
                            <div className="templateCard">
                              <div className="templateCardHeader">
                                <div className="templateInfo">
                                  <h3 className="templateTitle">{template.titulo}</h3>
                                  <p className="templateMeta">
                                    <span className="templateModule">{template.modulo}</span>
                                    {template.tema && <span className="templateTheme">{template.tema}</span>}
                                    <span className={`templateCategory category-${template.categoria}`}>
                                      {template.categoria === "informatica" ? "💻 Informática" : "🖥️ Programação"}
                                    </span>
                                    <span className={`templateType type-${template.tipoExercicio}`}>
                                      {template.tipoExercicio === "codigo" ? "💻 Código" : "✍️ Texto"}
                                    </span>
                                  </p>
                                </div>
                                <AnimatedButton
                                  className="templateIconBtn"
                                  title="Duplicar template"
                                  onClick={() => handleDuplicar(template.id, template.titulo)}
                                  disabled={duplicando === template.id}
                                  loading={duplicando === template.id}
                                >
                                  {duplicando === template.id ? "⏳" : "📋"}
                                </AnimatedButton>
                              </div>

                              <p className="templateDescription">
                                {template.descricao.substring(0, 150)}
                                {template.descricao.length > 150 ? "..." : ""}
                              </p>

                              <div className="templateFooter">
                                <span className="templateDate">
                                  {new Date(template.createdAt).toLocaleDateString("pt-BR")}
                                </span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <AnimatedButton
                                    className="templateBtnView"
                                    onClick={() => abrirModalEnviarTarefa(template.id)}
                                    title="Enviar template para turmas"
                                  >
                                    📤 Enviar
                                  </AnimatedButton>
                                  <AnimatedButton
                                    className="templateBtnView"
                                    onClick={() => navigate(`/dashboard/exercicios/${template.id}`)}
                                  >
                                    Ver →
                                  </AnimatedButton>
                                  <AnimatedButton
                                    className="templateBtnView"
                                    onClick={() => handleDeletar(template.id, template.titulo)}
                                    disabled={deletando === template.id}
                                    loading={deletando === template.id}
                                    title="Deletar template"
                                    style={{
                                      background: "rgba(225, 29, 46, 0.1)",
                                      color: "var(--red)",
                                    }}
                                  >
                                    {deletando === template.id ? "⏳" : "🗑️"}
                                  </AnimatedButton>
                                </div>
                              </div>
                            </div>
                          </FadeInUp>
                        ))}
                      </div>
                    </FadeInUp>

                    <FadeInUp duration={0.28} delay={0.24}>
                      <Pagination
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={templates.length}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                      />
                    </FadeInUp>
                </>
              );
            })()}
          </>
        )}

          {/* MODAL ENVIAR TAREFA */}
          <ConditionalFieldAnimation isVisible={modalAberto}>
            {(() => {
              const templateAtual = templates.find(t => t.id === templateSelecionado);
              const isInformatica = templateAtual?.categoria === "informatica";
              return (
                <div className="modalOverlay" onClick={() => {
                  setModalAberto(false);
                  setTurmaBuscaFiltro("");
                }}>
                  <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                    <FadeInUp duration={0.28}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0 }}>📤 Enviar Template para Turmas</h3>
                        {templateAtual && (
                          <span style={{
                            padding: "4px 12px",
                            background: isInformatica ? "rgba(59, 130, 246, 0.15)" : "rgba(34, 197, 94, 0.15)",
                            color: isInformatica ? "#3b82f6" : "#22c55e",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}>
                            {isInformatica ? "💻 Informática" : "🖥️ Programação"}
                          </span>
                        )}
                      </div>
                    </FadeInUp>

                {carregandoTurmas ? (
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <div className="spinner" />
                    Carregando turmas...
                  </div>
                ) : (
                  <>
                    {erro && (
                      <div style={{ padding: "12px", background: "rgba(225, 29, 46, 0.1)", borderRadius: "4px", marginBottom: "16px", color: "var(--red)" }}>
                        ❌ {erro}
                      </div>
                    )}

                  {turmas.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)" }}>
                      <p>Nenhuma turma com cronograma ativo encontrada.</p>
                      <small>
                        {isInformatica
                          ? "Configure turmas de Informática com cronograma ativo."
                          : "Configure turmas de Programação com cronograma ativo."}
                      </small>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: "12px", background: isInformatica ? "rgba(59, 130, 246, 0.1)" : "rgba(34, 197, 94, 0.1)", borderRadius: "4px", marginBottom: "16px", fontSize: "13px", color: isInformatica ? "#3b82f6" : "#22c55e" }}>
                        📚 Mostrando turmas de <strong>{isInformatica ? "Informática" : "Programação"}</strong> com cronograma ativo
                      </div>

                      <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                          Semana:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={semanaSelecionada}
                          onChange={(e) => setSemanaSelecionada(Number(e.target.value))}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            fontSize: "14px",
                          }}
                        />
                        <small style={{ color: "var(--muted)" }}>Semana em que o exercício será liberado</small>
                      </div>

                      <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                          Turmas ({turmasSelecionadas.length} selecionada{turmasSelecionadas.length !== 1 ? "s" : ""}):
                        </label>
                        <input
                          type="text"
                          placeholder="🔍 Buscar turmas..."
                          value={turmaBuscaFiltro}
                          onChange={(e) => setTurmaBuscaFiltro(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            fontSize: "14px",
                            marginBottom: "12px",
                          }}
                        />
                        <div style={{ maxHeight: "250px", overflow: "auto", border: "1px solid var(--border)", borderRadius: "4px" }}>
                          {turmas
                            .filter((turma) =>
                              turma.nome.toLowerCase().includes(turmaBuscaFiltro.toLowerCase())
                            )
                            .map((turma) => (
                            <label
                              key={turma.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "12px",
                                borderBottom: "1px solid var(--border)",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={turmasSelecionadas.includes(turma.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTurmasSelecionadas([...turmasSelecionadas, turma.id]);
                                  } else {
                                    setTurmasSelecionadas(turmasSelecionadas.filter((id) => id !== turma.id));
                                  }
                                }}
                                style={{ marginRight: "12px", width: "18px", height: "18px", cursor: "pointer" }}
                              />
                              <div>
                                <div style={{ fontWeight: 500 }}>{turma.nome}</div>
                                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                                  Início: {new Date(turma.dataInicio!).toLocaleDateString("pt-BR")}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

                    <FadeInUp duration={0.28} delay={0.12}>
                      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
                        <AnimatedButton
                          onClick={() => {
                            setModalAberto(false);
                            setTurmaBuscaFiltro("");
                          }}
                          disabled={enviandoTarefa}
                          style={{
                            padding: "10px 16px",
                            background: "var(--border)",
                            border: "none",
                            borderRadius: "4px",
                            cursor: enviandoTarefa ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Cancelar
                        </AnimatedButton>
                        <AnimatedButton
                          onClick={handleEnviarTarefa}
                          disabled={enviandoTarefa || turmasSelecionadas.length === 0}
                          loading={enviandoTarefa}
                          style={{
                            padding: "10px 16px",
                            background: "var(--primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: enviandoTarefa || turmasSelecionadas.length === 0 ? "not-allowed" : "pointer",
                            fontWeight: 600,
                            opacity: (enviandoTarefa || turmasSelecionadas.length === 0) ? 0.6 : 1,
                          }}
                        >
                          {enviandoTarefa ? "⏳ Enviando..." : "📤 Enviar Tarefa"}
                        </AnimatedButton>
                      </div>
                    </FadeInUp>
                  </div>
                </div>
              );
            })()}
          </ConditionalFieldAnimation>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
