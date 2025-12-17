export function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(n);
}

// Deterministic compact formatting to avoid Node vs browser Intl differences (hydration mismatch)
export function formatPKRCompact(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  const formatScaled = (value: number, suffix: string) => {
    const s = value.toFixed(1).replace(/\.0$/, "");
    return `${sign}Rs ${s}${suffix}`;
  };

  if (abs >= 1_000_000_000) return formatScaled(abs / 1_000_000_000, "B");
  if (abs >= 1_000_000) return formatScaled(abs / 1_000_000, "M");
  if (abs >= 1_000) return formatScaled(abs / 1_000, "K");
  return `${sign}Rs ${formatNumber(abs)}`;
}


