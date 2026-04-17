import rawPromptMd from "../../prompts/enrich-notes.md?raw";

export const STOCKS_PLACEHOLDER = "PASTE_STOCKS_JSON_HERE";

function extractPrompt(md: string): string {
  const lines = md.split("\n");
  const fences: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "````") fences.push(i);
  }
  if (fences.length < 2) return md.trim();
  return lines.slice(fences[0] + 1, fences[1]).join("\n").trim();
}

export const ENRICH_NOTES_PROMPT = extractPrompt(rawPromptMd);

export function buildFullPrompt(stocksJson: string): string {
  if (ENRICH_NOTES_PROMPT.includes(STOCKS_PLACEHOLDER)) {
    return ENRICH_NOTES_PROMPT.replace(STOCKS_PLACEHOLDER, stocksJson);
  }
  return `${ENRICH_NOTES_PROMPT}\n\n${stocksJson}`;
}
