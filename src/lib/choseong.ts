const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ"
];

export function getInitialConsonants(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 0xac00 || code > 0xd7a3) return char;
      return CHOSEONG[Math.floor((code - 0xac00) / 588)];
    })
    .join("")
    .replace(/\s/g, "")
    .toLowerCase();
}

export function normalizeSearch(text: string): string {
  return text.trim().replace(/\s/g, "").toLowerCase();
}
