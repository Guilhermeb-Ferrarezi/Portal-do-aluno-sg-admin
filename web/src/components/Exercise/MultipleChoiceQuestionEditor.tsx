import { Trash2 } from "lucide-react";
import "./ExerciseComponents.css";

export type Option = {
  letter: string;
  text: string;
};

type MultipleChoiceQuestionEditorProps = {
  questionIndex: number;
  opcoes: Option[];
  respostaCorreta: string;
  onChangeOpcao: (opcaoIndex: number, val: string) => void;
  onChangeCorreta: (val: string) => void;
  onAddOpcao?: () => void;
  onRemoveOpcao?: (opcaoIndex: number) => void;
  onRemoveQuestao?: () => void;
  disabled?: boolean;
};

export default function MultipleChoiceQuestionEditor({
  questionIndex,
  opcoes,
  respostaCorreta,
  onChangeOpcao,
  onChangeCorreta,
  onAddOpcao,
  onRemoveOpcao,
  onRemoveQuestao,
  disabled = false,
}: MultipleChoiceQuestionEditorProps) {
  return (
    <div
      className="mcqEditorContainer"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1f2937" }}>
        Questão {questionIndex + 1}
      </h4>

      {/* Campos de opções */}
      {opcoes.map((opcao, oIndex) => (
        <div key={`op-${opcao.letter}-${oIndex}`} style={{ marginBottom: "12px" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
            Opção {opcao.letter}
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder={`Digite a Opção ${opcao.letter}...`}
              value={opcao.text}
              onChange={(e) => onChangeOpcao(oIndex, e.target.value)}
              disabled={disabled}
              style={{
                flex: 1,
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            {onRemoveOpcao && opcoes.length > 2 && (
              <button
                type="button"
                onClick={() => onRemoveOpcao(oIndex)}
                disabled={disabled}
                style={{
                  padding: "8px 12px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Radio buttons para resposta correta */}
      <div style={{ marginBottom: "12px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 0, marginBottom: "8px" }}>
          Resposta Correta:
        </p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {opcoes.map((opcao) => (
            <label key={opcao.letter} style={{ display: "flex", alignItems: "center", fontSize: "14px", cursor: "pointer" }}>
              <input
                type="radio"
                name={`respostaCorreta_${questionIndex}`}
                value={opcao.letter}
                checked={respostaCorreta === opcao.letter}
                onChange={(e) => onChangeCorreta(e.target.value)}
                disabled={disabled}
                style={{ marginRight: "6px", cursor: "pointer" }}
              />
              {opcao.letter}
            </label>
          ))}
        </div>
      </div>

      {/* Botões de ação */}
      <div style={{ display: "flex", gap: "8px" }}>
        {onAddOpcao && (
          <button
            type="button"
            onClick={onAddOpcao}
            disabled={disabled || opcoes.length >= 5}
            style={{
              padding: "6px 12px",
              background: "#dbeafe",
              color: "#0c4a6e",
              border: "1px solid #93c5fd",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            + Opção
          </button>
        )}
        {onRemoveQuestao && (
          <button
            type="button"
            onClick={onRemoveQuestao}
            disabled={disabled}
            style={{
              padding: "6px 12px",
              background: "#fecaca",
              color: "#991b1b",
              border: "1px solid #fca5a5",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <Trash2 size={14} style={{ marginRight: "4px" }} />
            Remover
          </button>
        )}
      </div>
    </div>
  );
}
