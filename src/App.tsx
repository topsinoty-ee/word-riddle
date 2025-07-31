import {useState, useEffect, type FormEvent} from "react";
import "./App.css";
import "@total-typescript/ts-reset";
import { Card } from "./components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { exportImage } from "./lib/exportImage";
import { Progress } from "./components/ui/progress";
import { toast } from "sonner";
import cookies from "js-cookie";
import useSWR from "swr";
import { Loader2 } from "lucide-react";

class MissingEnvironmentalVariableError extends Error {
  constructor(missing: string | string[]) {
    const variables = Array.isArray(missing) ? missing : [missing];
    const message = `Missing environmental variable${
      variables.length > 1 ? "s" : ""
    }: ${variables.join(", ")}`;
    super(message);
    this.name = "MissingEnvironmentalVariableError";
  }
}

const wordFetcher = async (url: string): Promise<Set<string>> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  }

  try {
    const response = res.clone();
    const jsonData = (await response.json()) as string[];
    if (Array.isArray(jsonData)) {
      return new Set(
        jsonData.map((word) => word.trim().toUpperCase()).filter(Boolean)
      );
    }
  } catch {
    const response = res.clone();
    const textData = await response.text();
    return new Set(
      textData
        .split("\n")
        .map((word) => word.trim().toUpperCase())
        .filter(Boolean)
    );
  }

  throw new Error("Unsupported data format");
};

const usePossibleWords = () => {
  const questionPoolUrl = import.meta.env.VITE_QUESTION_POOL_SOURCE;
  const answerPoolUrl = import.meta.env.VITE_ANSWER_POOL_SOURCE;

  if (!questionPoolUrl || !answerPoolUrl) {
    throw new MissingEnvironmentalVariableError([
      ...(!questionPoolUrl ? ["VITE_QUESTION_POOL_SOURCE"] : []),
      ...(!answerPoolUrl ? ["VITE_ANSWER_POOL_SOURCE"] : []),
    ]);
  }

  const {
    data: questionWords,
    error: questionError,
    isLoading: isLoadingQuestions,
  } = useSWR(questionPoolUrl, wordFetcher, {
    onError: (err) =>
      toast.error(`Failed to load question words: ${err.message}`),
    revalidateOnFocus: false,
  });

  const {
    data: answerWords,
    error: answerError,
    isLoading: isLoadingAnswers,
  } = useSWR(answerPoolUrl, wordFetcher, {
    onError: (err) =>
      toast.error(`Failed to load answer words: ${err.message}`),
    revalidateOnFocus: false,
  });

  const allValidWords = new Set<string>();
  if (questionWords) {
    questionWords.forEach((word) => allValidWords.add(word));
  }
  console.error(answerError);
  if (answerWords) {
    answerWords.forEach((word) => allValidWords.add(word));
  }

  return {
    questionWords,
    answerWords,
    allValidWords,
    error: questionError || answerError,
    isLoading: isLoadingQuestions || isLoadingAnswers,
    selectRandomWord: () => {
      if (!questionWords || questionWords.size === 0) return null;
      const wordsArray = Array.from(questionWords);
      return wordsArray[Math.floor(Math.random() * wordsArray.length)];
    },
  };
};

