import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { getRole, getUserId, hasRole } from "../auth/auth";
import { useToast } from "../contexts/ToastContext";
import { useCachedData } from "../hooks/useCachedData";
import {
  FadeInUp,
  PopInBadge,
  PulseLoader,
  AnimatedButton,
  AnimatedSelect,
  AnimatedRadioLabel,
} from "../components/animate-ui";
import {
  FileText,
  Link as LinkIcon,
  Users,
  User as UserIcon,
  BookOpen,
  Landmark,
  Globe,
  Trash2,
  Download,
  Plus,
} from "lucide-react";
import {
  listarMateriais,
  criarMaterial,
  deletarMaterial,
  type Material,
  listarTurmas,
  listarAlunos,
  atribuirMaterialTurmas,
  type Turma,
  type User,
} from "../services/api";
import "./Materiais.css";

export default function MateriaisPage() {
  const canUpload = hasRole(["admin", "professor"]);
  const role = getRole();
  const userId = getUserId();
  const isStaff = role === "admin" || role === "professor";
  const { addToast } = useToast();
  const iconLabel = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );

  // Carregar materiais com cache
  const { data: materiais, loading, error, refetch } = useCachedData(
    'materiais-list',
    listarMateriais
  );

  // Estados de filtros
  const [filtroModulo, setFiltroModulo] = React.useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = React.useState<string>("todos");
  const [busca, setBusca] = React.useState<string>("");
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>("todas");
  const [modalAberto, setModalAberto] = React.useState(false);

  // Estados do formulário
  const [formTitulo, setFormTitulo] = React.useState("");
  const [formModulo, setFormModulo] = React.useState("");
  const [formTipo, setFormTipo] = React.useState<"arquivo" | "link">("arquivo");
  const [formDescricao, setFormDescricao] = React.useState("");
  const [formUrl, setFormUrl] = React.useState("");
  const [formArquivo, setFormArquivo] = React.useState<File | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [modoAtribuicao, setModoAtribuicao] = React.useState<"turma" | "aluno">("turma");
  const [alunosSelecionados, setAlunosSelecionados] = React.useState<string[]>([]);
  const [alunosDisponiveis, setAlunosDisponiveis] = React.useState<User[]>([]);
  const [alunoFiltro, setAlunoFiltro] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Material | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  const alunoNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    alunosDisponiveis.forEach((aluno) => {
      map.set(aluno.id, aluno.nome || aluno.usuario || aluno.id);
    });
    return map;
  }, [alunosDisponiveis]);

  function getAlunoIds(material: Material): string[] {
    const alunos = Array.isArray((material as any).alunos)
      ? (material as any).alunos.map((a: any) => a?.id).filter(Boolean)
      : [];
    const idsSnake = Array.isArray((material as any).aluno_ids)
      ? (material as any).aluno_ids
      : [];
    const idsCamel = Array.isArray((material as any).alunoIds)
      ? (material as any).alunoIds
      : [];
    return Array.from(new Set([...alunos, ...idsSnake, ...idsCamel]));
  }

  function getAlunoNames(material: Material): string[] {
    const alunos = Array.isArray((material as any).alunos)
      ? (material as any).alunos
        .map((a: any) => a?.nome || a?.usuario || a?.id)
        .filter(Boolean)
      : [];
    if (alunos.length > 0) return alunos as string[];

    const ids = getAlunoIds(material);
    return ids
      .map((id) => alunoNameById.get(id))
      .filter((nome): nome is string => !!nome);
  }

  function formatAlunoLabel(names: string[]) {
    if (names.length === 0) return "Aluno específico";
    if (names.length === 1) return `Para: ${names[0]}`;
    if (names.length === 2) return `Para: ${names.join(", ")}`;
    return `Para: ${names[0]} +${names.length - 1}`;
  }

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

  // Filtrar materiais
  const materiaisFiltrados = materiais.filter((m) => {
    const alunoIds = getAlunoIds(m);
    const hasAlunoAssignment = alunoIds.length > 0;
    if (!isStaff && hasAlunoAssignment) {
      if (!userId || !alunoIds.includes(userId)) {
        return false;
      }
    }
    const matchModulo =
      filtroModulo === "todos" || m.modulo === filtroModulo;
    const matchTipo = filtroTipo === "todos" || m.tipo === filtroTipo;
    const matchBusca =
      busca === "" ||
      m.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (m.descricao &&
        m.descricao.toLowerCase().includes(busca.toLowerCase()));
    const matchTurma =
      turmaFiltro === "todas" ||
      (m.turmas && m.turmas.some((t) => t.id === turmaFiltro)) ||
      (!hasAlunoAssignment && (!m.turmas || m.turmas.length === 0)); // Materiais sem turma visíveis para todos

    return matchModulo && matchTipo && matchBusca && matchTurma;
  });

  // Obter lista única de módulos
  const modulos = Array.from(new Set(materiais.map((m) => m.modulo)));

  const resetForm = () => {
    setFormTitulo("");
    setFormModulo("");
    setFormTipo("arquivo");
    setFormDescricao("");
    setFormUrl("");
    setFormArquivo(null);
    setTurmasSelecionadas([]);
    setAlunosSelecionados([]);
    setModoAtribuicao("turma");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitulo || !formModulo) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (formTipo === "arquivo" && !formArquivo) {
      setFormError("Selecione um arquivo para fazer upload.");
      return;
    }

    if (formTipo === "link" && !formUrl) {
      setFormError("Forneça uma URL para o link.");
      return;
    }

    try {
      setSubmitting(true);

      // Preparar FormData
      const formData = new FormData();
      formData.append("titulo", formTitulo);
      formData.append("tipo", formTipo);
      formData.append("modulo", formModulo);
      if (formDescricao) {
        formData.append("descricao", formDescricao);
      }

      if (formTipo === "arquivo" && formArquivo) {
        formData.append("file", formArquivo);
      } else if (formTipo === "link") {
        formData.append("url", formUrl);
      }

      // Adicionar turma_ids ou aluno_ids
      if (modoAtribuicao === "turma" && turmasSelecionadas.length > 0) {
        formData.append("turma_ids", JSON.stringify(turmasSelecionadas));
      } else if (modoAtribuicao === "aluno" && alunosSelecionados.length > 0) {
        formData.append("aluno_ids", JSON.stringify(alunosSelecionados));
      }

      const resultado = await criarMaterial(formData);

      // Atribuir turmas se houver
      if (turmasSelecionadas.length > 0 && resultado.material?.id) {
        try {
          await atribuirMaterialTurmas(resultado.material.id, turmasSelecionadas);
        } catch (err) {
          console.error("Erro ao atribuir turmas:", err);
        }
      }

      setModalAberto(false);
      resetForm();
      addToast("Material adicionado com sucesso.", "success");
      await refetch();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Erro ao adicionar material",
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
      await deletarMaterial(target.id);
      setDeleteTarget(null);
      addToast(`"${target.titulo}" foi removido.`, "success");
      await refetch();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Erro ao deletar material",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (material: Material) => {
    window.open(material.url, "_blank");
  };

  // Loading state
  if (loading) {
    return (
      <DashboardLayout
        title="Materiais"
        subtitle="Acesse arquivos e links de estudo"
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <PulseLoader size="large" text="Carregando materiais..." />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout
        title="Materiais"
        subtitle="Acesse arquivos e links de estudo"
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
      title="Materiais"
      subtitle="Acesse arquivos e links de estudo"
    >
      <FadeInUp duration={0.28}>
        <div className="materiaisContainer">
          {/* HEADER COM FILTROS */}
          <div className="materiaisHeader">
            <div className="filtrosRow">
              {/* Busca */}
              <div className="searchBox">
                <input
                  type="text"
                  placeholder="Buscar materiais..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="searchInput"
                />
              </div>

              {/* Filtro de Tipo */}
              <AnimatedSelect
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="filterSelect"
              >
                <option value="todos">Todos os tipos</option>
                <option value="arquivo">Arquivos</option>
                <option value="link">Links</option>
              </AnimatedSelect>

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
                onClick={() => {
                  setModalAberto(true);
                  setFormError(null);
                }}
              >
                {iconLabel(<Plus size={14} />, "Adicionar Material")}
              </AnimatedButton>
            )}
          </div>

          {/* LISTA DE MATERIAIS */}
          <div>
            {materiaisFiltrados.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon" style={{ display: "inline-flex" }}><BookOpen size={22} /></div>
                <div className="emptyTitle">
                  {materiais.length === 0
                    ? "Nenhum material disponível"
                    : "Nenhum material encontrado"}
                </div>
                <p className="emptyText">
                  {materiais.length === 0
                    ? "Em breve serão adicionados materiais para estudo."
                    : "Tente ajustar seus filtros de busca."}
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedMateriais = materiaisFiltrados.slice(
                    startIndex,
                    endIndex
                  );

                  return (
                    <>
                      <div className="materiaisGrid">
                        {paginatedMateriais.map((material, index) => {
                          const alunoIds = getAlunoIds(material);
                          const hasAlunoAssignment = alunoIds.length > 0;
                          const alunoNames = hasAlunoAssignment ? getAlunoNames(material) : [];
                          const showParaMim =
                            !isStaff && !!userId && alunoIds.includes(userId);
                          const alunoLabel = showParaMim
                            ? "Para mim"
                            : formatAlunoLabel(alunoNames);
                          const alunoTitle = showParaMim
                            ? "Disponível apenas para você"
                            : alunoNames.length > 0
                              ? `Disponível apenas para: ${alunoNames.join(", ")}`
                              : "Disponível para aluno(s) específico(s)";

                          return (
                            <FadeInUp key={material.id} delay={index * 0.1}>
                              <div className="materialCard">
                                <div className="materialHeader">
                                  <div className="materialIcon">
                                    {material.tipo === "arquivo" ? <FileText size={14} /> : <LinkIcon size={14} />}
                                  </div>
                                  <div className="materialInfo">
                                    <h3 className="materialTitulo">{material.titulo}</h3>
                                    <div className="materialMeta">
                                      <span className="metaBadge">{material.modulo}</span>
                                      <span className="metaData">
                                        {new Date(material.createdAt).toLocaleDateString(
                                          "pt-BR"
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <p className="materialDescricao">
                                  {material.descricao || "Sem descrição"}
                                </p>

                                {/* Badges de acesso/turmas */}
                                <div
                                  style={{
                                    marginTop: "8px",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "6px",
                                  }}
                                >
                                  {hasAlunoAssignment ? (
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
                                        title={alunoTitle}
                                      >
                                        {iconLabel(<UserIcon size={12} />, alunoLabel)}
                                      </span>
                                    </PopInBadge>
                                  ) : material.turmas && material.turmas.length > 0 ? (
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
                                          {iconLabel(<Landmark size={12} />, `${material.turmas.length} turma${material.turmas.length > 1 ? "s" : ""}`)}
                                        </span>
                                      </PopInBadge>
                                      {material.turmas.map((turma, idx) => (
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

                                <div className="materialFooter">
                                  <AnimatedButton
                                    className="materialBtn"
                                    onClick={() => handleDownload(material)}
                                  >
                                    {material.tipo === "arquivo"
                                      ? iconLabel(<Download size={14} />, "Baixar")
                                      : iconLabel(<Globe size={14} />, "Abrir Link")}
                                  </AnimatedButton>

                                  {canUpload && (
                                    <AnimatedButton
                                      onClick={() => setDeleteTarget(material)}
                                      className="materialDeleteBtn"
                                      title="Deletar"
                                    >
                                      <Trash2 size={14} />
                                    </AnimatedButton>
                                  )}
                                </div>
                              </div>
                            </FadeInUp>
                          );
                        })}
                      </div>

                      <Pagination
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={materiaisFiltrados.length}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                      />
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* MODAL DE UPLOAD (apenas para admin/professor) */}
          <Modal
            isOpen={modalAberto && canUpload}
            onClose={() => {
              setModalAberto(false);
              resetForm();
            }}
            title="Adicionar Novo Material"
            size="lg"
            footer={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <AnimatedButton
                  onClick={() => {
                    setModalAberto(false);
                    resetForm();
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </AnimatedButton>
                <AnimatedButton
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? '⏳ Salvando...' : 'Salvar Material'}
                </AnimatedButton>
              </div>
            }
          >
            {formError && <p className="formError">{formError}</p>}

            <form onSubmit={handleSubmit}>
              <div className="formGroup">
                <label className="formLabel">Título *</label>
                <input
                  type="text"
                  placeholder="Título do material"
                  className="formInput"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  required
                />
              </div>

              <div className="formGroup">
                <label className="formLabel">Módulo *</label>
                <input
                  type="text"
                  placeholder="Nome do módulo (crie um novo ou selecione existente)"
                  className="formInput"
                  value={formModulo}
                  onChange={(e) => setFormModulo(e.target.value)}
                  list="modulos-list"
                  required
                />
                <datalist id="modulos-list">
                  {modulos.map((mod) => (
                    <option key={mod} value={mod} />
                  ))}
                </datalist>
              </div>

              <div className="formGroup">
                <label className="formLabel">Tipo *</label>
                <div className="radioGroup">
                  <label className="radioLabel">
                    <input
                      type="radio"
                      name="tipo"
                      value="arquivo"
                      checked={formTipo === "arquivo"}
                      onChange={() => setFormTipo("arquivo")}
                    />
                    {iconLabel(<FileText size={14} />, "Arquivo")}
                  </label>
                  <label className="radioLabel">
                    <input
                      type="radio"
                      name="tipo"
                      value="link"
                      checked={formTipo === "link"}
                      onChange={() => setFormTipo("link")}
                    />
                    {iconLabel(<LinkIcon size={14} />, "Link")}
                  </label>
                </div>
              </div>

              <div className="formGroup">
                <label className="formLabel">Descrição</label>
                <textarea
                  placeholder="Descrição do material"
                  className="formInput"
                  rows={3}
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
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
                    icon={<Users size={14} />}
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
                    icon={<UserIcon size={14} />}
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
                      placeholder="Digite nome ou usuário..."
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

              {/* Input dinâmico baseado no tipo */}
              {formTipo === "arquivo" ? (
                <div className="formGroup">
                  <label className="formLabel">Arquivo *</label>
                  <input
                    type="file"
                    className="formInput"
                    onChange={(e) => setFormArquivo(e.target.files?.[0] || null)}
                    required
                  />
                </div>
              ) : (
                <div className="formGroup">
                  <label className="formLabel">URL *</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/recurso"
                    className="formInput"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    required
                  />
                </div>
              )}
            </form>
          </Modal>

          <ConfirmDialog
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
            title="Deletar material"
            message={`Tem certeza que deseja deletar o material "${deleteTarget?.titulo}"?`}
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
