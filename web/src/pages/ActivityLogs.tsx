import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { AnimatedButton } from "../components/animate-ui/AnimatedButton";
import { ScaleIn } from "../components/animate-ui/ScaleIn";
import { listarActivityLogs, type ActivityLog } from "../services/api";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  User,
  School,
  FilePenLine,
  Package,
  FileText,
  Film,
  Search,
  X,
  SlidersHorizontal,
  ClipboardList,
  Paperclip,
  RefreshCcw,
} from "lucide-react";
import "./ActivityLogs.css";

type Filters = {
  q: string;
  action: string;
  entityType: string;
  actorId: string;
  from: string;
  to: string;
};

const defaultFilters: Filters = {
  q: "",
  action: "",
  entityType: "",
  actorId: "",
  from: "",
  to: "",
};

const ACTION_OPTIONS = [
  { value: "", label: "Todas as ações" },
  { value: "create", label: "Criação" },
  { value: "update", label: "Atualização" },
  { value: "delete", label: "Exclusão" },
  { value: "duplicate", label: "Duplicação" },
];

const ENTITY_OPTIONS = [
  { value: "", label: "Todas as entidades" },
  { value: "user", label: "Usuário" },
  { value: "turma", label: "Turma" },
  { value: "exercicio", label: "Exercício" },
  { value: "template", label: "Template" },
  { value: "material", label: "Material" },
  { value: "videoaula", label: "Videoaula" },
];

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  create: { icon: <Plus size={14} />, label: "Criação", className: "actionCreate" },
  update: { icon: <Pencil size={14} />, label: "Atualização", className: "actionUpdate" },
  delete: { icon: <Trash2 size={14} />, label: "Exclusão", className: "actionDelete" },
  duplicate: { icon: <Copy size={14} />, label: "Duplicação", className: "actionDuplicate" },
};

const ENTITY_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  user: { icon: <User size={14} />, label: "Usuário" },
  turma: { icon: <School size={14} />, label: "Turma" },
  exercicio: { icon: <FilePenLine size={14} />, label: "Exercício" },
  template: { icon: <Package size={14} />, label: "Template" },
  material: { icon: <FileText size={14} />, label: "Material" },
  videoaula: { icon: <Film size={14} />, label: "Videoaula" },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "agora mesmo";
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return formatDate(value);
}

