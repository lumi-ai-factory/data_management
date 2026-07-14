import * as React from "react";
import { Check, X, HelpCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreAnswer } from "@/lib/quiz";
import type { Quiz as QuizData } from "@/lib/quiz";
import { Confetti } from "./Confetti";

type AnswerState = {
  selected: Set<number>;
  answered: boolean;
  /** Fraction between 0 and 1 (1 = fully correct). */
  score: number;
};

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function Quiz({ title, questions }: QuizData) {
  const [current, setCurrent] = React.useState(0);
  const [states, setStates] = React.useState<Record<number, AnswerState>>({});

  if (questions.length === 0) return null;

  const question = questions[current];
  const state = states[current];
  const answered = state?.answered ?? false;
  const selected = state?.selected ?? new Set<number>();
  const isLast = current === questions.length - 1;
  const allAnswered = questions.every((_, i) => states[i]?.answered);
  const score = questions.reduce((acc, _, i) => acc + (states[i]?.score ?? 0), 0);

  const setState = (next: AnswerState) => setStates((prev) => ({ ...prev, [current]: next }));

  const handleOptionClick = (idx: number) => {
    if (answered) return;
    if (question.multi) {
      const nextSelected = new Set(selected);
      if (nextSelected.has(idx)) nextSelected.delete(idx);
      else nextSelected.add(idx);
      setState({ selected: nextSelected, answered: false, score: 0 });
    } else {
      const nextSelected = new Set<number>([idx]);
      setState({
        selected: nextSelected,
        answered: true,
        score: scoreAnswer(question, nextSelected),
      });
    }
  };

  const handleCheck = () => {
    if (selected.size === 0) return;
    setState({
      selected,
      answered: true,
      score: scoreAnswer(question, selected),
    });
  };

  const handleNext = () => {
    if (!isLast) setCurrent((c) => c + 1);
  };

  const handleRestart = () => {
    setStates({});
    setCurrent(0);
  };

  const perfectScore = allAnswered && score === questions.length;

  return (
    <section className="quiz-card relative my-6 overflow-hidden rounded-lg border">
      <Confetti active={perfectScore && answered && isLast} />
      <div className="quiz-header flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 text-quiz-accent" />
          <span className="text-sm font-semibold tracking-wide text-foreground">
            {title ?? "Quiz"}
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          Question {current + 1} of {questions.length}
        </span>
      </div>

      <div className="px-5 py-4">
        <p className="quiz-prompt mb-1 font-medium text-foreground">{question.prompt}</p>
        {question.multi && (
          <p className="mb-3 text-xs text-muted-foreground">Select all that apply.</p>
        )}

        <ul className="mt-3 space-y-2">
          {question.options.map((option, idx) => {
            const isSelected = selected.has(idx);
            const showCorrect = answered && option.correct;
            const showWrong = answered && isSelected && !option.correct;
            return (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => handleOptionClick(idx)}
                  disabled={answered}
                  aria-pressed={isSelected}
                  className={cn(
                    "quiz-option flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm transition-colors",
                    !answered && "hover:border-quiz-accent",
                    isSelected && !answered && "quiz-option-selected",
                    showCorrect && "quiz-option-correct",
                    showWrong && "quiz-option-wrong",
                    answered && isSelected && "quiz-option-chosen",
                  )}
                >
                  <span
                    className={cn(
                      "quiz-marker flex h-5 w-5 shrink-0 items-center justify-center border text-xs",
                      question.multi ? "rounded-[4px]" : "rounded-full",
                      answered && isSelected && "quiz-marker-filled",
                    )}
                  >
                    {showCorrect && <Check className="h-3.5 w-3.5" />}
                    {showWrong && <X className="h-3.5 w-3.5" />}
                    {!answered && isSelected && (
                      <span className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </span>
                  <span className="flex-1 text-foreground">{option.text}</span>
                  {answered && isSelected && (
                    <span className="quiz-chosen-badge shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                      Your answer
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {answered && (
          <div className="mt-4">
            <p
              className={cn(
                "text-sm font-semibold",
                state.score === 1
                  ? "text-quiz-correct"
                  : state.score > 0
                    ? "text-quiz-accent"
                    : "text-quiz-wrong",
              )}
            >
              {state.score === 1
                ? "Correct!"
                : state.score > 0
                  ? `Partially correct — ${Math.round(state.score * 100)}% credit.`
                  : "Not quite."}
            </p>
            {question.explanation && (
              <p className="mt-1 text-sm leading-snug text-foreground/80">{question.explanation}</p>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {allAnswered && (
              <span className="font-medium text-foreground">
                Score: {formatScore(score)} / {questions.length} correct
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {question.multi && !answered && (
              <button
                type="button"
                onClick={handleCheck}
                disabled={selected.size === 0}
                className="quiz-btn rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check answer
              </button>
            )}
            {answered && !isLast && (
              <button
                type="button"
                onClick={handleNext}
                className="quiz-btn rounded-md px-4 py-2 text-sm font-medium"
              >
                Next question
              </button>
            )}
            {answered && isLast && (
              <button
                type="button"
                onClick={handleRestart}
                className="quiz-btn-secondary inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart quiz
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
