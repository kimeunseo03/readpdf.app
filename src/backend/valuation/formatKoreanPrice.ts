export function formatKoreanPrice(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  const won = Math.round(value);

  const eok = Math.floor(won / 100000000);
  const remain = won % 100000000;

  const man = Math.floor(remain / 10000);

  const formattedWon =
    `${won.toLocaleString()}원`;

  let koreanText = "";

  if (eok <= 0) {
    koreanText =
      `(${man.toLocaleString()}만원)`;
  } else if (man === 0) {
    koreanText =
      `(${eok.toLocaleString()}억원)`;
  } else {
    koreanText =
      `(${eok.toLocaleString()}억 ${man.toLocaleString()}만원)`;
  }

  return `${formattedWon}\n${koreanText}`;
}
