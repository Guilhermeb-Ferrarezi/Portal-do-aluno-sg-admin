import { API_BASE_URL, buildAuthHeaders, parseError } from "./core";

export type ApiSseMessage = {
  event: string;
  data: string;
};

export type ApiSseHandlers = {
  onMessage?: (message: ApiSseMessage) => void;
  onOpen?: (response: Response) => void;
  onError?: (error: unknown) => void;
};

export async function consumeApiSse(path: string, handlers: ApiSseHandlers = {}, signal?: AbortSignal) {
  const headers = await buildAuthHeaders({
    Accept: "text/event-stream",
  });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (!response.body) {
    throw new Error("Streaming nao suportado neste navegador.");
  }

  handlers.onOpen?.(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataBuffer = "";

  const flushEvent = () => {
    const trimmed = dataBuffer.replace(/\n$/, "");
    if (trimmed.length === 0) {
      return;
    }

    handlers.onMessage?.({
      event: eventName,
      data: trimmed,
    });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }

        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) {
          flushEvent();
          eventName = "message";
          dataBuffer = "";
          continue;
        }

        if (line.startsWith(":")) {
          continue;
        }

        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim() || "message";
          continue;
        }

        if (line.startsWith("data:")) {
          const valueText = line.slice(5).replace(/^ /, "");
          dataBuffer += `${valueText}\n`;
        }
      }
    }

    if (dataBuffer) {
      flushEvent();
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      handlers.onError?.(error);
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
