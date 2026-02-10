import React from "react";
import "./ExerciseComponents.css";

type ShortcutType = "copiar-colar" | "copiar-colar-imagens" | "selecionar-deletar";

type ShortcutEvent = {
  type: ShortcutType;
  timestamp: number;
};

type ShortcutTrainingBoxProps = {
  title: string;
  instruction: string;
  shortcutType: ShortcutType;
  onComplete?: (events: ShortcutEvent[]) => void;
  sample?: string;
};

const SHORTCUT_LABELS: Record<ShortcutType, string> = {
  "copiar-colar": "Copiar e Colar (Botão Direito)",
  "copiar-colar-imagens": "Copiar e Colar Imagens (Ctrl+C, Ctrl+V)",
  "selecionar-deletar": "Selecionar Tudo e Deletar (Ctrl+A, Delete)",
};

const SHORTCUTS: Record<ShortcutType, { keys: Set<string>; description: string }> = {
  "copiar-colar": {
    keys: new Set(["copiar", "colar"]),
    description: "Clique com botão direito na imagem → Copiar imagem, depois cole no campo à direita",
  },
  "copiar-colar-imagens": {
    keys: new Set(["copiar", "colar"]),
    description: "Use Ctrl+C para copiar a imagem e Ctrl+V para colar",
  },
  "selecionar-deletar": {
    keys: new Set(["selecionar-tudo", "deletar"]),
    description: "Use Ctrl+A para selecionar tudo e Delete para deletar",
  },
};

