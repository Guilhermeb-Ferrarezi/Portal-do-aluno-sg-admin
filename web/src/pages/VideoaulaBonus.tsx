import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { hasRole } from "../auth/auth";
import { useToast } from "../contexts/ToastContext";
import { useCachedData } from "../hooks/useCachedData";
import {
  Search,
  Plus,
  Film,
  Landmark,
  Globe,
  Trash2,
  Clock,
  Youtube,
  FolderUp,
  Play,
  Check,
} from "lucide-react";
import {
  FadeInUp,
  PopInBadge,
  PulseLoader,
  AnimatedButton,
  AnimatedSelect,
} from "../components/animate-ui";
import {
  listarTurmas,
  listarModulos,
  listarVideoaulas,
  criarVideoaula,
  deletarVideoaula,
  atribuirVideoaulaTurmas,
  type Turma,
  type Videoaula,
  type Modulo,
} from "../services/api";
import "./VideoaulaBonus.css";

type VideoTipoFiltro = "todos" | "youtube" | "vimeo" | "arquivo";

function normalizeYoutubeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    if (host.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    const maybeId = raw.split("v=")[1]?.split("&")[0] || "";
    if (maybeId) return `https://www.youtube.com/embed/${maybeId}`;
  }
  return raw;
}

function normalizeVimeoUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!host.includes("vimeo.com")) return raw;

    const parts = url.pathname.split("/").filter(Boolean);
    const videoId = parts.includes("video")
      ? parts[parts.indexOf("video") + 1]
      : parts[0];
    if (videoId) return `https://player.vimeo.com/video/${videoId}`;
  } catch {
    // fallback: mantém URL original
  }
  return raw;
}

function getPlayableVideoUrl(videoaula: Videoaula): string {
  if (videoaula.tipo === "youtube") return normalizeYoutubeUrl(videoaula.url || "");
  if (videoaula.tipo === "vimeo") return normalizeVimeoUrl(videoaula.url || "");
  return videoaula.url || "";
}

