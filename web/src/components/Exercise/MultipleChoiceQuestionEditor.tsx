import React from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import ConfirmModal from "../ConfirmModal";

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
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

  return (
    <Card className="border border-border/70 bg-card/95 py-0 shadow-sm">
      <CardContent className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Questão {questionIndex + 1}
            </p>
            <h4 className="text-sm font-semibold text-foreground">
              Configure as opções e marque a resposta correta.
            </h4>
          </div>
          {onRemoveQuestao && (
            <Button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              disabled={disabled}
              title="Remover questão"
              aria-label={`Remover questão ${questionIndex + 1}`}
              size="icon-sm"
              variant="destructive"
              className="shrink-0"
            >
              <X size={16} />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {opcoes.map((opcao, oIndex) => (
            <div key={`op-${opcao.letter}-${oIndex}`} className="space-y-2">
              <Label
                htmlFor={`mcq-option-${questionIndex}-${opcao.letter}`}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Opção {opcao.letter}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`mcq-option-${questionIndex}-${opcao.letter}`}
                  type="text"
                  placeholder={`Digite a opção ${opcao.letter}...`}
                  value={opcao.text}
                  onChange={(e) => onChangeOpcao(oIndex, e.target.value)}
                  disabled={disabled}
                  className="h-10 bg-background/70"
                />
                {onRemoveOpcao && opcoes.length > 2 && (
                  <Button
                    type="button"
                    onClick={() => onRemoveOpcao(oIndex)}
                    disabled={disabled}
                    size="icon-sm"
                    variant="destructive"
                    aria-label={`Remover opção ${opcao.letter}`}
                    title={`Remover opção ${opcao.letter}`}
                    className="shrink-0"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Resposta correta
          </p>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((opcao) => (
              <label
                key={opcao.letter}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                  disabled && "cursor-not-allowed opacity-60",
                  respostaCorreta === opcao.letter
                    ? "border-primary/45 bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-accent hover:text-foreground"
                )}
              >
                <input
                  type="radio"
                  name={`respostaCorreta_${questionIndex}`}
                  value={opcao.letter}
                  checked={respostaCorreta === opcao.letter}
                  onChange={(e) => onChangeCorreta(e.target.value)}
                  disabled={disabled}
                  className="size-4 accent-[var(--primary)]"
                />
                {opcao.letter}
              </label>
            ))}
          </div>
        </div>

        {onAddOpcao && (
          <Button
            type="button"
            onClick={onAddOpcao}
            disabled={disabled || opcoes.length >= 5}
            variant="outline"
            size="sm"
            className="w-fit"
          >
            <Plus size={14} />
            Adicionar opção
          </Button>
        )}
      </CardContent>

      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Remover questão"
        message="Tem certeza que deseja remover esta questão?"
        confirmText="Remover"
        cancelText="Cancelar"
        danger={true}
        onConfirm={() => {
          setShowConfirmDelete(false);
          onRemoveQuestao?.();
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </Card>
  );
}
