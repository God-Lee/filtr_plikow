export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl");
}

export function tokenizeText(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

export function matchesSearchToken(queryToken: string, searchableToken: string) {
  if (searchableToken.includes(queryToken)) {
    return true;
  }

  if (
    queryToken.length >= 4 &&
    searchableToken.length >= 4 &&
    queryToken.startsWith(searchableToken) &&
    queryToken.length - searchableToken.length <= 2
  ) {
    return true;
  }

  if (searchableToken.length >= 4 && searchableToken.startsWith(queryToken)) {
    return true;
  }

  return false;
}