export default function VideoaulaBonusPage() {
  const canUpload = hasRole(["admin", "professor"]);
  const { addToast } = useToast();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  // Carregar videoaulas com cache
  const { data: videoaulas, loading, error, refetch } = useCachedData(
    'videoaulas-list',
    listarVideoaulas
  );

  // Estados
  const [filtroModulo, setFiltroModulo] = React.useState<string>("todos");
  const [buscaModuloFiltro, setBuscaModuloFiltro] = React.useState<string>("");
  const [showSugestoesModuloFiltro, setShowSugestoesModuloFiltro] = React.useState(false);
  const [filtroTipo, setFiltroTipo] = React.useState<VideoTipoFiltro>("todos");
  const [busca, setBusca] = React.useState<string>("");
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>("todas");
  const [modalAberto, setModalAberto] = React.useState(false);
  const [videoSelecionado, setVideoSelecionado] = React.useState<Videoaula | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Videoaula | null>(null);
  const [buscaModuloForm, setBuscaModuloForm] = React.useState<string>("");
  const [showSugestoesModuloForm, setShowSugestoesModuloForm] = React.useState(false);
  const [formError, setFormError] = React.useState<string>("");

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);

  const [formData, setFormData] = React.useState({
    titulo: "",
    descricao: "",
    moduloId: "",
    tipo: "youtube" as "youtube" | "vimeo" | "arquivo",
    url: "",
    arquivo: null as File | null,
    duracao: "",
  });

  // Carregar turmas e módulos quando puder fazer upload
  React.useEffect(() => {
    if (canUpload) {
      listarTurmas()
        .then(setTurmasDisponiveis)
        .catch((err) => console.error("Erro ao carregar turmas:", err));

      listarModulos()
        .then(setModulosDisponiveis)
        .catch((err) => console.error("Erro ao carregar módulos:", err));
    }
  }, [canUpload]);

  // Filtrar videoaulas
  const videoaulasFiltradas = videoaulas.filter((v) => {
    const termoModulo = buscaModuloFiltro.trim().toLowerCase();
    const matchModulo =
      filtroModulo !== "todos"
        ? v.modulo === filtroModulo
        : termoModulo === "" || v.modulo.toLowerCase().includes(termoModulo);
    const matchTipo = filtroTipo === "todos" || v.tipo === filtroTipo;
    const matchBusca =
      busca === "" ||
      v.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (v.descricao && v.descricao.toLowerCase().includes(busca.toLowerCase()));
    const matchTurma =
      turmaFiltro === "todas" ||
      (v.turmas && v.turmas.some((t) => t.id === turmaFiltro)) ||
      (!v.turmas || v.turmas.length === 0); // Videoaulas sem turma visíveis para todos

    return matchModulo && matchTipo && matchBusca && matchTurma;
  });

  // Obter lista única de módulos
  const modulos = Array.from(
    new Set([
      ...videoaulas.map((v) => v.modulo).filter(Boolean),
      ...modulosDisponiveis.map((m) => m.nome).filter(Boolean),
    ])
  );

  const termoModuloFiltro = buscaModuloFiltro.trim().toLowerCase();
  const modulosFiltradosNoFiltro =
    termoModuloFiltro.length === 0
      ? []
      : modulos.filter((mod) => mod.toLowerCase().includes(termoModuloFiltro));

  const termoModuloForm = buscaModuloForm.trim().toLowerCase();
  const modulosFiltradosNoForm =
    termoModuloForm.length === 0
      ? []
      : modulosDisponiveis.filter((mod) =>
          mod.nome.toLowerCase().includes(termoModuloForm)
        );

  const handleAssistir = (videoaula: Videoaula) => {
    setVideoSelecionado(videoaula);
  };

  const playableVideoUrl = React.useMemo(
    () => (videoSelecionado ? getPlayableVideoUrl(videoSelecionado) : ""),
    [videoSelecionado]
  );

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
    const moduloIdSelecionado = formData.moduloId.trim();
    const moduloDigitado = buscaModuloForm.trim();
    const moduloParcial = moduloDigitado.toLowerCase();
    const primeiroModuloCompativel =
      moduloParcial.length > 0
        ? modulosDisponiveis.find((m) =>
            m.nome.toLowerCase().includes(moduloParcial)
          )?.id
        : "";
    const moduloEncontrado =
      moduloIdSelecionado ||
      modulosDisponiveis.find(
        (m) => m.nome.toLowerCase() === moduloDigitado.toLowerCase()
      )?.id ||
      primeiroModuloCompativel ||
      "";

    if (
      !formData.titulo.trim() ||
      !moduloEncontrado ||
      !formData.duracao.trim()
    ) {
      if (!moduloEncontrado) {
        setFormError("Selecione um módulo existente para continuar.");
        addToast("Selecione um módulo existente", "error");
      } else {
        setFormError("Preencha todos os campos obrigatórios.");
        addToast("Por favor, preencha todos os campos obrigatórios", "error");
      }
      return;
    }

    if ((formData.tipo === "youtube" || formData.tipo === "vimeo") && !formData.url.trim()) {
      setFormError(`Informe a URL do ${formData.tipo === "youtube" ? "YouTube" : "Vimeo"}.`);
      addToast(
        `Por favor, cole a URL do ${formData.tipo === "youtube" ? "YouTube" : "Vimeo"}`,
        "error"
      );
      return;
    }

    if (formData.tipo === "arquivo" && !formData.arquivo) {
      setFormError("Selecione um arquivo de vídeo.");
      addToast("Por favor, selecione um arquivo de vídeo", "error");
      return;
    }

    try {
      setFormError("");
      setSubmitting(true);

      // Preparar FormData para envio
      const formDataToSend = new FormData();
      formDataToSend.append("titulo", formData.titulo);
      formDataToSend.append("descricao", formData.descricao);
      formDataToSend.append("moduloId", moduloEncontrado);
      formDataToSend.append("duracao", formData.duracao);
      formDataToSend.append("tipo", formData.tipo);

      if (formData.tipo === "arquivo" && formData.arquivo) {
        formDataToSend.append("file", formData.arquivo);
      } else if (formData.tipo === "youtube" || formData.tipo === "vimeo") {
        const normalizedUrl =
          formData.tipo === "youtube"
            ? normalizeYoutubeUrl(formData.url)
            : normalizeVimeoUrl(formData.url);
        formDataToSend.append("url", normalizedUrl);
      }

      // Adicionar turmas se selecionadas
      if (turmasSelecionadas.length > 0) {
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
      await refetch();

      // Resetar formulário
      setFormData({
        titulo: "",
        descricao: "",
        moduloId: "",
        tipo: "youtube",
        url: "",
        arquivo: null,
        duracao: "",
      });
      setTurmasSelecionadas([]);
      setBuscaModuloForm("");
      setShowSugestoesModuloForm(false);
      setFormError("");

      setModalAberto(false);
      addToast("Videoaula adicionada com sucesso!", "success");
    } catch (err) {
      console.error("Erro ao adicionar videoaula:", err);
      addToast(
        err instanceof Error ? err.message : "Erro ao adicionar videoaula",
        "error"
      );
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
      addToast(`"${target.titulo}" foi removido.`, "success");
      await refetch();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Erro ao deletar videoaula",
        "error"
      );
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
          <button onClick={refetch}>Tentar novamente</button>
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
          {/* HEADER COM FILTROS */}
          <div className="videoaulasHeader">
          <div className="filtrosRow">
            {/* Busca */}
            <div className="searchBox">
              <span className="searchIcon" style={{ display: "inline-flex" }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Buscar videoaulas..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="searchInput"
              />
            </div>

            {/* Filtro de Tipo */}
            <AnimatedSelect
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as VideoTipoFiltro)}
              className="filterSelect"
            >
              <option value="todos">Todos os tipos</option>
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="arquivo">Upload Local</option>
            </AnimatedSelect>

            {/* Filtro de Módulo por escrita */}
            <div style={{ position: "relative", minWidth: 200 }}>
              <input
                type="text"
                placeholder="Filtrar módulo..."
                value={buscaModuloFiltro}
                onChange={(e) => {
                  setBuscaModuloFiltro(e.target.value);
                  setFiltroModulo("todos");
                  setShowSugestoesModuloFiltro(true);
                }}
                className="filterSelect"
              />
              {showSugestoesModuloFiltro && modulosFiltradosNoFiltro.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    background: "var(--background)",
                    maxHeight: 210,
                    overflowY: "auto",
                  }}
                >
                  {modulosFiltradosNoFiltro.map((mod) => (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => {
                        setFiltroModulo(mod);
                        setBuscaModuloFiltro(mod);
                        setShowSugestoesModuloFiltro(false);
                      }}
                      style={{ width: "100%", textAlign: "left" }}
                      className="badgeFilterOption"
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filtro de Turmas */}
            <AnimatedSelect
              value={turmaFiltro}
              onChange={(e) => setTurmaFiltro(e.target.value)}
              className="filterSelect"
            >
              <option value="todas">Todas as turmas</option>
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
                {iconLabel(<Plus size={16} />, "Adicionar Videoaula")}
              </AnimatedButton>
            )}
        </div>

        {/* GRID DE VIDEOAULAS */}
        <div>
          {videoaulasFiltradas.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon" style={{ display: "inline-flex" }}>
                <Film size={22} />
              </div>
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
                      {paginatedVideoaulas.map((videoaula, index) => {

                        return (
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
                            {iconLabel(
                              <Landmark size={12} />,
                              `${videoaula.turmas.length} turma${videoaula.turmas.length > 1 ? "s" : ""}`
                            )}
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
                          {iconLabel(<Globe size={12} />, "Para Todos")}
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
                          {iconLabel(<Play size={16} />, "Assistir")}
                        </AnimatedButton>
                        {canUpload && (
                          <AnimatedButton
                            className="deleteBtn"
                            onClick={() => setDeleteTarget(videoaula)}
                            title="Deletar"
                          >
                            <Trash2 size={16} />
                          </AnimatedButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                        </FadeInUp>
                        );
                      })}
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
                  src={playableVideoUrl}
                  title={videoSelecionado?.titulo || ""}
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : videoSelecionado?.tipo === "vimeo" ? (
                <iframe
                  width="100%"
                  height="400"
                  src={playableVideoUrl}
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
                    src={playableVideoUrl}
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
              <span className="duracao">
                {iconLabel(<Clock size={14} />, videoSelecionado?.duracao || "")}
              </span>
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
                  background: 'var(--red)',
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
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Buscar módulo por nome..."
                    value={buscaModuloForm}
                  onChange={(e) => {
                    setBuscaModuloForm(e.target.value);
                    setFormData({ ...formData, moduloId: "" });
                    setShowSugestoesModuloForm(true);
                    if (formError) setFormError("");
                  }}
                    className="formInput"
                  />
                  {showSugestoesModuloForm && modulosFiltradosNoForm.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        background: "var(--background)",
                        maxHeight: 210,
                        overflowY: "auto",
                      }}
                    >
                      {modulosFiltradosNoForm.map((mod) => (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, moduloId: mod.id });
                            setBuscaModuloForm(mod.nome);
                            setShowSugestoesModuloForm(false);
                          }}
                          style={{ width: "100%", textAlign: "left" }}
                          className="badgeFilterOption"
                        >
                          {mod.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="formGroup">
                <label className="formLabel">Tipo *</label>
                <div className="videoTypeSegment" role="tablist" aria-label="Tipo de videoaula">
                  <button
                    type="button"
                    className={`videoTypeOption ${formData.tipo === "youtube" ? "active" : ""}`}
                    onClick={() =>
                      setFormData({ ...formData, tipo: "youtube" })
                    }
                  >
                    {iconLabel(<Youtube size={16} />, "YouTube")}
                  </button>
                  <button
                    type="button"
                    className={`videoTypeOption ${formData.tipo === "arquivo" ? "active" : ""}`}
                    onClick={() =>
                      setFormData({ ...formData, tipo: "arquivo" })
                    }
                  >
                    {iconLabel(<FolderUp size={16} />, "Upload Local")}
                  </button>
                </div>
              </div>

              {formError ? (
                <div
                  style={{
                    marginTop: "6px",
                    marginBottom: "4px",
                    color: "#fda4af",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {formError}
                </div>
              ) : null}

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
                        ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Check size={16} /> {formData.arquivo.name}
                          </span>
                        )
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


