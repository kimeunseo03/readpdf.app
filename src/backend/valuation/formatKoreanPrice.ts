export function formatKoreanPrice(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }

  // value는 만원 단위
  const won = value * 10000;

  const eok = Math.floor(value / 10000);
  const man = value % 10000;

  const formattedWon =
    `${won.toLocaleString()}원`;

  let koreanText = "";

  if (eok <= 0) {
    koreanText =
      `(${man.toLocaleString()}만원)`;
  } else if (man === 0) {
    koreanText =
      `(${eok}억원)`;
  } else {
    koreanText =
      `(${eok}억 ${man.toLocaleString()}만원)`;
  }

  return `${formattedWon}\n${koreanText}`;
}
