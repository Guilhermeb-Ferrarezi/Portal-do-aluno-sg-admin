import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { hasRole } from "../auth/auth";
import {
  FadeInUp,
  PopInBadge,
  PulseLoader,
  AnimatedButton,
  AnimatedToast,
  AnimatedSelect,
  AnimatedRadioLabel,
} from "../components/animate-ui";
import {
  listarTurmas,
  listarAlunos,
  listarVideoaulas,
  criarVideoaula,
  deletarVideoaula,
  atribuirVideoaulaTurmas,
  type Turma,
  type User,
} from "../services/api";
import "./VideoaulaBonus.css";

type Videoaula = {
  id: string;
  titulo: string;
  descricao: string | null;
  modulo: string;
  duracao?: string | null;
  tipo: "youtube" | "vimeo" | "arquivo";
  url: string;
  arquivo?: string;
  thumbnail?: string;
  dataAdicionada?: string;
  createdAt?: string;
  createdBy?: string | null;
  updatedAt?: string;
  turmas?: Turma[];
};

export default function VideoaulaBonusPage() {
  const canUpload = hasRole(["admin", "professor"]);

  // Estados
  const [videoaulas, setVideoaulas] = React.useState<Videoaula[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filtroModulo, setFiltroModulo] = React.useState<string>("todos");
  const [busca, setBusca] = React.useState<string>("");
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>("todas");
  const [modalAberto, setModalAberto] = React.useState(false);
  const [videoSelecionado, setVideoSelecionado] = React.useState<Videoaula | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [modoAtribuicao, setModoAtribuicao] = React.useState<"turma" | "aluno">("turma");
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunoFiltro, setAlunoFiltro] = React.useState<string>("");
  const [toastMsg, setToastMsg] = React.useState<{type: 'success'|'error'; msg: string} | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Videoaula | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  const [formData, setFormData] = React.useState({
    titulo: "",
    descricao: "",
    modulo: "",
    tipo: "youtube" as "youtube" | "vimeo" | "arquivo",
    url: "",
    arquivo: null as File | null,
    duracao: "",
  });

  // Videoaulas de exemplo (fallback)
  const videoaulasExemplo: Videoaula[] = [
    {
      id: "1",
      titulo: "Introdução ao Projeto",
      descricao: "Visão geral do projeto e objetivos",
      modulo: "Fundamentos",
      tipo: "youtube",
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    },
  ];

  // Carregar videoaulas da API
  React.useEffect(() => {
    carregarVideoaulas();
  }, []);

  const carregarVideoaulas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarVideoaulas();
      // Se não houver videoaulas da API, usar exemplos
      if (data.length === 0) {
        setVideoaulas(videoaulasExemplo);
      } else {
        setVideoaulas(data);
      }
    } catch (err) {
      console.error("Erro ao carregar videoaulas:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar videoaulas");
      // Se der erro, usar exemplos locais
      setVideoaulas(videoaulasExemplo);
    } finally {
      setLoading(false);
    }
  };

  // Carregar turmas e alunos quando puder fazer upload
  React.useEffect(() => {
    if (canUpload) {
      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((err) => console.error("Erro ao carregar turmas:", err));

      listarAlunos()
        .then(setAlunosDisponiveis)
        .catch((err) => console.error("Erro ao carregar alunos:", err));
    }
  }, [canUpload]);

  // Filtrar videoaulas
  const videoaulasFiltradas = videoaulas.filter((v) => {
    const matchModulo =
      filtroModulo === "todos" || v.modulo === filtroModulo;
    const matchBusca =
      busca === "" ||
      v.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (v.descricao && v.descricao.toLowerCase().includes(busca.toLowerCase()));
    const matchTurma =
      turmaFiltro === "todas" ||
      (v.turmas && v.turmas.some((t) => t.id === turmaFiltro)) ||
      !v.turmas ||
      v.turmas.length === 0; // Videoaulas sem turma visíveis para todos

    return matchModulo && matchBusca && matchTurma;
  });

  // Obter lista única de módulos
  const modulos = Array.from(new Set(videoaulas.map((v) => v.modulo)));

  const handleAssistir = (videoaula: Videoaula) => {
    setVideoSelecionado(videoaula);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({
        ...formData,
        arquivo: file,
      });
    }
  };

  const handleAddVideoaula = async () => {
    if (
      !formData.titulo.trim() ||
      !formData.modulo.trim() ||
      !formData.duracao.trim()
    ) {
      setToastMsg({
        type: "error",
        msg: "Por favor, preencha todos os campos obrigatórios",
      });
      return;
    }

    if ((formData.tipo === "youtube" || formData.tipo === "vimeo") && !formData.url.trim()) {
      setToastMsg({
        type: "error",
        msg: `Por favor, cole a URL do ${formData.tipo === "youtube" ? "YouTube" : "Vimeo"}`,
      });
      return;
    }

    if (formData.tipo === "arquivo" && !formData.arquivo) {
      setToastMsg({
        type: "error",
        msg: "Por favor, selecione um arquivo de vídeo",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Preparar FormData para envio
      const formDataToSend = new FormData();
      formDataToSend.append("titulo", formData.titulo);
      formDataToSend.append("descricao", formData.descricao);
      formDataToSend.append("modulo", formData.modulo);
      formDataToSend.append("duracao", formData.duracao);
      formDataToSend.append("tipo", formData.tipo);

      if (formData.tipo === "arquivo" && formData.arquivo) {
        formDataToSend.append("file", formData.arquivo);
      } else if (formData.tipo === "youtube" || formData.tipo === "vimeo") {
        formDataToSend.append("url", formData.url);
      }

      // Adicionar turmas se selecionadas
      if (modoAtribuicao === "turma" && turmasSelecionadas.length > 0) {
        formDataToSend.append("turma_ids", JSON.stringify(turmasSelecionadas));
      }

      // Enviar para API
      const resultado = await criarVideoaula(formDataToSend);

      // Atribuir turmas se necessário
      if (turmasSelecionadas.length > 0 && resultado.videoaula?.id) {
        try {
          await atribuirVideoaulaTurmas(resultado.videoaula.id, turmasSelecionadas);
        } catch (err) {
          console.error("Erro ao atribuir turmas:", err);
        }
      }

      // Recarregar lista de videoaulas
      await carregarVideoaulas();

      // Resetar formulário
      setFormData({
        titulo: "",
        descricao: "",
        modulo: "",
        tipo: "youtube",
        url: "",
        arquivo: null,
        duracao: "",
      });
      setTurmasSelecionadas([]);
      setAlunosSelecionados([]);
      setModoAtribuicao("turma");

      setModalAberto(false);
      setToastMsg({
        type: "success",
        msg: "Videoaula adicionada com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao adicionar videoaula:", err);
      setToastMsg({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao adicionar videoaula",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;

    try {
      setDeleting(true);
      await deletarVideoaula(target.id);
      setDeleteTarget(null);
      setToastMsg({
        type: "success",
        msg: `"${target.titulo}" foi removido.`,
      });
      await carregarVideoaulas();
    } catch (err) {
      setToastMsg({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao deletar videoaula",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <DashboardLayout
        title="Videoaulas Bônus"
        subtitle="Aprenda ainda mais com essas aulas extras"
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <PulseLoader size="large" text="Carregando videoaulas..." />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout
        title="Videoaulas Bônus"
        subtitle="Aprenda ainda mais com essas aulas extras"
      >
        <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>
          <p>Erro: {error}</p>
          <button onClick={carregarVideoaulas}>Tentar novamente</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Videoaulas Bônus"
      subtitle="Aprenda ainda mais com essas aulas extras"
    >
      <FadeInUp duration={0.28}>
        <div className="videoaulasContainer">
          <AnimatedToast
            message={toastMsg?.msg || null}
            type={toastMsg?.type || 'success'}
            duration={3000}
            onClose={() => setToastMsg(null)}
          />

          {/* HEADER COM FILTROS */}
          <div className="videoaulasHeader">
          <div className="filtrosRow">
            {/* Busca */}
            <div className="searchBox">
              <input
                type="text"
                placeholder="🔍 Buscar videoaulas..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="searchInput"
              />
            </div>

            {/* Filtro de Módulo */}
            <AnimatedSelect
              value={filtroModulo}
              onChange={(e) => setFiltroModulo(e.target.value)}
              className="filterSelect"
            >
              <option value="todos">Todos os módulos</option>
              {modulos.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </AnimatedSelect>

            {/* Filtro de Turmas */}
            <AnimatedSelect
              value={turmaFiltro}
              onChange={(e) => setTurmaFiltro(e.target.value)}
              className="filterSelect"
            >
              <option value="todas">👥 Todas as turmas</option>
              {turmasDisponiveis.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </AnimatedSelect>
          </div>

          {/* Botão de Upload (apenas para admin/professor) */}
          {canUpload && (
            <AnimatedButton
              className="uploadBtn"
              onClick={() => setModalAberto(true)}
            >
              ➕ Adicionar Videoaula
            </AnimatedButton>
          )}
        </div>

        {/* GRID DE VIDEOAULAS */}
        <div>
          {videoaulasFiltradas.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon">🎬</div>
              <div className="emptyTitle">
                {videoaulas.length === 0
                  ? "Nenhuma videoaula disponível"
                  : "Nenhuma videoaula encontrada"}
              </div>
              <p className="emptyText">
                {videoaulas.length === 0
                  ? "Em breve serão adicionadas videoaulas extras."
                  : "Tente ajustar seus filtros de busca."}
              </p>
            </div>
          ) : (
            <>
              {(() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedVideoaulas = videoaulasFiltradas.slice(
                  startIndex,
                  endIndex
                );

                return (
                  <>
                    <div className="videoaulasGrid">
                      {paginatedVideoaulas.map((videoaula, index) => (
                        <FadeInUp key={videoaula.id} delay={index * 0.05}>
                        <div className="videoaulaCard">
                  <div
                    className="videoaulaThumbnail"
                    onClick={() => handleAssistir(videoaula)}
                  >
                    <img
                      src={videoaula.thumbnail || "https://via.placeholder.com/320x180"}
                      alt={videoaula.titulo}
                    />
                    <div className="playButton">▶</div>
                    <span className="duracao">{videoaula.duracao}</span>
                  </div>

                  <div className="videoaulaContent">
                    <div className="metaBadge">{videoaula.modulo}</div>
                    <h3 className="videoaulaTitulo">{videoaula.titulo}</h3>
                    <p className="videoaulaDescricao">{videoaula.descricao}</p>

                    {/* Badges de acesso/turmas */}
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      {videoaula.turmas && videoaula.turmas.length > 0 ? (
                        <>
                          <PopInBadge delay={0.1}>
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
                            🏛️ {videoaula.turmas.length} turma{videoaula.turmas.length > 1 ? "s" : ""}
                          </span>
                          </PopInBadge>
                          {videoaula.turmas.map((turma, idx) => (
                            <PopInBadge key={turma.id} delay={0.2 + idx * 0.1}>
                            <span
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
                            </PopInBadge>
                          ))}
                        </>
                      ) : (
                        <PopInBadge delay={0.1}>
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
                        </PopInBadge>
                      )}
                    </div>

                    <div className="videoaulaFooter">
                      <span className="dataBadge">
                        {new Date(videoaula.dataAdicionada || videoaula.createdAt || new Date()).toLocaleDateString(
                          "pt-BR"
                        )}
                      </span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <AnimatedButton
                          className="assistirBtn"
                          onClick={() => handleAssistir(videoaula)}
                        >
                          ▶️ Assistir
                        </AnimatedButton>
                        {canUpload && (
                          <AnimatedButton
                            className="deleteBtn"
                            onClick={() => setDeleteTarget(videoaula)}
                            title="Deletar"
                          >
                            🗑️
                          </AnimatedButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                        </FadeInUp>
                      ))}
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={videoaulasFiltradas.length}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* MODAL DE VIDEOAULA */}
        <Modal
          isOpen={videoSelecionado !== null}
          onClose={() => setVideoSelecionado(null)}
          title={videoSelecionado?.titulo || "Videoaula"}
          size="lg"
        >
          <div style={{ marginBottom: '24px' }}>
            <div className="videoContainer">
              {videoSelecionado?.tipo === "youtube" ? (
                <iframe
                  width="100%"
                  height="400"
                  src={videoSelecionado?.url || ""}
                  title={videoSelecionado?.titulo || ""}
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : videoSelecionado?.tipo === "vimeo" ? (
                <iframe
                  width="100%"
                  height="400"
                  src={videoSelecionado?.url || ""}
                  title={videoSelecionado?.titulo || ""}
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  width="100%"
                  height="400"
                  controls
                  style={{ backgroundColor: "#000" }}
                >
                  <source
                    src={videoSelecionado?.url || ""}
                    type="video/mp4"
                  />
                  Seu navegador não suporta a tag de vídeo.
                </video>
              )}
            </div>
          </div>

          <div className="videoInfo" style={{ padding: '0' }}>
            <div className="infoRow">
              <span className="modulo">{videoSelecionado?.modulo}</span>
              <span className="duracao">⏱️ {videoSelecionado?.duracao}</span>
            </div>
            <p className="descricao">{videoSelecionado?.descricao}</p>
            <div className="infoFooter">
              <span className="data">
                Adicionada em{" "}
                {new Date(videoSelecionado?.dataAdicionada || videoSelecionado?.createdAt || new Date()).toLocaleDateString(
                  "pt-BR"
                )}
              </span>
            </div>
          </div>
        </Modal>

        {/* MODAL DE UPLOAD */}
        <Modal
          isOpen={modalAberto && canUpload}
          onClose={() => setModalAberto(false)}
          title="Adicionar Nova Videoaula"
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <AnimatedButton
                onClick={() => setModalAberto(false)}
                disabled={submitting}
                style={{
                  background: 'var(--background-secondary)',
                  color: 'var(--text)',
                  border: '1px solid var(--line)',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </AnimatedButton>
              <AnimatedButton
                onClick={handleAddVideoaula}
                disabled={submitting}
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {submitting ? 'Adicionando...' : 'Adicionar'}
              </AnimatedButton>
            </div>
          }
        >
              <div className="formGroup">
                <label className="formLabel">Título *</label>
                <input
                  type="text"
                  placeholder="Título da videoaula"
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  className="formInput"
                />
              </div>

              <div className="formGroup">
                <label className="formLabel">Módulo *</label>
                <AnimatedSelect
                  value={formData.modulo}
                  onChange={(e) =>
                    setFormData({ ...formData, modulo: e.target.value })
                  }
                  className="formInput"
                >
                  <option value="">Selecione um módulo</option>
                  {modulos.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                  <option value="novo">+ Novo Módulo</option>
                </AnimatedSelect>
              </div>

              <div className="formGroup">
                <label className="formLabel">Tipo *</label>
                <div className="radioGroup">
                  <label className="radioLabel">
                    <input
                      type="radio"
                      name="tipo"
                      value="youtube"
                      checked={formData.tipo === "youtube"}
                      onChange={(e) =>
                        setFormData({ ...formData, tipo: e.target.value as "youtube" | "vimeo" | "arquivo" })
                      }
                    />
                    <span>🎥 YouTube</span>
                  </label>
                  <label className="radioLabel">
                    <input
                      type="radio"
                      name="tipo"
                      value="arquivo"
                      checked={formData.tipo === "arquivo"}
                      onChange={(e) =>
                        setFormData({ ...formData, tipo: e.target.value as "youtube" | "vimeo" | "arquivo" })
                      }
                    />
                    <span>📁 Upload Local</span>
                  </label>
                </div>
              </div>

              <div className="formGroup">
                <label className="formLabel">Descrição</label>
                <textarea
                  placeholder="Descrição da videoaula"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  className="formInput"
                  rows={3}
                />
              </div>

              <div className="formGroup">
                <label className="formLabel">Atribuição</label>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                  <AnimatedRadioLabel
                    name="modoAtribuicao"
                    value="turma"
                    checked={modoAtribuicao === "turma"}
                    onChange={() => {
                      setModoAtribuicao("turma");
                      setAlunosSelecionados([]);
                    }}
                    label="Turma Específica"
                    icon="👥"
                  />
                  <AnimatedRadioLabel
                    name="modoAtribuicao"
                    value="aluno"
                    checked={modoAtribuicao === "aluno"}
                    onChange={() => {
                      setModoAtribuicao("aluno");
                      setTurmasSelecionadas([]);
                    }}
                    label="Aluno Específico"
                    icon="👤"
                  />
                </div>
              </div>

              {modoAtribuicao === "turma" && (
                <div className="formGroup">
                  <label className="formLabel">Turmas (opcional)</label>
                  <select
                    className="formInput"
                    multiple
                    value={turmasSelecionadas}
                    onChange={(e) =>
                      setTurmasSelecionadas(
                        Array.from(e.target.selectedOptions, (opt) => opt.value)
                      )
                    }
                    size={4}
                    style={{ minHeight: "100px" }}
                  >
                    {turmasDisponiveis.map((turma) => (
                      <option key={turma.id} value={turma.id}>
                        {turma.nome} ({turma.tipo})
                      </option>
                    ))}
                  </select>
                  <small className="formHint">
                    Segure Ctrl/Cmd para selecionar múltiplas. Deixe vazio para
                    "Todos".
                  </small>
                </div>
              )}

              {modoAtribuicao === "aluno" && (
                <>
                  <div className="formGroup">
                    <label className="formLabel">Pesquisar Alunos</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="🔍 Digite nome ou usuário..."
                      value={alunoFiltro}
                      onChange={(e) => setAlunoFiltro(e.target.value)}
                    />
                  </div>

                  <div className="formGroup">
                    <label className="formLabel">Alunos</label>
                    <select
                      className="formInput"
                      multiple
                      value={alunosSelecionados}
                      onChange={(e) =>
                        setAlunosSelecionados(
                          Array.from(e.target.selectedOptions, (opt) => opt.value)
                        )
                      }
                      size={4}
                      style={{ minHeight: "100px" }}
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
                    </select>
                    <small className="formHint">
                      Segure Ctrl/Cmd para selecionar múltiplos alunos
                    </small>
                  </div>
                </>
              )}

              {formData.tipo === "youtube" || formData.tipo === "vimeo" ? (
                <div className="formGroup">
                  <label className="formLabel">URL do {formData.tipo === "youtube" ? "YouTube" : "Vimeo"} *</label>
                  <input
                    type="text"
                    placeholder={formData.tipo === "youtube" ? "https://www.youtube.com/embed/..." : "https://vimeo.com/..."}
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    className="formInput"
                  />
                </div>
              ) : (
                <div className="formGroup">
                  <label className="formLabel">Arquivo de Vídeo *</label>
                  <label className="fileInputWrapper">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="fileInput"
                    />
                    <span className="fileInputLabel">
                      {formData.arquivo
                        ? `✓ ${formData.arquivo.name}`
                        : "Selecione um arquivo de vídeo (MP4, WebM, etc)"}
                    </span>
                  </label>
                </div>
              )}

              <div className="formGroup">
                <label className="formLabel">Duração (mm:ss) *</label>
                <input
                  type="text"
                  placeholder="Ex: 25:30"
                  value={formData.duracao}
                  onChange={(e) =>
                    setFormData({ ...formData, duracao: e.target.value })
                  }
                  className="formInput"
                />
              </div>
        </Modal>

        {/* CONFIRM DIALOG DE DELETE */}
        <ConfirmDialog
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Deletar videoaula"
          message={`Tem certeza que deseja deletar a videoaula "${deleteTarget?.titulo}"?`}
          confirmText="Deletar"
          cancelText="Cancelar"
          isLoading={deleting}
          isDangerous={true}
        />
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
