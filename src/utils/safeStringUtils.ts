export const safeToLowerCase = (value: string | undefined | null): string => {
  if (!value) return '';
  return String(value).toLowerCase();
};

export const safeTrim = (value: string | undefined | null): string => {
  if (!value) return '';
  return String(value).trim();
};

export const safeIncludes = (
  str: string | undefined | null,
  search: string
): boolean => {
  if (!str) return false;
  return String(str).toLowerCase().includes(search.toLowerCase());
};
