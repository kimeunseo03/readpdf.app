export function maskSensitiveText(input: string): string {
  return input
    .replace(/\d{6}\s*-\s*\d{7}/g, "******-*******")
    .replace(/([가-힣]{1})([가-힣])([가-힣]?)(?=\s*(?:소유자|권리자|채무자|근저당권자)?)/g, (_m, a, _b, c) => {
      if (!c) return `${a}*`;
      return `${a}*${c}`;
    });
}
