export function columnIndexToLetter(index: number): string {
  let current = index;
  let letters = "";

  while (current >= 0) {
    letters = String.fromCharCode((current % 26) + 65) + letters;
    current = Math.floor(current / 26) - 1;
  }

  return letters;
}