function App() {
  const [guesses, setGuesses] = useState<(string | null)[]>(
    Array(6).fill(null)
  );
  const [solutions, setSolutions] = useState<
    Record<number, Record<number, boolean>>[]
  >([]);
  const [win, setWin] = useState<boolean | null>(null);
  const [winLoseRatio, setWinLoseRatio] = useState<[number, number]>([0, 0]);
  const [targetWord, setTargetWord] = useState<string | null>(null);
  const { questionWords, allValidWords, selectRandomWord, isLoading, error } =
    usePossibleWords();

  useEffect(() => {
    if (
      !isLoading &&
      !error &&
      questionWords &&
      questionWords.size > 0 &&
      !targetWord
    ) {
      const word = selectRandomWord();
      if (word) {
        setTargetWord(word);
      }
    }
  }, [questionWords, selectRandomWord, targetWord, isLoading, error]);

  useEffect(() => {
    const savedRatio = cookies.get("winLoseRatio");
    if (savedRatio) {
      try {
        const parsed = JSON.parse(savedRatio);
        setWinLoseRatio(parsed as [number, number]);
      } catch (e) {
        alert("Failed to parse win/lose into cookie");
        toast.error(`${e}`);
      }
    }
  }, []);

  const word = targetWord?.trim().toUpperCase();

  function checkGuess(guess: string): Record<number, Record<number, boolean>> {
    if (!word) return {};
    const guessArr = [...guess];
    const wordArr = [...word];
    const checks: Record<number, boolean> = {};

    const remainingLetters: string[] = [];

    for (let i = 0; i < word.length; i++) {
      if (guessArr[i] === wordArr[i]) {
        checks[i] = true;
      } else {
        remainingLetters.push(wordArr[i]);
      }
    }

    for (let i = 0; i < word.length; i++) {
      if (checks[i] !== undefined) continue;

      const letter = guessArr[i];
      const indexInRemaining = remainingLetters.indexOf(letter);

      if (indexInRemaining !== -1) {
        checks[i] = false;
        remainingLetters.splice(indexInRemaining, 1);
      }
    }

    const index = guesses.filter(Boolean).length;
    return { [index]: checks };
  }

  function handleReset() {
    setGuesses(Array(6).fill(null));
    setSolutions([]);
    setWin(null);
    setTargetWord(selectRandomWord());
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawGuess = formData.get("guess");

    if (typeof rawGuess !== "string") return;
    const guess = rawGuess.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(guess)) return;
    if (!allValidWords.has(guess)) {
      toast.error("Word not in dictionary");
      return;
    }
    if (guesses.includes(guess)) {
      e.currentTarget.reset();
      return;
    }

    const nextEmptySlot = guesses.findIndex((g) => g === null);
    if (nextEmptySlot === -1) {
      setWin(false);
      return;
    }

    const updatedGuesses = [...guesses];
    updatedGuesses[nextEmptySlot] = guess;
    setGuesses(updatedGuesses);

    const solution = checkGuess(guess);
    setSolutions([...solutions, solution]);

    const isWin =
      Object.values(solution[nextEmptySlot]).every((val) => val) &&
      guess.toUpperCase() === targetWord?.toUpperCase();

    if (isWin) {
      const newRatio: [number, number] = [winLoseRatio[0] + 1, winLoseRatio[1]];
      setWin(true);
      setWinLoseRatio(newRatio);
      cookies.set("winLoseRatio", JSON.stringify(newRatio));
    } else if (nextEmptySlot === 5) {
      const newRatio: [number, number] = [winLoseRatio[0], winLoseRatio[1] + 1];
      setWin(false);
      setWinLoseRatio(newRatio);
      cookies.set("winLoseRatio", JSON.stringify(newRatio));
    }

    e.currentTarget.reset();
  }

  const totalGames = winLoseRatio[0] + winLoseRatio[1];
  const winPercentage =
    totalGames > 0 ? (winLoseRatio[0] / totalGames) * 100 : 0;

  return (
    <main className="dark w-full min-h-screen bg-background text-foreground flex flex-col gap-8 items-center justify-start py-12 px-4">
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-primary">Word Riddle</h1>
        <p className="text-emerald-500">Guess the 5-letter word</p>
      </div>

      <section className="flex gap-6">
        <Card
          className="w-full max-w-max max-h-max bg-card border-border p-6 rounded-xl shadow-lg"
          id="wordle"
        >
          <div className="flex flex-col gap-3">
            {guesses.map((guess, i) => {
              const lineSolution = solutions[i]?.[i];

              return (
                <div key={i} className="flex gap-2 justify-center">
                  {[...Array(5)].map((_, j) => {
                    const isCorrect = lineSolution?.[j];
                    let bgColor = "bg-card";
                    let borderColor = "border-border";

                    if (guess) {
                      if (isCorrect === true) {
                        bgColor = "bg-emerald-500";
                        borderColor = "border-emerald-500";
                      } else if (isCorrect === false) {
                        bgColor = "bg-amber-400";
                        borderColor = "border-amber-400";
                      } else {
                        bgColor = "bg-muted";
                        borderColor = "border-muted-foreground";
                      }
                    }

                    return (
                      <div
                        key={j}
                        className={`size-12 flex items-center justify-center text-2xl font-bold uppercase 
                        ${bgColor} ${borderColor} border-2 rounded-md text-card-foreground`}
                      >
                        {guess?.[j] ?? ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="hidden not-md:flex flex-col">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    id="guess"
                    name="guess"
                    className="bg-background border-border text-foreground focus-visible:ring-primary"
                    minLength={5}
                    maxLength={5}
                    placeholder="Guess"
                    type="text"
                    pattern="[A-Za-z]{5}"
                    title="Please enter exactly 5 letters"
                    autoComplete="off"
                    disabled={win !== null}
                  />
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={win !== null}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </form>
            <div className="mt-6">
              <div className="flex justify-between mb-2">
                <span>Win Rate: {Math.round(winPercentage)}%</span>
                <span>
                  {winLoseRatio[0]}W / {winLoseRatio[1]}L
                </span>
              </div>
              <Progress value={winPercentage} />
            </div>

            {win !== null && (
              <div className="mt-6 p-4 rounded-md text-center">
                <p
                  className={`text-xl font-bold ${
                    win ? "text-emerald-500" : "text-destructive"
                  }`}
                >
                  {win ? "You won! 🎉" : "You lost! 😢"}
                </p>
                <p className="text-foreground mt-2">
                  The word was:{" "}
                  <span className="font-bold">{targetWord?.toUpperCase()}</span>
                </p>
                <Button
                  onClick={handleReset}
                  className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Play Again
                </Button>
              </div>
            )}
          </div>
        </Card>
        <Card className="not-md:hidden w-full max-w-max bg-card border-border p-6 rounded-xl shadow-lg relative">
          {isLoading && (
            <div className="absolute w-full h-full rounded-xl bg-muted/80 top-0 left-0 flex items-center justify-center">
              <Loader2 className="animate-spin" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="guess" className="text-primary">
                Your guess
              </Label>
              <div className="flex gap-2">
                <Input
                  id="guess"
                  name="guess"
                  className="bg-background border-border text-foreground focus-visible:ring-primary"
                  minLength={5}
                  maxLength={5}
                  type="text"
                  pattern="[A-Za-z]{5}"
                  title="Please enter exactly 5 letters"
                  autoComplete="off"
                  disabled={win !== null}
                />
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={win !== null}
                >
                  Submit
                </Button>
              </div>
            </div>
          </form>
          <Button
            onClick={() =>
              exportImage(guesses, solutions, targetWord ?? "", win, {
                title: "My Wordle Result",
                alt: "Wordle game result",
              })
            }
          >
            Share
          </Button>
          {win !== null && (
            <div className="mt-6 p-4 rounded-md text-center">
              <p
                className={`text-xl font-bold ${
                  win ? "text-emerald-500" : "text-destructive"
                }`}
              >
                {win ? "You won! 🎉" : "You lost! 😢"}
              </p>
              <p className="text-foreground mt-2">
                The word was:{" "}
                <span className="font-bold">{targetWord?.toUpperCase()}</span>
              </p>
              <Button
                onClick={handleReset}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Play Again
              </Button>
            </div>
          )}
          <div className="mt-6">
            <div className="flex justify-between mb-2">
              <span>Win Rate: {Math.round(winPercentage)}%</span>
              <span>
                {winLoseRatio[0]}W / {winLoseRatio[1]}L
              </span>
            </div>
            <Progress value={winPercentage} />
          </div>
        </Card>
      </section>
    </main>
  );
}

export default App;
