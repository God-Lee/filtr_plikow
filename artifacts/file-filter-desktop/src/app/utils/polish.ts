export function formatPolishCount(
  count: number,
  singular: string,
  paucal: string,
  plural: string,
) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (count === 1) {
    return `${count} ${singular}`;
  }

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} ${paucal}`;
  }

  return `${count} ${plural}`;
}

export function getFilteredFileCountLabel(count: number) {
  return formatPolishCount(count, "plik po filtrach", "pliki po filtrach", "plików po filtrach");
}

export function getGenericFileCountLabel(count: number) {
  return formatPolishCount(count, "plik", "pliki", "plików");
}
