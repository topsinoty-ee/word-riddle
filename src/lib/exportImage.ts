import { createCanvas } from "canvas";

export function generateWordleImage(
  guesses: (string | null)[],
  solutions: Record<number, Record<number, boolean>>[],
  word: string,
  win: boolean | null
): string {
  const cellSize = 48;
  const cellPadding = 8;
  const gridWidth = 5 * cellSize + 4 * cellPadding;
  const gridHeight = 6 * cellSize + 5 * cellPadding;
  const padding = 24;

  const canvas = createCanvas(
    gridWidth + 2 * padding,
    gridHeight + 2 * padding + (win !== null ? 160 : 80)
  );
  const ctx = canvas.getContext("2d");

  // Background
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
  ctx.fillStyle = "#18181b";
  ctx.fill();

  // Title
  ctx.fillStyle = "#c084fc";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Word Riddle", canvas.width / 2, padding + 20);

  // Subtitle
  ctx.fillStyle = "#f8fafc";
  ctx.font = "16px Arial";
  ctx.fillText("Guess the 5-letter word", canvas.width / 2, padding + 40);

  // Draw grid
  guesses.forEach((guess, row) => {
    // Find solution for current row
    const solutionForRow = solutions.find((s) => row in s);
    const lineSolution = solutionForRow ? solutionForRow[row] : undefined;

    for (let col = 0; col < 5; col++) {
      const x = padding + col * (cellSize + cellPadding);
      const y = padding + 60 + row * (cellSize + cellPadding);

      const isCorrect = lineSolution?.[col];
      let bgColor = "#27272a"; // card
      let borderColor = "#3f3f46"; // border

      if (guess) {
        if (isCorrect === true) {
          bgColor = "#059669"; // green
          borderColor = "#059669";
        } else if (isCorrect === false) {
          bgColor = "#eab308"; // yellow
          borderColor = "#eab308";
        } else {
          bgColor = "#3f3f46"; // muted
          borderColor = "#a1a1aa";
        }
      }

      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 8);
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Draw rounded rectangle border
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 8);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw letter if exists
      if (guess?.[col]) {
        ctx.fillStyle = "#f8fafc"; // foreground
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          guess[col].toUpperCase(),
          x + cellSize / 2,
          y + cellSize / 2
        );
      }
    }
  });

  if (win !== null) {
    const resultY = padding + gridHeight + 108;
    ctx.fillStyle = win ? "#059669" : "#ef4444";
    ctx.font = "bold 20px Arial";
    ctx.fillText(
      win ? "You won! 🎉" : "You lost! 😢",
      canvas.width / 2,
      resultY
    );

    ctx.fillStyle = "#f8fafc";
    ctx.font = "16px Arial";
    ctx.fillText(
      `The word was: ${word.toUpperCase()}`,
      canvas.width / 2,
      resultY + 30
    );
  }

  return canvas.toDataURL("image/png");
}

export function exportImage(
  guesses: (string | null)[],
  solutions: Record<number, Record<number, boolean>>[],
  word: string,
  win: boolean | null,
  {
    fileName = "wordle.png",
    title,
    alt,
  }: {
    fileName?: `${string}.png`;
    title: string;
    alt: string;
  }
) {
  const dataUrl = generateWordleImage(guesses, solutions, word, win);

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;

  if (navigator.share) {
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], fileName, { type: "image/png" });
        navigator
          .share({
            files: [file],
            title,
            text: alt,
          })
          .catch(console.error);
      });
  } else {
    link.click();
  }
}