function truncate(value: string | null | undefined, max = 40) {
  if (!value) return "-";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [draft, setDraft] = React.useState<Filters>(defaultFilters);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(20);
  const [totalItems, setTotalItems] = React.useState(0);
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);

  const carregarLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);
      const offset = (currentPage - 1) * itemsPerPage;
      const { items, total } = await listarActivityLogs({
        limit: itemsPerPage,
        offset,
        q: filters.q || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        actorId: filters.actorId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setLogs(items);
      setTotalItems(total);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filters]);

  React.useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  const aplicarFiltros = () => {
    setCurrentPage(1);
    setFilters(draft);
  };

  const limparFiltros = () => {
    setCurrentPage(1);
    setDraft(defaultFilters);
    setFilters(defaultFilters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") aplicarFiltros();
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Stats
  const stats = React.useMemo(() => {
    const actions: Record<string, number> = {};
    for (const log of logs) {
      actions[log.action] = (actions[log.action] || 0) + 1;
    }
    return actions;
  }, [logs]);

  return (
    <DashboardLayout
      title="Logs de Atividade"
      subtitle="Acompanhe todas as alterações feitas no sistema"
    >
      <FadeInUp duration={0.28}>
        <div className="alContainer">
          {/* Stats Cards */}
          <div className="alStats">
            <ScaleIn delay={0}>
              <div className="alStatCard">
                <div className="alStatIcon alStatIconTotal">
                  <span>Σ</span>
                </div>
                <div className="alStatInfo">
                  <span className="alStatValue">{totalItems}</span>
                  <span className="alStatLabel">Total de Logs</span>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.05}>
              <div className="alStatCard">
                <div className="alStatIcon alStatIconCreate">
                  <span>+</span>
                </div>
                <div className="alStatInfo">
                  <span className="alStatValue">{stats.create || 0}</span>
                  <span className="alStatLabel">Criações</span>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.1}>
              <div className="alStatCard">
                <div className="alStatIcon alStatIconUpdate">
                  <span style={{ display: "inline-flex" }}>
                    <Pencil size={16} />
                  </span>
                </div>
                <div className="alStatInfo">
                  <span className="alStatValue">{stats.update || 0}</span>
                  <span className="alStatLabel">Atualizações</span>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.15}>
              <div className="alStatCard">
                <div className="alStatIcon alStatIconDelete">
                  <span style={{ display: "inline-flex" }}>
                    <Trash2 size={16} />
                  </span>
                </div>
                <div className="alStatInfo">
                  <span className="alStatValue">{stats.delete || 0}</span>
                  <span className="alStatLabel">Exclusões</span>
                </div>
              </div>
            </ScaleIn>
          </div>

          {/* Search & Filter Bar */}
          <div className="alToolbar">
            <div className="alSearchRow">
              <div className="alSearchWrap">
                <span className="alSearchIcon" style={{ display: "inline-flex" }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="alSearchInput"
                  placeholder="Buscar por usuário, ação, entidade..."
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
                {draft.q && (
                  <button
                    className="alSearchClear"
                    onClick={() => setDraft((prev) => ({ ...prev, q: "" }))}
                    aria-label="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <AnimatedButton className="alBtnFilter" onClick={() => setShowFilters(!showFilters)}>
                <span className="alFilterIcon" style={{ display: "inline-flex" }}>
                  <SlidersHorizontal size={16} />
                </span>
                Filtros
                {hasActiveFilters && <span className="alFilterDot" />}
              </AnimatedButton>
              <AnimatedButton className="alBtnPrimary" onClick={aplicarFiltros}>
                Buscar
              </AnimatedButton>
              <AnimatedButton className="alBtnRefresh" onClick={carregarLogs} title="Atualizar">
                <RefreshCcw size={16} />
              </AnimatedButton>
            </div>

            {showFilters && (
              <div className="alFiltersPanel">
                <div className="alFiltersGrid">
                  <div className="alFilterGroup">
                    <label className="alFilterLabel">Ação</label>
                    <select
                      className="alFilterSelect"
                      value={draft.action}
                      onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="alFilterGroup">
                    <label className="alFilterLabel">Entidade</label>
                    <select
                      className="alFilterSelect"
                      value={draft.entityType}
                      onChange={(e) => setDraft((prev) => ({ ...prev, entityType: e.target.value }))}
                    >
                      {ENTITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="alFilterGroup">
                    <label className="alFilterLabel">Actor ID</label>
                    <input
                      type="text"
                      className="alFilterInput"
                      placeholder="ID do usuário"
                      value={draft.actorId}
                      onChange={(e) => setDraft((prev) => ({ ...prev, actorId: e.target.value }))}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="alFilterGroup">
                    <label className="alFilterLabel">De</label>
                    <input
                      type="datetime-local"
                      className="alFilterInput"
                      value={draft.from}
                      onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                    />
                  </div>
                  <div className="alFilterGroup">
                    <label className="alFilterLabel">Até</label>
                    <input
                      type="datetime-local"
                      className="alFilterInput"
                      value={draft.to}
                      onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                </div>
                {hasActiveFilters && (
                  <button className="alClearFilters" onClick={limparFiltros}>
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="alLoadingState">
              <div className="alSpinner" />
              <span>Carregando logs...</span>
            </div>
          ) : erro ? (
            <div className="alErrorState">
              <span className="alErrorIcon">!</span>
              <span className="alErrorText">Erro: {erro}</span>
              <AnimatedButton className="alBtnPrimary" onClick={carregarLogs}>
                Tentar novamente
              </AnimatedButton>
            </div>
          ) : logs.length === 0 ? (
            <div className="alEmptyState">
              <span className="alEmptyIcon" style={{ display: "inline-flex" }}>
                <ClipboardList size={20} />
              </span>
              <span className="alEmptyTitle">Nenhum log encontrado</span>
              <span className="alEmptyText">
                {hasActiveFilters
                  ? "Tente ajustar os filtros para encontrar o que procura."
                  : "Ainda não há registros de atividade no sistema."}
              </span>
              {hasActiveFilters && (
                <AnimatedButton className="alBtnGhost" onClick={limparFiltros}>
                  Limpar filtros
                </AnimatedButton>
              )}
            </div>
          ) : (
            <>
              {/* Timeline List */}
              <div className="alTimeline">
                {logs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || {
                    icon: "?",
                    label: log.action,
                    className: "actionDefault",
                  };
                  const entityCfg = ENTITY_CONFIG[log.entityType] || {
                    icon: <Paperclip size={14} />,
                    label: log.entityType,
                  };
                  const actorName = log.actorNome || log.actorUsuario || "Sistema";
                  const isExpanded = expandedRow === log.id;
                  const metadataObj = log.metadata;
                  const hasMetadata = metadataObj && Object.keys(metadataObj).length > 0;

                  return (
                    <div
                      key={log.id}
                      className={`alLogCard ${isExpanded ? "alLogCardExpanded" : ""}`}
                      onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setExpandedRow(isExpanded ? null : log.id);
                        }
                      }}
                    >
                      <div className="alLogMain">
                        {/* Action indicator */}
                        <div className={`alLogAction ${actionCfg.className}`}>
                          <span className="alLogActionIcon">{actionCfg.icon}</span>
                        </div>

                        {/* Content */}
                        <div className="alLogContent">
                          <div className="alLogHeader">
                            <div className="alLogSummary">
                              <span className="alLogActor">{actorName}</span>
                              {log.actorRole && (
                                <span className={`alLogRole role-${log.actorRole}`}>
                                  {log.actorRole}
                                </span>
                              )}
                              <span className={`alLogActionLabel ${actionCfg.className}`}>
                                {actionCfg.label}
                              </span>
                              <span className="alLogEntity">
                                {entityCfg.icon} {entityCfg.label}
                              </span>
                            </div>
                            <div className="alLogTime">
                              <span className="alLogTimeAgo">{timeAgo(log.createdAt)}</span>
                            </div>
                          </div>

                          <div className="alLogMeta">
                            {log.actorUsuario && (
                              <span className="alLogMetaItem">@{log.actorUsuario}</span>
                            )}
                            {log.entityId && (
                              <span className="alLogMetaItem" title={log.entityId}>
                                ID: {truncate(log.entityId, 12)}
                              </span>
                            )}
                            {log.ipAddress && (
                              <span className="alLogMetaItem">IP: {log.ipAddress}</span>
                            )}
                            {hasMetadata && (
                              <span className="alLogMetaItem alLogMetaExpand">
                                {isExpanded ? "▾ Menos" : "▸ Detalhes"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="alLogDetails">
                          <div className="alLogDetailsGrid">
                            <div className="alLogDetailItem">
                              <span className="alLogDetailLabel">Data/Hora</span>
                              <span className="alLogDetailValue">{formatDate(log.createdAt)}</span>
                            </div>
                            <div className="alLogDetailItem">
                              <span className="alLogDetailLabel">ID do Log</span>
                              <span className="alLogDetailValue alLogDetailMono">{log.id}</span>
                            </div>
                            {log.actorId && (
                              <div className="alLogDetailItem">
                                <span className="alLogDetailLabel">Actor ID</span>
                                <span className="alLogDetailValue alLogDetailMono">{log.actorId}</span>
                              </div>
                            )}
                            {log.entityId && (
                              <div className="alLogDetailItem">
                                <span className="alLogDetailLabel">Entity ID</span>
                                <span className="alLogDetailValue alLogDetailMono">{log.entityId}</span>
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="alLogDetailItem alLogDetailFull">
                                <span className="alLogDetailLabel">User Agent</span>
                                <span className="alLogDetailValue alLogDetailMono">{log.userAgent}</span>
                              </div>
                            )}
                            {hasMetadata && (
                              <div className="alLogDetailItem alLogDetailFull">
                                <span className="alLogDetailLabel">Metadata</span>
                                <pre className="alLogDetailPre">
                                  {JSON.stringify(metadataObj, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Pagination
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </>
          )}
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
