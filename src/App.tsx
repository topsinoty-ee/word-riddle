import { useState } from "react";
import "./App.css";
import "@total-typescript/ts-reset";
import { Card } from "./components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { exportImage } from "./lib/exportImage";

const WORD = "world";

function App() {
  const [guesses, setGuesses] = useState<(string | null)[]>(
    Array(6).fill(null)
  );
  const [solutions, setSolutions] = useState<
    Record<number, Record<number, boolean>>[]
  >([]);
  const [win, setWin] = useState<boolean | null>(null);

  const word = WORD.trim().toUpperCase();

  function checkGuess(guess: string): Record<number, Record<number, boolean>> {
    const guessArr = [...guess];
    const wordArr = [...word];
    const checks: Record<number, boolean> = {};

    for (let i = 0; i < word.length; i++) {
      if (guessArr[i] === wordArr[i]) {
        checks[i] = true;
      } else if (wordArr.includes(guessArr[i])) {
        checks[i] = false;
      }
    }

    const index = guesses.filter(Boolean).length;
    return { [index]: checks };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawGuess = formData.get("guess");

    if (typeof rawGuess !== "string") return;
    const guess = rawGuess.trim().toUpperCase();

    if (!/^[A-Z]{5}$/.test(guess)) return;
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
      Object.values(solution[nextEmptySlot]).every((val) => val === true) &&
      guess.toUpperCase() === word.toUpperCase();
    if (isWin) {
      setWin(true);
    } else if (nextEmptySlot === 5) {
      setWin(false);
    }

    e.currentTarget.reset();
  }

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
                  <span className="font-bold">{WORD.toUpperCase()}</span>
                </p>
              </div>
            )}
          </div>
        </Card>
        <Card className="not-md:hidden w-full max-w-max bg-card border-border p-6 rounded-xl shadow-lg">
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
              exportImage(guesses, solutions, WORD, win, {
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
                <span className="font-bold">{WORD.toUpperCase()}</span>
              </p>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}

export default App;
