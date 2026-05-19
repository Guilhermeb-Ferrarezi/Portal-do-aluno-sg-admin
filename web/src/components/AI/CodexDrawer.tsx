import React from "react";
import { ChevronDown, Loader2, Maximize2, Plus, RefreshCcw, Send, Sparkles, Square, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  criarAiThread,
  enviarAiMessage,
  iniciarCodexDeviceAuth,
  obterCodexLoginStatus,
  interromperAiThread,
  listarAiThreads,
  obterAiThread,
  type AiThreadDetail,
  type AiThreadMessage,
  type AiThreadSummary,
  type CodexDeviceAuthChallenge,
} from "../../services/api";
import type { AiSendMessageContext } from "../../services/api/ai";

const PANEL_WIDTH_STORAGE_KEY = "codex-ai-panel-width-v1";
const PANEL_MIN_WIDTH = 380;
const PANEL_MAX_WIDTH = 760;
const PANEL_DEFAULT_WIDTH = 520;
const AUTH_STATUS_POLL_MS = 3000;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageTone(role: AiThreadMessage["role"]) {
  if (role === "assistant") {
    return "border-border/70 bg-background/75 text-foreground";
  }
  if (role === "user") {
    return "border-primary/20 bg-primary/10 text-foreground";
  }
  return "border-border/70 bg-muted/30 text-muted-foreground";
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error && /aborted|abort/i.test(error.message)
  );
}

function createLocalMessage(content: string): AiThreadMessage {
  return {
    id: Date.now() * -1,
    threadId: -1,
    runId: null,
    role: "user",
    content,
    metadata: null,
    createdAt: new Date().toISOString(),
  };
}

function getStatusLabel(status: string | null | undefined) {
  if (!status || status === "idle") return null;
  if (status === "running") return "Pensando...";
  if (status === "completed") return "Concluida";
  if (status === "interrupted") return "Interrompida";
  if (status === "failed") return "Falha";
  return status;
}

export type CodexDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: AiSendMessageContext;
};

