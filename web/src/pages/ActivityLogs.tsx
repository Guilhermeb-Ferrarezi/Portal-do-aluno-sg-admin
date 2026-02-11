import React from "react";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import Pagination from "../components/Pagination";
import { FadeInUp } from "../components/animate-ui/FadeInUp";
import { AnimatedButton } from "../components/animate-ui/AnimatedButton";
import { listarActivityLogs, type ActivityLog } from "../services/api";
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
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
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [totalItems, setTotalItems] = React.useState(0);

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

  return (
    <DashboardLayout
      title="Logs de Atividade"
      subtitle="Acompanhe alteracoes feitas no sistema"
    >
      <FadeInUp duration={0.28}>
        <div className="activityLogsContainer">
          <div className="logsHeader">
            <div className="logsFilters">
              <input
                type="text"
                className="filterInput"
                placeholder="Buscar por usuario, acao, entidade..."
                value={draft.q}
                onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
              />
              <input
                type="text"
                className="filterInput"
                placeholder="Acao (ex: create, update)"
                value={draft.action}
                onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}
              />
              <input
                type="text"
                className="filterInput"
                placeholder="Entidade (ex: user, turma)"
                value={draft.entityType}
                onChange={(e) => setDraft((prev) => ({ ...prev, entityType: e.target.value }))}
              />
              <input
                type="text"
                className="filterInput"
                placeholder="Actor ID"
                value={draft.actorId}
                onChange={(e) => setDraft((prev) => ({ ...prev, actorId: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="filterInput"
                value={draft.from}
                onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                title="Data inicial"
              />
              <input
                type="datetime-local"
                className="filterInput"
                value={draft.to}
                onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                title="Data final"
              />
            </div>
            <div className="logsActions">
              <AnimatedButton className="btnPrimary" onClick={aplicarFiltros}>
                Filtrar
              </AnimatedButton>
              <AnimatedButton className="btnGhost" onClick={limparFiltros}>
                Limpar
              </AnimatedButton>
              <AnimatedButton className="btnGhost" onClick={carregarLogs}>
                Atualizar
              </AnimatedButton>
            </div>
          </div>

          {loading ? (
            <div className="logsState">Carregando logs...</div>
          ) : erro ? (
            <div className="logsState logsError">Erro: {erro}</div>
          ) : logs.length === 0 ? (
            <div className="logsState">Nenhum log encontrado.</div>
          ) : (
            <>
              <div className="logsTableContainer">
                <table className="logsTable">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Ator</th>
                      <th>Acao</th>
                      <th>Entidade</th>
                      <th>Origem</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const actorName = log.actorNome || log.actorUsuario || "Sistema";
                      const actorRole = log.actorRole ?? "desconhecido";
                      const actorRoleClass = log.actorRole ?? "unknown";
                      const metadataText =
                        typeof log.metadata === "string"
                          ? log.metadata
                          : log.metadata
                          ? JSON.stringify(log.metadata)
                          : "-";
                      return (
                        <tr key={log.id}>
                          <td>
                            <div className="logPrimary">{formatDate(log.createdAt)}</div>
                            <div className="logSecondary">{log.id}</div>
                          </td>
                          <td>
                            <div className="logPrimary">{actorName}</div>
                            <div className="logSecondary">
                              {log.actorUsuario ? `@${log.actorUsuario}` : log.actorId || "-"}
                            </div>
                            <span className={`logRole role-${actorRoleClass}`}>
                              {actorRole}
                            </span>
                          </td>
                          <td>
                            <span className="logBadge">{log.action}</span>
                          </td>
                          <td>
                            <div className="logPrimary">{log.entityType}</div>
                            <div className="logSecondary">{log.entityId || "-"}</div>
                          </td>
                          <td>
                            <div className="logPrimary" title={log.ipAddress ?? ""}>
                              {log.ipAddress || "-"}
                            </div>
                            <div className="logSecondary" title={log.userAgent ?? ""}>
                              {truncate(log.userAgent, 36)}
                            </div>
                          </td>
                          <td>
                            <div className="logSecondary" title={metadataText}>
                              {truncate(metadataText, 60)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
