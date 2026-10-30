export function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value) {
  return /^[a-z0-9_]{3,30}$/.test(value);
}
