import * as React from "react";

import { cn } from "@/lib/utils";

export type Option = {
  letter: string;
  text: string;
};

type MultipleChoiceQuestionProps = {
  question: string;
  options: Option[];
  selectedAnswer?: string;
  onAnswer: (letter: string) => void;
  disabled?: boolean;
};

export default function MultipleChoiceQuestion({
  question,
  options,
  selectedAnswer,
  onAnswer,
  disabled = false,
}: MultipleChoiceQuestionProps) {
  const groupId = React.useId();

  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
      <div className="text-sm font-semibold leading-6 text-foreground">{question}</div>

      <div className="mt-4 flex flex-col gap-3">
        {options.map((option) => {
          const inputId = `${groupId}-${option.letter.toLowerCase()}`;
          const isSelected = selectedAnswer === option.letter;

          return (
            <label
              key={option.letter}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-primary/40 hover:bg-accent/40",
                isSelected
                  ? "border-primary/45 bg-primary/8 shadow-sm"
                  : "border-border/70 bg-background/70"
              )}
              htmlFor={inputId}
              aria-label={`Opção ${option.letter}: ${option.text}`}
            >
              <input
                id={inputId}
                type="radio"
                name={groupId}
                value={option.letter}
                checked={selectedAnswer === option.letter}
                onChange={(e) => onAnswer(e.target.value)}
                disabled={disabled}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {option.letter}
                </span>
                <span className="min-w-0 text-sm leading-6 text-foreground">
                  {option.text || "Sem conteúdo informado."}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
