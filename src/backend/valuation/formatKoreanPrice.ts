export function formatKoreanPrice(value?: number) {
  if (value === undefined || value === null) return "-";

  const won = Math.round(value);
  const eok = Math.floor(won / 100000000);
  const remain = won % 100000000;
  const man = Math.floor(remain / 10000);

  const formattedWon = `${won.toLocaleString()}원`;

  let koreanText = "";

  if (eok === 0) {
    if (man >= 1000) {
      koreanText = `(${Math.floor(man / 1000)}천만원)`;
    } else {
      koreanText = `(${man.toLocaleString()}만원)`;
    }
  } else {
    koreanText =
      man > 0
        ? `(${eok.toLocaleString()}억 ${man.toLocaleString()}만원)`
        : `(${eok.toLocaleString()}억원)`;
  }

  return `${formattedWon}\n${koreanText}`;
}

export function formatKoreanPriceInline(value?: number) {
  return formatKoreanPrice(value).replace("\n", " ");
}
