import "./ExerciseComponents.css";

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
  return (
    <div className="mcqContainer">
      <div className="mcqQuestion">{question}</div>

      <div className="mcqOptions">
        {options.map((option) => {
          const inputId = `mcq-${question}-${option.letter}`
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-_]/g, "");

          return (
            <label
              key={option.letter}
              className="mcqOption"
              htmlFor={inputId}
              aria-label={`Opção ${option.letter}: ${option.text}`}
            >
              <input
                id={inputId}
                type="radio"
                name={question}
                value={option.letter}
                checked={selectedAnswer === option.letter}
                onChange={(e) => onAnswer(e.target.value)}
                disabled={disabled}
              />
              <span className="mcqLabel">
                <span className="mcqLetter">{option.letter})</span>
                <span className="mcqText">{option.text}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
