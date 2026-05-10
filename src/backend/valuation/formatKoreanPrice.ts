export function formatKoreanPrice(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }

  // value는 "만원" 단위
  const won = value * 10000;

  const eok = Math.floor(value / 10000);
  const man = value % 10000;

  const formattedWon =
    `${won.toLocaleString()}원`;

  if (eok <= 0) {
    return `${formattedWon} (${man.toLocaleString()}만원)`;
  }

  if (man === 0) {
    return `${formattedWon} (${eok}억원)`;
  }

  return `${formattedWon} (${eok}억 ${man.toLocaleString()}만원)`;
}
