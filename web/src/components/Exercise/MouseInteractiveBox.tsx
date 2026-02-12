import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  ClipboardList,
  MousePointer,
  MousePointerClick,
} from "lucide-react";
import "./ExerciseComponents.css";

type MouseEvent = {
  type: "click" | "double-click" | "right-click" | "move";
  x: number;
  y: number;
  timestamp: number;
};

type MouseRules = {
  clicksSimples?: number;
  duplosClicks?: number;
  clicksDireitos?: number;
};

type MouseInteractiveBoxProps = {
  title: string;
  instruction: string;
  onInteraction?: (events: MouseEvent[]) => void;
  rules?: MouseRules;
  onComplete?: () => void;
};

export default function MouseInteractiveBox({
  title,
  instruction,
  onInteraction,
  rules,
  onComplete,
}: MouseInteractiveBoxProps) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [events, setEvents] = React.useState<MouseEvent[]>([]);
  const [cursor, setCursor] = React.useState({ x: 0, y: 0 });
  const [isComplete, setIsComplete] = React.useState(false);
  const clickTimeoutRef = React.useRef<any>(undefined);

  // Função para validar se as regras foram atingidas
  const checkRulesCompletion = React.useCallback((currentEvents: MouseEvent[]) => {
    if (!rules || Object.values(rules).every(v => v === 0 || v === undefined)) {
      return false; // Sem regras definidas
    }

    const clicksCount = currentEvents.filter(e => e.type === "click").length;
    const doubleClicksCount = currentEvents.filter(e => e.type === "double-click").length;
    const rightClicksCount = currentEvents.filter(e => e.type === "right-click").length;

    const hasClicksSimples = !rules.clicksSimples || clicksCount >= rules.clicksSimples;
    const hasDuplosClicks = !rules.duplosClicks || doubleClicksCount >= rules.duplosClicks;
    const hasClicksDireitos = !rules.clicksDireitos || rightClicksCount >= rules.clicksDireitos;

    return hasClicksSimples && hasDuplosClicks && hasClicksDireitos;
  }, [rules]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boxRef.current) return;

    const rect = boxRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCursor({ x, y });
  };

  const handleMouseLeave = () => {
    setCursor({ x: -100, y: -100 });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boxRef.current) return;

    const rect = boxRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Detectar clique duplo
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      const newEvent: MouseEvent = {
        type: "double-click",
        x,
        y,
        timestamp: Date.now(),
      };
      const updatedEvents = [...events, newEvent];
      setEvents(updatedEvents);
      onInteraction?.(updatedEvents);

      // Validar regras
      if (checkRulesCompletion(updatedEvents) && !isComplete) {
        setIsComplete(true);
        onComplete?.();
      }
      clickTimeoutRef.current = undefined;
    } else {
      const newEvent: MouseEvent = {
        type: "click",
        x,
        y,
        timestamp: Date.now(),
      };
      const updatedEvents = [...events, newEvent];
      setEvents(updatedEvents);
      onInteraction?.(updatedEvents);

      // Validar regras
      if (checkRulesCompletion(updatedEvents) && !isComplete) {
        setIsComplete(true);
        onComplete?.();
      }

      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = undefined;
      }, 300);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!boxRef.current) return;

    const rect = boxRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newEvent: MouseEvent = {
      type: "right-click",
      x,
      y,
      timestamp: Date.now(),
    };
    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);
    onInteraction?.(updatedEvents);

    // Validar regras
    if (checkRulesCompletion(updatedEvents) && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  };

  const resetEvents = () => {
    setEvents([]);
  };

  return (
    <div className="mouseBoxContainer">
      <div className="mouseBoxHeader">
        <h4 className="mouseBoxTitle">{title}</h4>
        <button
          className="mouseBoxReset"
          onClick={resetEvents}
          type="button"
          title="Limpar eventos"
        >
          ↺ Limpar
        </button>
      </div>

      <p className="mouseBoxInstruction">{instruction}</p>

      <div
        ref={boxRef}
        className="mouseInteractiveBox"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Indicador do cursor */}
        {cursor.x >= 0 && cursor.y >= 0 && (
          <div
            className="mouseCursor"
            style={{
              left: `${cursor.x}px`,
              top: `${cursor.y}px`,
            }}
          >
            <div className="mouseCursorArrow">
              <ArrowUp size={16} />
            </div>
          </div>
        )}

        {/* Mostra eventos de clique */}
        {events.map((event, index) => (
          <div
            key={index}
            className={`mouseEvent mouseEvent-${event.type}`}
            style={{
              left: `${event.x}px`,
              top: `${event.y}px`,
            }}
            title={`${event.type} em ${new Date(event.timestamp).toLocaleTimeString()}`}
          >
            <span className="mouseEventLabel">
              {event.type === "click" && <MousePointerClick size={14} />}
              {event.type === "double-click" && (
                <span style={{ display: "inline-flex", gap: 2 }}>
                  <MousePointerClick size={14} />
                  <MousePointerClick size={14} />
                </span>
              )}
              {event.type === "right-click" && (
                <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <MousePointer size={14} />
                  <ArrowRight size={12} />
                </span>
              )}
            </span>
          </div>
        ))}

        <div className="mouseBoxContent">
          <p className="mouseBoxHint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Clique, duplo-clique ou clique direito aqui
          </p>
        </div>
      </div>

      {/* PROGRESSO E REGRAS */}
      {rules && Object.values(rules).some(v => v && v > 0) && (
        <div style={{
          background: isComplete ? "#dcfce7" : "#f0fdf4",
          border: `2px solid ${isComplete ? "#86efac" : "#bbf7d0"}`,
          borderRadius: "8px",
          padding: "12px",
          marginTop: "12px",
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: isComplete ? "#166534" : "#22c55e", margin: "0 0 8px 0" }}>
            {isComplete ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={14} /> Desafio Completo!
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ClipboardList size={14} /> Progresso do Desafio:
              </span>
            )}
          </p>

          <div style={{ fontSize: 12, color: isComplete ? "#166534" : "#166534", lineHeight: "1.6" }}>
            {rules.clicksSimples && rules.clicksSimples > 0 && (
              <div style={{ marginBottom: "4px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MousePointer size={14} /> Cliques esquerdos:
                </span>{" "}
                <strong>{events.filter(e => e.type === "click").length} / {rules.clicksSimples}</strong>
              </div>
            )}
            {rules.duplosClicks && rules.duplosClicks > 0 && (
              <div style={{ marginBottom: "4px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MousePointerClick size={14} />
                  <MousePointerClick size={14} /> Duplos cliques:
                </span>{" "}
                <strong>{events.filter(e => e.type === "double-click").length} / {rules.duplosClicks}</strong>
              </div>
            )}
            {rules.clicksDireitos && rules.clicksDireitos > 0 && (
              <div style={{ marginBottom: "4px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MousePointer size={14} />
                  <ArrowRight size={12} /> Cliques direitos:
                </span>{" "}
                <strong>{events.filter(e => e.type === "right-click").length} / {rules.clicksDireitos}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Histórico de eventos */}
      {events.length > 0 && (
        <div className="mouseEventHistory">
          <h5>Histórico de Cliques ({events.length})</h5>
          <div className="eventsList">
            {events.map((event, index) => (
              <div key={index} className="eventItem">
                <span className="eventIndex">#{index + 1}</span>
                <span className="eventType">{event.type}</span>
                <span className="eventCoords">
                  ({event.x.toFixed(0)}, {event.y.toFixed(0)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
