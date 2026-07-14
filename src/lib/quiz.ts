export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  prompt: string;
  options: QuizOption[];
  explanation?: string;
  /** True when the question has more than one correct option ("select all"). */
  multi: boolean;
}

export interface Quiz {
  title?: string;
  questions: QuizQuestion[];
}

const OPTION_RE = /^[-*]\s*\[( |x|X)\]\s*(.*)$/;
const QUESTION_RE = /^Q:\s*(.*)$/;
const EXPLANATION_RE = /^>\s?(.*)$/;
const TITLE_RE = /^title:\s*(.*)$/i;

/**
 * Parse the text inside a ```quiz fenced block into a structured quiz.
 *
 * Syntax:
 *   title: Optional heading
 *
 *   Q: Question prompt?
 *   - [ ] wrong option
 *   - [x] correct option
 *   > optional explanation shown after answering
 *   ---
 *   Q: Next question ...
 */
/**
 * Score a single answer as a fraction between 0 and 1.
 *
 * Single-choice questions are all-or-nothing. Multiple-choice questions use
 * partial credit: each correct option selected adds credit, while each wrong
 * option selected subtracts credit, so blindly selecting everything cannot
 * earn full marks. The result is clamped to [0, 1].
 */
export function scoreAnswer(question: QuizQuestion, selected: Set<number>): number {
  const totalCorrect = question.options.filter((o) => o.correct).length;
  if (totalCorrect === 0) return 0;

  if (!question.multi) {
    const idx = [...selected][0];
    return idx !== undefined && question.options[idx]?.correct ? 1 : 0;
  }

  let correctSelected = 0;
  let wrongSelected = 0;
  for (const idx of selected) {
    if (question.options[idx]?.correct) correctSelected += 1;
    else wrongSelected += 1;
  }

  const raw = (correctSelected - wrongSelected) / totalCorrect;
  return Math.max(0, Math.min(1, raw));
}

export function parseQuiz(source: string): Quiz {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  let title: string | undefined;
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let seenContent = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // A `title:` directive is only honoured before any question content.
    if (!seenContent) {
      const titleMatch = line.match(TITLE_RE);
      if (titleMatch) {
        title = titleMatch[1].trim() || undefined;
        continue;
      }
      if (line.trim() === "") continue;
    }

    if (/^---+\s*$/.test(line)) {
      chunks.push(currentChunk);
      currentChunk = [];
      continue;
    }

    seenContent = true;
    currentChunk.push(line);
  }
  chunks.push(currentChunk);

  const questions: QuizQuestion[] = [];

  for (const chunk of chunks) {
    let prompt = "";
    const options: QuizOption[] = [];
    const explanationLines: string[] = [];

    for (const line of chunk) {
      const q = line.match(QUESTION_RE);
      if (q) {
        prompt = prompt ? `${prompt} ${q[1].trim()}` : q[1].trim();
        continue;
      }
      const opt = line.match(OPTION_RE);
      if (opt) {
        options.push({
          text: opt[2].trim(),
          correct: opt[1].toLowerCase() === "x",
        });
        continue;
      }
      const exp = line.match(EXPLANATION_RE);
      if (exp) {
        explanationLines.push(exp[1].trim());
        continue;
      }
    }

    if (!prompt || options.length === 0) continue;

    const correctCount = options.filter((o) => o.correct).length;
    questions.push({
      prompt,
      options,
      explanation: explanationLines.length ? explanationLines.join(" ").trim() : undefined,
      multi: correctCount > 1,
    });
  }

  return { title, questions };
}
