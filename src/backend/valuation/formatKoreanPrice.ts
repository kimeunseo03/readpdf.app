export function formatKoreanPrice(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }

  const eok = Math.floor(value / 10000);
  const man = value % 10000;

  const formattedNumber = `${value.toLocaleString()}만원`;

  if (eok <= 0) {
    return `${formattedNumber} (${man.toLocaleString()}만원)`;
  }

  if (man === 0) {
    return `${formattedNumber} (${eok}억원)`;
  }

  return `${formattedNumber} (${eok}억 ${man.toLocaleString()}만원)`;
}