export default function ShortcutTrainingBox({
  title,
  instruction,
  shortcutType,
  onComplete,
  sample,
}: ShortcutTrainingBoxProps) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [events, setEvents] = React.useState<ShortcutEvent[]>([]);
  const [isComplete, setIsComplete] = React.useState(false);
  const [pressedKeys, setPressedKeys] = React.useState<Set<string>>(new Set());
  const [feedback, setFeedback] = React.useState<string>("");
  const [imageError, setImageError] = React.useState(false);

  const shortcutConfig = SHORTCUTS[shortcutType];
  const requiredKeys = shortcutConfig.keys;

  // Função reutilizável para registrar uma ação detectada
  const detectAction = React.useCallback(
    (detectedAction: string) => {
      if (isComplete) return;

      setPressedKeys((prev) => new Set([...prev, detectedAction]));

      // Verificar se completou
      let allKeysPressed = true;
      for (const requiredKey of requiredKeys) {
        if (!pressedKeys.has(requiredKey) && requiredKey !== detectedAction) {
          allKeysPressed = false;
          break;
        }
      }

      if (allKeysPressed) {
        const newEvent: ShortcutEvent = {
          type: shortcutType,
          timestamp: Date.now(),
        };
        const updatedEvents = [...events, newEvent];
        setEvents(updatedEvents);
        setIsComplete(true);
        setFeedback("✅ Parabéns! Você conseguiu!");
        onComplete?.(updatedEvents);
      } else {
        setFeedback(`✓ ${detectedAction.replace("-", " ")} detectado!`);
      }
    },
    [isComplete, pressedKeys, requiredKeys, events, shortcutType, onComplete]
  );

  // Listener de teclado (para tipos que usam Ctrl+C/V, Ctrl+A, Delete)
  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!boxRef.current || isComplete) return;
      // Tipo copiar-colar usa botão direito, não teclado
      if (shortcutType === "copiar-colar") return;

      const key = e.key.toLowerCase();
      const isCtrlCmd = e.ctrlKey || e.metaKey;

      let detectedActionKey = "";

      if (isCtrlCmd && key === "c") {
        detectedActionKey = "copiar";
        e.preventDefault();
      } else if (isCtrlCmd && key === "v") {
        detectedActionKey = "colar";
        e.preventDefault();
      } else if (isCtrlCmd && key === "a") {
        detectedActionKey = "selecionar-tudo";
        e.preventDefault();
      } else if (key === "delete") {
        detectedActionKey = "deletar";
        e.preventDefault();
      }

      if (detectedActionKey) {
        detectAction(detectedActionKey);
      }
    },
    [isComplete, shortcutType, detectAction]
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Listeners para tipo copiar-colar: detecta botão direito (contextmenu) e paste
  React.useEffect(() => {
    if (shortcutType !== "copiar-colar") return;
    if (isComplete) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG") return;
      detectAction("copiar");
    };

    const handlePaste = () => {
      detectAction("colar");
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("paste", handlePaste);
    };
  }, [shortcutType, isComplete, detectAction]);

  const getProgressText = () => {
    const completed = Array.from(pressedKeys).length;
    const total = requiredKeys.size;
    return `${completed}/${total}`;
  };

  const renderImageTrainingLayout = () => {
    const fallbackColor = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
        {/* Campo Esquerdo - Imagem para Copiar */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.7)" }}>
            📷 Imagem - Copie aqui
          </div>
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
            {sample && !imageError ? (
              <img
                src={sample}
                alt="Imagem para copiar"
                style={{ width: "100%", display: "block", cursor: "pointer", minHeight: 180, objectFit: "cover" }}
                title="Clique com botão direito → Copiar imagem"
                onError={() => setImageError(true)}
              />
            ) : (
              <div style={{ width: "100%", minHeight: 180, background: fallbackColor, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 600 }}>
                📸 Imagem de Exemplo
              </div>
            )}
          </div>
        </div>

        {/* Campo Direito - Área para Colar */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.7)" }}>
            📌 Cole aqui a imagem
          </div>
          <div
            style={{
              borderRadius: 8,
              border: "2px dashed rgba(255,255,255,0.2)",
              padding: 20,
              minHeight: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 14,
              cursor: "pointer",
              textAlign: "center"
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (items) {
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf("image") !== -1) {
                    setFeedback("✓ Imagem colada detectada!");
                  }
                }
              }
            }}
            tabIndex={0}
          >
            Botão direito → Colar
          </div>
        </div>
      </div>
    );
  };

  // Labels dos passos para copiar-colar (botão direito)
  const getKeyIcon = (key: string) => {
    if (key === "copiar") return shortcutType === "copiar-colar" ? "🖱️" : "📋";
    if (key === "colar") return "📌";
    if (key === "selecionar-tudo") return "✅";
    if (key === "deletar") return "🗑️";
    return "";
  };

  const getKeyName = (key: string) => {
    if (key === "copiar") return shortcutType === "copiar-colar" ? "Copiar (Botão Direito → Copiar imagem)" : "Copiar (Ctrl+C)";
    if (key === "colar") return shortcutType === "copiar-colar" ? "Colar (Botão Direito → Colar)" : "Colar (Ctrl+V)";
    if (key === "selecionar-tudo") return "Selecionar (Ctrl+A)";
    if (key === "deletar") return "Deletar";
    return key;
  };

  return (
    <div className="shortcutTrainingBox" ref={boxRef}>
      <div className="shortcutHeader">
        <h3 className="shortcutTitle">{title}</h3>
        <div className="shortcutProgress">
          <div className="progressBar">
            <div
              className="progressFill"
              style={{
                width: `${(Array.from(pressedKeys).length / requiredKeys.size) * 100}%`,
              }}
            />
          </div>
          <span className="progressText">{getProgressText()}</span>
        </div>
      </div>

      <p className="shortcutInstruction">{instruction}</p>

      <div className="shortcutArea">
        <div className="shortcutBox">
          {/* Layout especial para copiar-colar-imagens */}
          {shortcutType === "copiar-colar-imagens" ? (
            renderImageTrainingLayout()
          ) : (
            <>
              {sample && (
                <div style={{ marginBottom: 12 }}>
                  {(() => {
                    const isDataImage = typeof sample === "string" && sample.startsWith("data:image");
                    const isImageUrl = typeof sample === "string" && (/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(sample) || (/^https?:\/\//i.test(sample) && /placeholder|image|png|jpg|jpeg|gif/i.test(sample)));

                    if (isDataImage || isImageUrl) {
                      return (
                        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <img src={sample} alt="Exemplo" style={{ width: "100%", display: "block" }} />
                        </div>
                      );
                    }

                    return (
                      <div style={{ padding: 8, background: "var(--card)", borderRadius: 8, whiteSpace: "pre-wrap" }}>{sample}</div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          <div className="shortcutLabel">
            {shortcutType === "copiar-colar" ? "🖱️" : "🎹"} {SHORTCUT_LABELS[shortcutType]}
          </div>
          <p className="shortcutHint">{shortcutConfig.description}</p>

          <div className="keyList">
            {Array.from(requiredKeys).map((key) => (
              <div
                key={key}
                className={`keyItem ${pressedKeys.has(key) ? "completed" : ""}`}
              >
                <span className="keyIcon">
                  {getKeyIcon(key)}
                </span>
                <span className="keyName">
                  {getKeyName(key)}
                </span>
                <span className={`keyStatus ${pressedKeys.has(key) ? "done" : "pending"}`}>
                  {pressedKeys.has(key) ? "✓" : "○"}
                </span>
              </div>
            ))}
          </div>

          {feedback && (
            <div className={`shortcutFeedback ${isComplete ? "success" : "info"}`}>
              {feedback}
            </div>
          )}

          {isComplete && (
            <div className="shortcutSuccess">
              <div className="successIcon">🎉</div>
              <p>Exercício concluído com sucesso!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
