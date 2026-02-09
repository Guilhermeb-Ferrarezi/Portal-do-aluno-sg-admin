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
};

const SHORTCUT_LABELS: Record<ShortcutType, string> = {
  "copiar-colar": "Copiar e Colar (Ctrl+C, Ctrl+V)",
  "copiar-colar-imagens": "Copiar e Colar Imagens (Ctrl+C, Ctrl+V)",
  "selecionar-deletar": "Selecionar Tudo e Deletar (Ctrl+A, Delete)",
};

const SHORTCUTS: Record<ShortcutType, { keys: Set<string>; description: string }> = {
  "copiar-colar": {
    keys: new Set(["copiar", "colar"]),
    description: "Use Ctrl+C para copiar e Ctrl+V para colar",
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
}: ShortcutTrainingBoxProps) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [events, setEvents] = React.useState<ShortcutEvent[]>([]);
  const [isComplete, setIsComplete] = React.useState(false);
  const [pressedKeys, setPressedKeys] = React.useState<Set<string>>(new Set());
  const [feedback, setFeedback] = React.useState<string>("");

  const shortcutConfig = SHORTCUTS[shortcutType];
  const requiredKeys = shortcutConfig.keys;

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!boxRef.current || isComplete) return;

      const key = e.key.toLowerCase();
      const isCtrlCmd = e.ctrlKey || e.metaKey;


      let detectedAction = "";

      // Detectar atalhos específicos
      if (isCtrlCmd && key === "c") {
        detectedAction = "copiar";
        e.preventDefault();
      } else if (isCtrlCmd && key === "v") {
        detectedAction = "colar";
        e.preventDefault();
      } else if (isCtrlCmd && key === "a") {
        detectedAction = "selecionar-tudo";
        e.preventDefault();
      } else if (key === "delete") {
        detectedAction = "deletar";
        e.preventDefault();
      }

      if (detectedAction) {
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
      }
    },
    [isComplete, pressedKeys, requiredKeys, events, shortcutType, onComplete]
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const getProgressText = () => {
    const completed = Array.from(pressedKeys).length;
    const total = requiredKeys.size;
    return `${completed}/${total}`;
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
          <div className="shortcutLabel">
            🎹 {SHORTCUT_LABELS[shortcutType]}
          </div>
          <p className="shortcutHint">{shortcutConfig.description}</p>

          <div className="keyList">
            {Array.from(requiredKeys).map((key) => (
              <div
                key={key}
                className={`keyItem ${pressedKeys.has(key) ? "completed" : ""}`}
              >
                <span className="keyIcon">
                  {key === "copiar" && "📋"}
                  {key === "colar" && "📌"}
                  {key === "selecionar-tudo" && "✅"}
                  {key === "deletar" && "🗑️"}
                </span>
                <span className="keyName">
                  {key === "copiar" && "Copiar (Ctrl+C)"}
                  {key === "colar" && "Colar (Ctrl+V)"}
                  {key === "selecionar-tudo" && "Selecionar (Ctrl+A)"}
                  {key === "deletar" && "Deletar"}
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
