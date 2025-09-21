export const hasAdminAccess = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    return ["true", "t", "1", "yes"].includes(normalised);
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
};
