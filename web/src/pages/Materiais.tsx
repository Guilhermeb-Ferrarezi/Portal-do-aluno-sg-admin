import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { hasRole } from "../auth/auth";
import { useToast } from "../contexts/ToastContext";
import { useCachedData } from "../hooks/useCachedData";
import {
  FadeInUp,
  PopInBadge,
  AnimatedButton,
  AnimatedSelect,
} from "../components/animate-ui";
import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link as LinkIcon,
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
  listarModulos,
  type Modulo,
  listarTurmas,
  atribuirMaterialTurmas,
  type Turma,
} from "../services/api";
import "./Materiais.css";

type MaterialCategoria =
  | "link"
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "imagem"
  | "texto"
  | "compactado"
  | "arquivo";

type FormatoArquivo = Exclude<MaterialCategoria, "link">;

const FORMATO_ARQUIVO_OPTIONS: Array<{ value: FormatoArquivo; label: string }> = [
  { value: "arquivo", label: "Qualquer arquivo" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word (DOC/DOCX)" },
  { value: "excel", label: "Excel (XLS/XLSX/CSV)" },
  { value: "powerpoint", label: "PowerPoint (PPT/PPTX)" },
  { value: "imagem", label: "Imagem (PNG/JPG/WebP/GIF)" },
  { value: "texto", label: "Texto (TXT/MD)" },
  { value: "compactado", label: "Compactado (ZIP/RAR/7Z)" },
];

const FILTER_TIPO_OPTIONS: Array<{ value: "todos" | MaterialCategoria; label: string }> = [
  { value: "todos", label: "Todos os tipos" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "powerpoint", label: "PowerPoint" },
  { value: "imagem", label: "Imagem" },
  { value: "texto", label: "Texto" },
  { value: "compactado", label: "Compactado" },
  { value: "arquivo", label: "Outros arquivos" },
  { value: "link", label: "Links" },
];

const EXT_BY_FORMAT: Record<FormatoArquivo, string[]> = {
  arquivo: [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "csv",
    "ppt",
    "pptx",
    "txt",
    "md",
    "zip",
    "rar",
    "7z",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "svg",
  ],
  pdf: ["pdf"],
  word: ["doc", "docx"],
  excel: ["xls", "xlsx", "csv"],
  powerpoint: ["ppt", "pptx"],
  imagem: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
  texto: ["txt", "md"],
  compactado: ["zip", "rar", "7z"],
};

const ACCEPT_BY_FORMAT: Record<FormatoArquivo, string> = {
  arquivo:
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.gif,.svg",
  pdf: ".pdf,application/pdf",
  word: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  excel:
    ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  powerpoint:
    ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  imagem: "image/*",
  texto: ".txt,.md,text/plain,text/markdown",
  compactado: ".zip,.rar,.7z,application/zip,application/x-rar-compressed,application/x-7z-compressed",
};

function getFileExtension(value: string): string | null {
  const noQuery = value.split("?")[0].split("#")[0];
  const ext = noQuery.split(".").pop()?.toLowerCase() ?? "";
  return ext.length > 0 && ext !== noQuery.toLowerCase() ? ext : null;
}

function getMaterialCategoria(material: Material): MaterialCategoria {
  if (material.tipo === "link") return "link";
  const ext = getFileExtension(material.url);
  if (!ext) return "arquivo";
  if (EXT_BY_FORMAT.pdf.includes(ext)) return "pdf";
  if (EXT_BY_FORMAT.word.includes(ext)) return "word";
  if (EXT_BY_FORMAT.excel.includes(ext)) return "excel";
  if (EXT_BY_FORMAT.powerpoint.includes(ext)) return "powerpoint";
  if (EXT_BY_FORMAT.imagem.includes(ext)) return "imagem";
  if (EXT_BY_FORMAT.texto.includes(ext)) return "texto";
  if (EXT_BY_FORMAT.compactado.includes(ext)) return "compactado";
  return "arquivo";
}

function getCategoriaLabel(categoria: MaterialCategoria): string {
  if (categoria === "pdf") return "PDF";
  if (categoria === "word") return "Word";
  if (categoria === "excel") return "Excel";
  if (categoria === "powerpoint") return "PowerPoint";
  if (categoria === "imagem") return "Imagem";
  if (categoria === "texto") return "Texto";
  if (categoria === "compactado") return "Compactado";
  if (categoria === "link") return "Link";
  return "Arquivo";
}

function getCategoriaIcon(categoria: MaterialCategoria): React.ReactNode {
  if (categoria === "link") return <LinkIcon size={14} />;
  if (categoria === "excel") return <FileSpreadsheet size={14} />;
  if (categoria === "imagem") return <FileImage size={14} />;
  if (categoria === "compactado") return <FileArchive size={14} />;
  if (categoria === "pdf" || categoria === "word" || categoria === "texto") return <FileText size={14} />;
  return <File size={14} />;
}

export default function MateriaisPage() {
  const canUpload = hasRole(["admin", "professor"]);
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
  const [buscaModuloFiltro, setBuscaModuloFiltro] = React.useState<string>("");
  const [showSugestoesModuloFiltro, setShowSugestoesModuloFiltro] = React.useState(false);
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | MaterialCategoria>("todos");
  const [busca, setBusca] = React.useState<string>("");
  const [turmaFiltro, setTurmaFiltro] = React.useState<string>("todas");
  const [modalAberto, setModalAberto] = React.useState(false);

  // Estados do formulário
  const [formTitulo, setFormTitulo] = React.useState("");
  const [formModuloId, setFormModuloId] = React.useState("");
  const [buscaModuloForm, setBuscaModuloForm] = React.useState("");
  const [showSugestoesModuloForm, setShowSugestoesModuloForm] = React.useState(false);
  const [formTipo, setFormTipo] = React.useState<"arquivo" | "link">("arquivo");
  const [formFormatoArquivo, setFormFormatoArquivo] = React.useState<FormatoArquivo>("arquivo");
  const [formDescricao, setFormDescricao] = React.useState("");
  const [formUrl, setFormUrl] = React.useState("");
  const [formArquivo, setFormArquivo] = React.useState<File | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = React.useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = React.useState<Turma[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = React.useState<Modulo[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Material | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Carregar turmas e modulos quando puder fazer upload

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

  // Filtrar materiais
  const materiaisFiltrados = materiais.filter((m) => {
    const categoria = getMaterialCategoria(m);
    const termoModuloFiltro = buscaModuloFiltro.trim().toLowerCase();
    const matchModulo =
      filtroModulo !== "todos"
        ? m.modulo === filtroModulo
        : termoModuloFiltro === "" || m.modulo.toLowerCase().includes(termoModuloFiltro);
    const matchTipo = filtroTipo === "todos" || categoria === filtroTipo;
    const matchBusca =
      busca === "" ||
      m.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (m.descricao &&
        m.descricao.toLowerCase().includes(busca.toLowerCase()));
    const matchTurma =
      turmaFiltro === "todas" ||
      (m.turmas && m.turmas.some((t) => t.id === turmaFiltro)) ||
      (!m.turmas || m.turmas.length === 0); // Materiais sem turma visíveis para todos

    return matchModulo && matchTipo && matchBusca && matchTurma;
  });

  // Obter lista única de módulos
  const modulos = Array.from(
    new Set([
      ...materiais.map((m) => m.modulo).filter(Boolean),
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
      : modulosDisponiveis.filter((mod) => mod.nome.toLowerCase().includes(termoModuloForm));

  const resetForm = () => {
    setFormTitulo("");
    setFormModuloId("");
    setBuscaModuloForm("");
    setShowSugestoesModuloForm(false);
    setFormTipo("arquivo");
    setFormFormatoArquivo("arquivo");
    setFormDescricao("");
    setFormUrl("");
    setFormArquivo(null);
    setTurmasSelecionadas([]);
    setFormError(null);
  };

  const handleArquivoChange = (file: File | null) => {
    if (!file) {
      setFormArquivo(null);
      return;
    }

    const ext = getFileExtension(file.name);
    const allowedExtensions = EXT_BY_FORMAT[formFormatoArquivo];
    if (formFormatoArquivo !== "arquivo" && (!ext || !allowedExtensions.includes(ext))) {
      setFormError(`Arquivo incompatível com o formato selecionado (${getCategoriaLabel(formFormatoArquivo)}).`);
      setFormArquivo(null);
      return;
    }

    setFormError(null);
    setFormArquivo(file);
  };

  const handleSubmit = async () => {
    setFormError(null);

    const moduloIdSelecionado = formModuloId.trim();
    const moduloDigitado = buscaModuloForm.trim().toLowerCase();
    const moduloEncontrado =
      moduloIdSelecionado ||
      modulosDisponiveis.find((m) => m.nome.toLowerCase() === moduloDigitado)?.id ||
      modulosDisponiveis.find((m) => m.nome.toLowerCase().includes(moduloDigitado))?.id ||
      "";

    if (!formTitulo || !moduloEncontrado) {
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
      formData.append("moduloId", moduloEncontrado);
      if (formDescricao) {
        formData.append("descricao", formDescricao);
      }

      if (formTipo === "arquivo" && formArquivo) {
        formData.append("file", formArquivo);
      } else if (formTipo === "link") {
        formData.append("url", formUrl);
      }

      // Adicionar turma_ids
      if (turmasSelecionadas.length > 0) {
        formData.append("turma_ids", JSON.stringify(turmasSelecionadas));
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
        <div className="materiaisContainer">
          <div className="materiaisGrid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`material-skeleton-${index}`} className="materialCard materialCardSkeleton" />
            ))}
          </div>
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
                onChange={(e) => setFiltroTipo(e.target.value as "todos" | MaterialCategoria)}
                className="filterSelect"
              >
                {FILTER_TIPO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                          const categoria = getMaterialCategoria(material);
                          return (
                            <FadeInUp key={material.id} delay={index * 0.1}>
                              <div className="materialCard">
                                <div className="materialHeader">
                                  <div className="materialIcon">
                                    {getCategoriaIcon(categoria)}
                                  </div>
                                  <div className="materialInfo">
                                    <h3 className="materialTitulo">{material.titulo}</h3>
                                    <div className="materialMeta">
                                      <span className="metaBadge">{material.modulo}</span>
                                      <span className="metaBadge materialTypeBadge">{getCategoriaLabel(categoria)}</span>
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
                                  {material.turmas && material.turmas.length > 0 ? (
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
                  onClick={handleSubmit}
                  disabled={submitting}
                  loading={submitting}
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
                  Salvar Material
                </AnimatedButton>
              </div>
            }
          >
            {formError && <p className="formError">{formError}</p>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
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
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Buscar módulo por nome..."
                    className="formInput"
                    value={buscaModuloForm}
                    onChange={(e) => {
                      setBuscaModuloForm(e.target.value);
                      setFormModuloId("");
                      setShowSugestoesModuloForm(true);
                      if (formError) setFormError(null);
                    }}
                    required
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
                            setFormModuloId(mod.id);
                            setBuscaModuloForm(mod.nome);
                            setShowSugestoesModuloForm(false);
                            if (formError) setFormError(null);
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
                <div className="materialTypeSegment" role="tablist" aria-label="Tipo de material">
                  <button
                    type="button"
                    className={`materialTypeOption ${formTipo === "arquivo" ? "active" : ""}`}
                    onClick={() => {
                      setFormTipo("arquivo");
                      setFormUrl("");
                    }}
                  >
                    {iconLabel(<FileText size={14} />, "Arquivo")}
                  </button>
                  <button
                    type="button"
                    className={`materialTypeOption ${formTipo === "link" ? "active" : ""}`}
                    onClick={() => {
                      setFormTipo("link");
                      setFormArquivo(null);
                    }}
                  >
                    {iconLabel(<LinkIcon size={14} />, "Link")}
                  </button>
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
                  Segure Ctrl/Cmd para selecionar multiplas. Deixe vazio para "Todos".
                </small>
              </div>

              {/* Input dinâmico baseado no tipo */}
              {formTipo === "arquivo" ? (
                <div className="formGroup">
                  <label className="formLabel">Formato do Arquivo</label>
                  <select
                    className="formInput"
                    value={formFormatoArquivo}
                    onChange={(e) => {
                      setFormFormatoArquivo(e.target.value as FormatoArquivo);
                      setFormArquivo(null);
                      setFormError(null);
                    }}
                  >
                    {FORMATO_ARQUIVO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="formHint">
                    Selecione um formato específico para restringir os arquivos permitidos.
                  </small>

                  <label className="formLabel">Arquivo *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_BY_FORMAT[formFormatoArquivo]}
                    className="materialFileInputHidden"
                    onChange={(e) => handleArquivoChange(e.target.files?.[0] || null)}
                  />
                  <div className="materialFilePicker">
                    <AnimatedButton
                      type="button"
                      className="materialFilePickerBtn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Procurar
                    </AnimatedButton>
                    <span className="materialFilePickerName">
                      {formArquivo?.name || "Nenhum arquivo selecionado."}
                    </span>
                  </div>
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

