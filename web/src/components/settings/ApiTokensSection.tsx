import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ChevronDown,
  KeyRound,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import {
  atualizarApiToken,
  criarApiToken,
  listarApiTokenScopes,
  listarApiTokens,
  revogarApiToken,
  type ApiTokenDetails,
  type ApiTokenScopeGroup,
} from "@/services/api";
import { cn } from "@/lib/utils";

type TokenFormState = {
  name: string;
  description: string;
  expiresAt: string;
  scopes: string[];
};

type PermissionFilter = "all" | "read" | "write";

const emptyForm: TokenFormState = {
  name: "",
  description: "",
  expiresAt: "",
  scopes: [],
};

const DEFAULT_TOKEN_SCOPE_GROUPS: ApiTokenScopeGroup[] = [
  {
    key: "operacoes",
    label: "Operacoes",
    description: "Acesso a tarefas operacionais do portal.",
    items: [
      {
        value: "turmas:read",
        label: "Ler turmas",
        description: "Visualizar turmas e seus detalhes.",
      },
      {
        value: "turmas:write",
        label: "Editar turmas",
        description: "Criar e alterar turmas.",
      },
      {
        value: "metas:read",
        label: "Ler metas",
        description: "Visualizar metas cadastradas.",
      },
      {
        value: "metas:write",
        label: "Editar metas",
        description: "Criar e alterar metas.",
      },
      {
        value: "medalhas:read",
        label: "Ler medalhas",
        description: "Visualizar medalhas e conquistas.",
      },
      {
        value: "medalhas:write",
        label: "Editar medalhas",
        description: "Criar e alterar medalhas.",
      },
      {
        value: "ranking_notas:read",
        label: "Ler ranking de notas",
        description: "Consultar o ranking de notas.",
      },
      {
        value: "ranking_notas:write",
        label: "Editar ranking de notas",
        description: "Alterar regras e registros do ranking de notas.",
      },
      {
        value: "ranking_pontos:read",
        label: "Ler ranking de pontos",
        description: "Consultar o ranking de pontos.",
      },
      {
        value: "ranking_pontos:write",
        label: "Editar ranking de pontos",
        description: "Alterar regras e registros do ranking de pontos.",
      },
      {
        value: "eventos_ranking:read",
        label: "Ler eventos de ranking",
        description: "Consultar eventos e historico de ranking.",
      },
      {
        value: "eventos_ranking:write",
        label: "Editar eventos de ranking",
        description: "Criar ou alterar eventos de ranking.",
      },
      {
        value: "notificacoes:read",
        label: "Ler notificacoes",
        description: "Consultar notificacoes do portal.",
      },
      {
        value: "notificacoes:write",
        label: "Editar notificacoes",
        description: "Criar e alterar notificacoes.",
      },
    ],
  },
  {
    key: "conteudo",
    label: "Conteudo",
    description: "Acesso aos recursos de estrutura e materiais.",
    items: [
      {
        value: "estrutura_geral:read",
        label: "Ler estrutura geral",
        description: "Visualizar a estrutura geral do portal.",
      },
      {
        value: "estrutura_geral:write",
        label: "Editar estrutura geral",
        description: "Criar e alterar a estrutura geral do portal.",
      },
      {
        value: "materiais:read",
        label: "Ler materiais",
        description: "Consultar materiais.",
      },
      {
        value: "materiais:write",
        label: "Editar materiais",
        description: "Criar e alterar materiais.",
      },
      {
        value: "videos:read",
        label: "Ler videos",
        description: "Consultar videos.",
      },
      {
        value: "videos:write",
        label: "Editar videos",
        description: "Criar e alterar videos.",
      },
    ],
  },
  {
    key: "administracao",
    label: "Administracao",
    description: "Acesso a usuarios e auditoria.",
    items: [
      {
        value: "usuarios:read",
        label: "Ler usuarios",
        description: "Consultar usuarios do sistema.",
      },
      {
        value: "usuarios:write",
        label: "Editar usuarios",
        description: "Criar e alterar usuarios.",
      },
      {
        value: "logs:read",
        label: "Ler logs",
        description: "Visualizar logs e auditoria.",
      },
    ],
  },
];

const tokenDialogOverlayClassName = "z-[10003] bg-black/72 backdrop-blur-md";
const tokenDialogClassName = "z-[10004] border-border/70 bg-background/95";
const policyMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;

const permissionFilterLabels: Record<PermissionFilter, string> = {
  all: "Todos",
  read: "Ler",
  write: "Editar",
};