export default function CodexDrawer({ open, onOpenChange, context }: CodexDrawerProps) {
  const [threads, setThreads] = React.useState<AiThreadSummary[]>([]);
  const [threadDetail, setThreadDetail] = React.useState<AiThreadDetail | null>(null);
  const [selectedThreadId, setSelectedThreadId] = React.useState<number | null>(null);
  const [codexAuthenticated, setCodexAuthenticated] = React.useState(false);
  const [codexCheckingAuth, setCodexCheckingAuth] = React.useState(false);
  const [codexAuthError, setCodexAuthError] = React.useState<string | null>(null);
  const [codexDeviceAuth, setCodexDeviceAuth] = React.useState<CodexDeviceAuthChallenge | null>(null);
  const [codexDeviceAuthLoading, setCodexDeviceAuthLoading] = React.useState(false);
  const [loadingThreads, setLoadingThreads] = React.useState(false);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [interrupting, setInterrupting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [composer, setComposer] = React.useState("");
  const [panelWidth, setPanelWidth] = React.useState(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_WIDTH;

    try {
      const raw = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : PANEL_DEFAULT_WIDTH;
      if (!Number.isFinite(parsed)) return PANEL_DEFAULT_WIDTH;
      return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(parsed)));
    } catch {
      return PANEL_DEFAULT_WIDTH;
    }
  });

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const dropdownContainerRef = React.useRef<HTMLDivElement | null>(null);
  const requestAbortRef = React.useRef<AbortController | null>(null);
  const selectedThreadIdRef = React.useRef<number | null>(null);
  const authPollRef = React.useRef<number | null>(null);
  const resizingRef = React.useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  React.useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  const resolvedWidth = React.useMemo(() => {
    if (typeof window === "undefined") return panelWidth;
    return Math.min(panelWidth, Math.max(320, window.innerWidth - 16));
  }, [panelWidth]);

  const sortedThreads = React.useMemo(
    () => [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [threads]
  );

  const visibleThreads = React.useMemo(() => {
    const latestDraftIds = new Set<number>();
    const draftThread = sortedThreads.find(
      (thread) => thread.title.trim() === "Nova conversa" && !thread.lastMessageAt
    );

    if (draftThread) {
      latestDraftIds.add(draftThread.id);
    }

    return sortedThreads.filter((thread) => {
      const isDraft = thread.title.trim() === "Nova conversa" && !thread.lastMessageAt;
      if (!isDraft) return true;
      return latestDraftIds.has(thread.id);
    });
  }, [sortedThreads]);

  const visibleMessages = threadDetail?.messages ?? [];
  const latestRunStatus = getStatusLabel(threadDetail?.latestRun?.status ?? threadDetail?.thread.status);
  const selectedThread = React.useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads]
  );
  const selectedThreadTitle = selectedThread?.title ?? "Nova conversa";
  const isAtMaxWidth = resolvedWidth >= PANEL_MAX_WIDTH || (typeof window !== "undefined" && resolvedWidth >= window.innerWidth - 24);

  const loadThreads = React.useCallback(async () => {
    setLoadingThreads(true);
    setError(null);
    try {
      const response = await listarAiThreads();
      setThreads(response.items);

      if (response.items.length > 0) {
        const currentSelected = selectedThreadIdRef.current;
        const nextSelected = currentSelected && response.items.some((thread) => thread.id === currentSelected)
          ? currentSelected
          : response.items[0]!.id;

        setSelectedThreadId(nextSelected);
        const detail = await obterAiThread(nextSelected);
        setThreadDetail(detail);
      } else {
        setSelectedThreadId(null);
        setThreadDetail(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar as conversas.");
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const refreshCodexAuthStatus = React.useCallback(async (silent = false) => {
    if (!silent) {
      setCodexCheckingAuth(true);
    }
    setCodexAuthError(null);
    try {
      const status = await obterCodexLoginStatus();
      setCodexAuthenticated(status.authenticated);
      setCodexDeviceAuth(status.deviceAuth);
      if (status.authenticated) {
        setCodexAuthError(null);
      }
      return status.authenticated;
    } catch (loadError) {
      setCodexAuthError(loadError instanceof Error ? loadError.message : "Falha ao verificar o login do Codex.");
      setCodexAuthenticated(false);
      return false;
    } finally {
      if (!silent) {
        setCodexCheckingAuth(false);
      }
    }
  }, []);

  const loadThreadsIfAuthed = React.useCallback(async () => {
    const authenticated = await refreshCodexAuthStatus();
    if (!authenticated) {
      setThreads([]);
      setThreadDetail(null);
      setSelectedThreadId(null);
      return;
    }

    await loadThreads();
  }, [loadThreads, refreshCodexAuthStatus]);

  const loadThreadDetail = React.useCallback(async (threadId: number) => {
    setLoadingThread(true);
    setError(null);
    try {
      const detail = await obterAiThread(threadId);
      setThreadDetail(detail);
      setSelectedThreadId(threadId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar a conversa.");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      setSending(false);
      setInterrupting(false);
      if (authPollRef.current) {
        window.clearInterval(authPollRef.current);
        authPollRef.current = null;
      }
      return;
    }

    void loadThreadsIfAuthed();
  }, [loadThreadsIfAuthed, open]);

  React.useEffect(() => {
    if (!open || codexAuthenticated) {
      if (authPollRef.current) {
        window.clearInterval(authPollRef.current);
        authPollRef.current = null;
      }
      return;
    }

    if (authPollRef.current) return;

    authPollRef.current = window.setInterval(() => {
      void refreshCodexAuthStatus(true).then((authenticated) => {
        if (authenticated && authPollRef.current) {
          window.clearInterval(authPollRef.current);
          authPollRef.current = null;
          void loadThreads();
        }
      });
    }, AUTH_STATUS_POLL_MS);

    return () => {
      if (authPollRef.current) {
        window.clearInterval(authPollRef.current);
        authPollRef.current = null;
      }
    };
  }, [codexAuthenticated, loadThreads, open, refreshCodexAuthStatus]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth));
    } catch {
      // Ignore persistence failures.
    }
  }, [panelWidth]);

  React.useEffect(() => {
    if (!threadDetail) return;
    const container = document.querySelector("[data-ai-chat-scroll]");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [threadDetail, visibleMessages.length]);

  React.useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
  }, [open]);

  function setThreadInList(nextThread: AiThreadSummary) {
    setThreads((current) => {
      const exists = current.some((thread) => thread.id === nextThread.id);
      if (!exists) {
        return [nextThread, ...current];
      }
      return current.map((thread) => (thread.id === nextThread.id ? nextThread : thread));
    });
  }

  async function handleCreateThread(initialTitle?: string): Promise<AiThreadSummary | null> {
    if (!codexAuthenticated) {
      return null;
    }
    const response = await criarAiThread({ title: initialTitle?.trim() || "Nova conversa" });
    setThreadInList(response.thread);
    setSelectedThreadId(response.thread.id);
    setThreadDetail({
      thread: response.thread,
      messages: [],
      runs: [],
      latestRun: null,
      events: [],
    });
    return response.thread;
  }

  async function handleSelectThread(threadId: number) {
    if (threadId === selectedThreadId) return;
    await loadThreadDetail(threadId);
  }

  async function handleStartDeviceAuth() {
    setCodexDeviceAuthLoading(true);
    setCodexAuthError(null);
    try {
      const status = await obterCodexLoginStatus();
      if (status.authenticated) {
        setCodexAuthenticated(true);
        setCodexDeviceAuth(status.deviceAuth);
        return;
      }
      const response = await iniciarCodexDeviceAuth();
      setCodexDeviceAuth(response.deviceAuth);
      setCodexAuthenticated(false);
    } catch (startError) {
      setCodexAuthError(startError instanceof Error ? startError.message : "Falha ao iniciar device auth.");
    } finally {
      setCodexDeviceAuthLoading(false);
    }
  }

  async function handleSendMessage() {
    const content = composer.trim();
    if (!content || sending || !codexAuthenticated) {
      return;
    }

    setError(null);
    setSending(true);
    setComposer("");
    const optimisticMessage = createLocalMessage(content);
    let optimisticThreadId: number | null = null;

    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        const created = await handleCreateThread(content);
        if (!created) {
          return;
        }
        threadId = created.id;
      }

      optimisticThreadId = threadId;
      setThreadDetail((current) => {
        if (!current) return current;
        if (current.thread.id !== threadId) return current;
        return {
          ...current,
          messages: [...current.messages, optimisticMessage],
        };
      });

      const abortController = new AbortController();
      requestAbortRef.current = abortController;

      const result = await enviarAiMessage(
        threadId,
        {
          content,
          context,
        },
        abortController.signal
      );

      setThreadDetail((current) => {
        const currentMessages = current?.thread.id === result.thread.id
          ? current.messages.filter((message) => message.id !== optimisticMessage.id)
          : [];
        const currentRuns = current?.thread.id === result.thread.id ? current.runs : [];

        return {
          thread: result.thread,
          messages: [...currentMessages, result.userMessage, ...(result.assistantMessage ? [result.assistantMessage] : [])],
          runs: [...currentRuns, result.run],
          latestRun: result.run,
          events: result.events.map((event, idx) => ({
            id: idx + 1,
            kind: event.kind,
            payload: event.payload,
            createdAt: event.createdAt,
          })),
        };
      });
      setThreadInList(result.thread);
    } catch (sendError) {
      if (!isAbortError(sendError)) {
        setComposer(content);
        if (optimisticThreadId) {
          setThreadDetail((current) => {
            if (!current || current.thread.id !== optimisticThreadId) return current;
            return {
              ...current,
              messages: current.messages.filter((message) => message.id !== optimisticMessage.id),
            };
          });
        }
        setError(sendError instanceof Error ? sendError.message : "Falha ao enviar a mensagem.");
      }
    } finally {
      requestAbortRef.current = null;
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  async function handleInterrupt() {
    if (!selectedThreadId || !sending || interrupting) {
      return;
    }

    setInterrupting(true);
    try {
      requestAbortRef.current?.abort();
      await interromperAiThread(selectedThreadId);
      await loadThreadDetail(selectedThreadId);
    } catch (interruptError) {
      if (!isAbortError(interruptError)) {
        setError(interruptError instanceof Error ? interruptError.message : "Nao foi possivel interromper a geracao.");
      }
    } finally {
      setInterrupting(false);
    }
  }

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingRef.current = {
      startX: event.clientX,
      startWidth: panelWidth,
    };

    const onMove = (moveEvent: PointerEvent) => {
      const snapshot = resizingRef.current;
      if (!snapshot) return;
      const delta = snapshot.startX - moveEvent.clientX;
      const nextWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, snapshot.startWidth + delta));
      setPanelWidth(nextWidth);
    };

    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleToggleExpand() {
    if (typeof window === "undefined") return;
    if (isAtMaxWidth) {
      setPanelWidth(PANEL_DEFAULT_WIDTH);
      return;
    }

    setPanelWidth(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, window.innerWidth - 16)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          requestAbortRef.current?.abort();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/35 backdrop-blur-[1px]"
        className="fixed top-0 right-0 left-auto z-[60] flex h-screen max-h-none max-w-none translate-x-0 translate-y-0 rounded-none border-l border-border/70 border-t-0 border-r-0 border-b-0 bg-[linear-gradient(180deg,rgba(16,21,34,0.98),rgba(12,16,27,0.98))] p-0 text-foreground shadow-[0_28px_100px_-40px_rgba(0,0,0,0.8)]"
        style={{ width: resolvedWidth }}
    >
      <DialogTitle className="sr-only">Codex do admin</DialogTitle>
      <DialogDescription className="sr-only">
        Conversas persistentes com o Codex CLI da VPS.
      </DialogDescription>
      <div ref={dropdownContainerRef} className="flex min-h-0 flex-1 flex-col">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-20 w-2 cursor-col-resize bg-transparent transition hover:bg-primary/10"
          onPointerDown={handleResizeStart}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground/80">
                Codex do admin
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-0 max-w-full justify-start gap-2 rounded-full px-4"
                      disabled={!codexAuthenticated}
                    >
                      <Sparkles data-icon="inline-start" />
                      <span className="truncate">{selectedThreadTitle}</span>
                      <ChevronDown data-icon="inline-end" className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    container={dropdownContainerRef.current}
                    className="z-[70] w-80 rounded-[20px] p-2"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                        Historico
                      </DropdownMenuLabel>

                      <div className="max-h-72 overflow-hidden">
                        <ScrollArea className="max-h-72 pr-1">
                          {loadingThreads ? (
                            <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                              <Loader2 size={14} className="animate-spin" />
                              Carregando conversas
                            </div>
                          ) : visibleThreads.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground">
                              Sem conversas salvas
                            </div>
                          ) : (
                            visibleThreads.map((thread) => {
                              const active = thread.id === selectedThreadId;
                              return (
                                <DropdownMenuItem
                                  key={thread.id}
                                  className={cn(
                                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5",
                                    active && "bg-primary/10 text-foreground"
                                  )}
                                  onClick={() => void handleSelectThread(thread.id)}
                                >
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {thread.title}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {formatDateTime(thread.updatedAt)}
                                  </span>
                                </DropdownMenuItem>
                              );
                            })
                          )}
                        </ScrollArea>
                      </div>

                      <DropdownMenuSeparator className="my-2" />

                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium"
                        onClick={() => void handleCreateThread()}
                      >
                        <Plus data-icon="inline-start" />
                        Nova conversa
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium"
                        onClick={() => void loadThreads()}
                      >
                        <RefreshCcw data-icon="inline-start" className={loadingThreads ? "animate-spin" : ""} />
                        Atualizar historico
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {latestRunStatus ? (
                  <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[10px] tracking-[0.18em]">
                    {latestRunStatus}
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {threadDetail ? `Atualizada em ${formatDateTime(threadDetail.thread.updatedAt)}` : "Nenhuma conversa selecionada"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleCreateThread()}
                title="Nova conversa"
                disabled={!codexAuthenticated}
              >
                <Plus data-icon="inline-start" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleToggleExpand}
                title={isAtMaxWidth ? "Reduzir painel" : "Expandir painel"}
                disabled={!codexAuthenticated}
              >
                <Maximize2 data-icon="inline-start" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                title="Fechar"
              >
                <X data-icon="inline-start" />
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="min-h-full px-5 py-4" data-ai-chat-scroll>
              {codexCheckingAuth ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <div className="max-w-md rounded-[28px] border border-border/70 bg-background/35 px-6 py-5 text-center">
                    <Loader2 className="mx-auto animate-spin" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Verificando login do Codex...
                    </p>
                  </div>
                </div>
              ) : !codexAuthenticated ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <div className="w-full max-w-xl rounded-[28px] border border-border/70 bg-background/35 p-6">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles data-icon="inline-start" className="text-primary" />
                      Codex nao esta logado neste container
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Para usar o chat, inicie o device auth e conclua o login no navegador.
                    </p>

                    {codexAuthError ? (
                      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100">
                        {codexAuthError}
                      </div>
                    ) : null}

                    {codexDeviceAuth ? (
                      <div className="mt-4 rounded-2xl border border-border/70 bg-background/50 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          Codigo de acesso
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-[rgba(7,10,18,0.55)] px-4 py-3">
                          <code className="text-base font-bold tracking-[0.24em] text-foreground">{codexDeviceAuth.code}</code>
                          <a
                            href={codexDeviceAuth.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                          >
                            Abrir link
                          </a>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Depois de autorizar, volte aqui. O chat libera sozinho.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => void handleStartDeviceAuth()}
                        disabled={codexDeviceAuthLoading}
                      >
                        {codexDeviceAuthLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                        {codexDeviceAuthLoading ? "Iniciando..." : "Fazer login"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadThreadsIfAuthed()}
                        disabled={codexCheckingAuth}
                      >
                        <RefreshCcw data-icon="inline-start" className={codexCheckingAuth ? "animate-spin" : ""} />
                        Verificar novamente
                      </Button>
                    </div>
                  </div>
                </div>
              ) : error ? (
                <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              {codexAuthenticated && loadingThread ? (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Carregando conversa...
                </div>
              ) : codexAuthenticated && visibleMessages.length === 0 ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <EmptyState
                    compact
                    icon={<Sparkles data-icon="inline-start" />}
                    title="Abra ou crie uma conversa"
                    description="Use o dropdown para voltar ao historico ou crie uma nova conversa no botao +."
                    actionLabel="Nova conversa"
                    onAction={() => void handleCreateThread()}
                    className="w-full max-w-xl border-border/60 bg-background/35"
                  />
                </div>
              ) : codexAuthenticated ? (
                <div className="space-y-3">
                  {visibleMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[92%] rounded-[24px] border px-4 py-3 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.55)]",
                        message.role === "user" ? "ml-auto" : "mr-auto",
                        messageTone(message.role)
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{message.role}</span>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">{message.content}</pre>
                    </div>
                  ))}

                  {sending ? (
                    <div className="mr-auto inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      Gerando resposta...
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="border-t border-white/5 px-5 py-4">
            <div className="rounded-[28px] border border-border/70 bg-background/55 p-3 shadow-[0_14px_40px_-30px_rgba(0,0,0,0.65)]">
              <textarea
                ref={textareaRef}
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder="O que voce quer perguntar ao Codex?"
                className="min-h-28 w-full resize-none rounded-[22px] border border-border/70 bg-[rgba(7,10,18,0.55)] px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/25 focus:ring-4 focus:ring-primary/10"
                disabled={sending || !codexAuthenticated}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {codexAuthenticated ? "Enter envia, Shift+Enter quebra linha." : "Faça login no Codex para enviar mensagens."}
                </div>
                <div className="flex items-center gap-2">
                  {sending && codexAuthenticated ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleInterrupt()}
                      disabled={interrupting}
                    >
                      {interrupting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Square data-icon="inline-start" />}
                      {interrupting ? "Interrompendo..." : "Interromper"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSendMessage()}
                    disabled={!codexAuthenticated || !composer.trim() || sending}
                  >
                    {sending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
                    {sending ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}