function getPermissionFilterFromScope(scope: string): Exclude<PermissionFilter, "all"> | null {
  if (scope.endsWith(":read")) return "read";
  if (scope.endsWith(":write")) return "write";
  return null;
}

function stripPermissionPrefix(label: string) {
  return label.replace(/^(Ler|Editar)\s+/i, "");
}

type PermissionRow = {
  key: string;
  label: string;
  description: string;
  actions: Array<{
    label: "Ler" | "Editar";
    scopeValue: string;
  }>;
};

function buildPermissionRows(group: ApiTokenScopeGroup, filter: PermissionFilter): PermissionRow[] {
  const rows = new Map<string, PermissionRow>();

  group.items.forEach((item) => {
    const action = getPermissionFilterFromScope(item.value);
    if (!action) return;
    if (filter !== "all" && action !== filter) return;

    const rowKey = item.value.replace(/:(read|write)$/, "");
    const current = rows.get(rowKey);

    if (current) {
      current.actions.push({
        label: permissionFilterLabels[action] as "Ler" | "Editar",
        scopeValue: item.value,
      });
      return;
    }

    rows.set(rowKey, {
      key: rowKey,
      label: stripPermissionPrefix(item.label),
      description: item.description,
      actions: [
        {
          label: permissionFilterLabels[action] as "Ler" | "Editar",
          scopeValue: item.value,
        },
      ],
    });
  });

  return Array.from(rows.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function formatDateTime(value: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatExpiresAtInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeScopes(groups: ApiTokenScopeGroup[], selected: string[]) {
  const valid = new Set(groups.flatMap((group) => group.items.map((item) => item.value)));
  const normalized = selected.filter((scope) => valid.has(scope));
  const expanded = new Set<string>();

  normalized.forEach((scope) => {
    expanded.add(scope);
    if (scope.endsWith(":write")) {
      expanded.add(scope.replace(/:write$/, ":read"));
    }
  });

  return Array.from(expanded);
}

function isScopeSelected(selectedScopes: string[], scope: string) {
  if (selectedScopes.includes(scope)) return true;
  if (scope.endsWith(":read")) {
    const writeScope = scope.replace(/:read$/, ":write");
    return selectedScopes.includes(writeScope);
  }
  return false;
}

function tokenStatusLabel(status: ApiTokenDetails["status"]) {
  if (status === "revoked") return "Revogado";
  if (status === "expired") return "Expirado";
  return "Ativo";
}

type PermissionGroupsProps = {
  groups: ApiTokenScopeGroup[];
  openPolicies: string[];
  filter: PermissionFilter;
  onToggleGroup: (groupKey: string) => void;
  selectedScopes: string[];
  onToggleScope: (scope: string) => void;
};

function PermissionGroups({
  groups,
  openPolicies,
  filter,
  onToggleGroup,
  selectedScopes,
  onToggleScope,
}: PermissionGroupsProps) {
  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const groupRows = buildPermissionRows(group, filter);

        return (
          <div key={group.key} className="overflow-hidden rounded-xl border border-border/60 bg-background/50">
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left transition"
                onClick={() => onToggleGroup(group.key)}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {group.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {group.description}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200",
                    openPolicies.includes(group.key) && "rotate-180"
                  )}
                />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {openPolicies.includes(group.key) ? (
                <m.div
                  key={group.key}
                  initial={policyMotion.initial}
                  animate={policyMotion.animate}
                  exit={policyMotion.exit}
                  transition={policyMotion.transition}
                  className="overflow-hidden border-t border-border/60"
                >
                  <div className="divide-y divide-border/60">
                    {groupRows.length > 0 ? (
                      groupRows.map((row) => {
                        const rowActive = row.actions.some((action) => isScopeSelected(selectedScopes, action.scopeValue));
                        return (
                          <div
                            key={row.key}
                            className={cn(
                              "flex items-center justify-between gap-4 px-4 py-3 transition",
                              rowActive ? "bg-primary/8" : "bg-transparent hover:bg-muted/20"
                            )}
                          >
                            <span className="min-w-0 space-y-1">
                              <span className="block text-sm font-semibold text-foreground">
                                {row.label}
                              </span>
                              <span className="block text-xs leading-5 text-muted-foreground">
                                {row.description}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              {row.actions.map((action) => (
                                <label
                                  key={action.scopeValue}
                                  className={cn(
                                    "inline-flex min-w-[92px] items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition",
                                    isScopeSelected(selectedScopes, action.scopeValue) &&
                                      "border-primary/30 bg-primary/8"
                                  )}
                                >
                                  <Checkbox
                                    checked={isScopeSelected(selectedScopes, action.scopeValue)}
                                    onCheckedChange={() => onToggleScope(action.scopeValue)}
                                    className="shrink-0"
                                  />
                                  <span>{action.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        Nenhuma permissao de {permissionFilterLabels[filter].toLowerCase()} para este grupo.
                      </div>
                    )}
                  </div>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default function ApiTokensSection() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tokens, setTokens] = React.useState<ApiTokenDetails[]>([]);
  const [groups, setGroups] = React.useState<ApiTokenScopeGroup[]>(DEFAULT_TOKEN_SCOPE_GROUPS);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [secretToken, setSecretToken] = React.useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [selectedToken, setSelectedToken] = React.useState<ApiTokenDetails | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<ApiTokenDetails | null>(null);
  const [form, setForm] = React.useState<TokenFormState>(emptyForm);
  const [openPolicies, setOpenPolicies] = React.useState<string[]>(
    DEFAULT_TOKEN_SCOPE_GROUPS.map((group) => group.key)
  );
  const [permissionFilter, setPermissionFilter] = React.useState<PermissionFilter>("all");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tokensResponse, scopesResponse] = await Promise.all([
        listarApiTokens(),
        listarApiTokenScopes(),
      ]);
      setTokens(tokensResponse.items);
      setGroups(scopesResponse.items.length > 0 ? scopesResponse.items : DEFAULT_TOKEN_SCOPE_GROUPS);
    } catch (err) {
      setGroups(DEFAULT_TOKEN_SCOPE_GROUPS);
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar os tokens.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCount = tokens.filter((token) => token.status === "active").length;

  React.useEffect(() => {
    setOpenPolicies((current) => {
      const allowed = new Set(groups.map((group) => group.key));
      const filtered = current.filter((key) => allowed.has(key));
      return filtered.length > 0 ? filtered : groups.map((group) => group.key);
    });
  }, [groups]);

  const togglePolicyGroup = (groupKey: string) => {
    setOpenPolicies((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey]
    );
  };

  const changePermissionFilter = (filter: PermissionFilter) => {
    setPermissionFilter(filter);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedToken(null);
    setCreateOpen(true);
  };

  const openEdit = (token: ApiTokenDetails) => {
    setSelectedToken(token);
    setForm({
      name: token.name,
      description: token.description ?? "",
      expiresAt: formatExpiresAtInput(token.expiresAt),
      scopes: token.scopes,
    });
    setEditOpen(true);
  };

  const handleScopeToggle = (scope: string) => {
    setForm((prev) => {
      const hasScope = prev.scopes.includes(scope);
      const isWrite = scope.endsWith(":write");
      const readScope = isWrite ? scope.replace(/:write$/, ":read") : null;
      if (isWrite) {
        return {
          ...prev,
          scopes: hasScope
            ? prev.scopes.filter((item) => item !== scope && item !== readScope)
            : Array.from(new Set([...prev.scopes, readScope!, scope])),
        };
      }
      return {
        ...prev,
        scopes: hasScope ? prev.scopes.filter((item) => item !== scope) : [...prev.scopes, scope],
      };
    });
  };

  const handleCreate = async () => {
    setActionLoading(true);
    try {
      const response = await criarApiToken({
        name: form.name.trim(),
        description: form.description.trim() || null,
        scopes: normalizeScopes(groups, form.scopes),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      setTokens((current) => [response.token, ...current]);
      setSecretToken(response.secret);
      setCreateOpen(false);
      setForm(emptyForm);
      setCopiedSecret(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar o token.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedToken) return;
    setActionLoading(true);
    try {
      const response = await atualizarApiToken(selectedToken.publicId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        scopes: normalizeScopes(groups, form.scopes),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      setTokens((current) =>
        current.map((token) => (token.publicId === response.token.publicId ? response.token : token))
      );
      setEditOpen(false);
      setSelectedToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel atualizar o token.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      const response = await revogarApiToken(revokeTarget.publicId);
      setTokens((current) =>
        current.map((token) => (token.publicId === response.token.publicId ? response.token : token))
      );
      setRevokeOpen(false);
      setRevokeTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel revogar o token.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!secretToken) return;
    await navigator.clipboard?.writeText(secretToken);
    setCopiedSecret(true);
    window.setTimeout(() => setCopiedSecret(false), 2000);
  };

  const settingsCardClass =
    "rounded-[28px] border border-border/70 bg-[var(--surface-glass)] shadow-[0_24px_48px_-38px_rgba(0,0,0,0.45)]";
  const scopePillClass =
    "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-semibold text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <KeyRound size={14} />
            <span>API Tokens</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Tokens de API</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Crie credenciais para integrações externas acessarem a conta com os escopos
              permitidos. O segredo é exibido somente uma vez.
            </p>
          </div>
        </div>

        <Button className="h-11 rounded-xl" onClick={openCreate}>
          <Plus size={16} />
          <span>Gerar token</span>
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight text-foreground">Visao geral</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Tokens criados nesta conta e seu estado atual.
          </p>
        </div>
        <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background/20">
          <Table>
            <TableHeader>
              <TableRow className="bg-background/40 hover:bg-background/40">
                <TableHead className="pl-5">Token</TableHead>
                <TableHead>Permissoes</TableHead>
                <TableHead>Ultimo uso</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="pl-5 font-medium text-foreground">Total de tokens</TableCell>
                <TableCell>{tokens.length}</TableCell>
                <TableCell className="text-muted-foreground">Todos os tokens cadastrados</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-5 font-medium text-foreground">Ativos</TableCell>
                <TableCell>{activeCount}</TableCell>
                <TableCell className="text-muted-foreground">Prontos para uso</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-5 font-medium text-foreground">Revogados</TableCell>
                <TableCell>{tokens.filter((token) => token.status === "revoked").length}</TableCell>
                <TableCell className="text-muted-foreground">Invalidos por revogacao</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-5 font-medium text-foreground">Expirados</TableCell>
                <TableCell>{tokens.filter((token) => token.status === "expired").length}</TableCell>
                <TableCell className="text-muted-foreground">Fora do periodo de validade</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <Card className={settingsCardClass}>
        <CardContent className="space-y-4 p-5">
          {loading ? (
            <div className="grid min-h-[160px] place-items-center rounded-[24px] border border-dashed border-border/70 bg-background/40 text-sm text-muted-foreground">
              Carregando tokens...
            </div>
          ) : error ? (
            <div className="grid min-h-[160px] place-items-center rounded-[24px] border border-rose-500/20 bg-rose-500/5 px-6 text-center text-sm text-rose-600 dark:text-rose-300">
              {error}
            </div>
          ) : tokens.length === 0 ? (
            <div className="grid min-h-[220px] place-items-center rounded-[24px] border border-dashed border-border/70 bg-background/40 px-6 text-center">
              <div className="max-w-md space-y-4">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <KeyRound size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Nenhum token criado ainda</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Gere um token para conectar automacoes, agentes ou servicos externos com os
                    escopos corretos.
                  </p>
                </div>
                <Button className="rounded-xl" onClick={openCreate}>
                  <Plus size={16} />
                  <span>Criar primeiro token</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <Card key={token.publicId} className="border-border/70 bg-background/80">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-bold text-foreground">{token.name}</h3>
                          <Badge
                            variant={
                              token.status === "active"
                                ? "default"
                                : token.status === "revoked"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {tokenStatusLabel(token.status)}
                          </Badge>
                        </div>
                        {token.description ? (
                          <p className="text-sm leading-6 text-muted-foreground">{token.description}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {token.scopes.map((scope) => (
                            <span key={scope} className={scopePillClass}>
                              <CheckCircle2 size={12} className="text-primary" />
                              {scope}
                            </span>
                          ))}
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/35">
                          <dl className="grid divide-y divide-border/50 text-xs text-muted-foreground sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-border/50">
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                              <dt className="font-semibold text-foreground">Criado em</dt>
                              <dd className="text-right tabular-nums">{formatDateTime(token.createdAt)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                              <dt className="font-semibold text-foreground">Expira em</dt>
                              <dd className="text-right tabular-nums">{formatDateTime(token.expiresAt)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                              <dt className="font-semibold text-foreground">Ultimo uso</dt>
                              <dd className="text-right tabular-nums">{formatDateTime(token.lastUsedAt)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                              <dt className="font-semibold text-foreground">ID publico</dt>
                              <dd className="max-w-[180px] truncate font-mono text-right text-[11px]">
                                {token.publicId}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(token)}>
                          <PencilLine size={14} />
                          <span>Editar</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => {
                            setRevokeTarget(token);
                            setRevokeOpen(true);
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Revogar</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {secretToken ? (
        <Dialog open onOpenChange={(open) => !open && setSecretToken(null)}>
          <DialogContent
            overlayClassName={tokenDialogOverlayClassName}
            className={`max-w-2xl ${tokenDialogClassName}`}
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>Token criado</DialogTitle>
              <DialogDescription>
                Copie o segredo agora. Depois de fechar esta janela, ele nao sera mostrado novamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 pb-2">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-emerald-500" size={18} />
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground">Seu token foi criado com sucesso</div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Guarde este valor agora. Ele nao pode ser recuperado depois.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Segredo do token
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border/70 bg-background px-4 py-3 font-mono text-sm text-foreground">
                    {secretToken}
                  </code>
                  <Button onClick={handleCopySecret} className="rounded-xl">
                    <Copy size={14} />
                    <span>{copiedSecret ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="font-semibold text-foreground">Uso recomendado</div>
                  <div className="mt-1 leading-6">
                    Armazene em um cofre de segredos ou variavel de ambiente.
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="font-semibold text-foreground">Seguranca</div>
                  <div className="mt-1 leading-6">
                    Se vazar, revogue e gere um novo token imediatamente.
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSecretToken(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          overlayClassName={tokenDialogOverlayClassName}
          className={`max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden ${tokenDialogClassName}`}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Criar API Token</DialogTitle>
            <DialogDescription>
              Nomeie a integracao, selecione os escopos e defina uma expiracao opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-2">
            <div className="space-y-2">
              <Label htmlFor="api-token-name">Nome do token</Label>
              <Input
                id="api-token-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex.: Integração com ERP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-token-description">Descricao (opcional)</Label>
              <textarea
                id="api-token-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                className="min-h-24 w-full resize-y rounded-[1rem] border border-input bg-[var(--input-bg)] px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/35 placeholder:text-muted-foreground"
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Permissoes</Label>
                <span className="text-xs text-muted-foreground">
                  Selecione apenas o necessario.
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">Editar policy</div>
                  <div className="text-xs text-muted-foreground">
                    Filtre os tipos de permissao exibidos em toda a lista.
                  </div>
                </div>
                <Select value={permissionFilter} onValueChange={(value) => changePermissionFilter(value as PermissionFilter)}>
                  <SelectTrigger className="h-10 w-[160px] rounded-xl border-border/70 bg-background/80 text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="read">Ler</SelectItem>
                    <SelectItem value="write">Editar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <PermissionGroups
                groups={groups}
                openPolicies={openPolicies}
                filter={permissionFilter}
                onToggleGroup={togglePolicyGroup}
                selectedScopes={form.scopes}
                onToggleScope={handleScopeToggle}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-token-expires-at">Expiracao opcional</Label>
              <Input
                id="api-token-expires-at"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={actionLoading || !form.name.trim() || form.scopes.length === 0}
            >
              {actionLoading ? "Criando..." : "Criar token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          overlayClassName={tokenDialogOverlayClassName}
          className={`max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden ${tokenDialogClassName}`}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Editar token</DialogTitle>
            <DialogDescription>
              Atualize metadados, permissões ou validade do token.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-2">
            <div className="space-y-2">
              <Label htmlFor="edit-api-token-name">Nome do token</Label>
              <Input
                id="edit-api-token-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-api-token-description">Descricao (opcional)</Label>
              <textarea
                id="edit-api-token-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                className="min-h-24 w-full resize-y rounded-[1rem] border border-input bg-[var(--input-bg)] px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/35 placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-3">
              <Label>Permissoes</Label>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">Editar policy</div>
                  <div className="text-xs text-muted-foreground">
                    Filtre os tipos de permissao exibidos em toda a lista.
                  </div>
                </div>
                <Select value={permissionFilter} onValueChange={(value) => changePermissionFilter(value as PermissionFilter)}>
                  <SelectTrigger className="h-10 w-[160px] rounded-xl border-border/70 bg-background/80 text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="read">Ler</SelectItem>
                    <SelectItem value="write">Editar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <PermissionGroups
                groups={groups}
                openPolicies={openPolicies}
                filter={permissionFilter}
                onToggleGroup={togglePolicyGroup}
                selectedScopes={form.scopes}
                onToggleScope={handleScopeToggle}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-api-token-expires-at">Expiracao opcional</Label>
              <Input
                id="edit-api-token-expires-at"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={actionLoading || !form.name.trim()}>
              {actionLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent
          overlayClassName={tokenDialogOverlayClassName}
          className={`max-w-lg ${tokenDialogClassName}`}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Revogar token</DialogTitle>
            <DialogDescription>
              Esta acao invalida imediatamente o token para todas as integracoes que o usam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm leading-6 text-rose-700 dark:text-rose-200">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                <span>Confirmacao necessaria</span>
              </div>
              {revokeTarget ? (
                <p>
                  Voce esta prestes a revogar <strong>{revokeTarget.name}</strong>. O segredo nao
                  podera ser recuperado.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmRevoke()} disabled={actionLoading}>
              {actionLoading ? "Revogando..." : "Revogar token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
