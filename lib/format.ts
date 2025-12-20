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

  const formatScaled = (value: number, suffix: string, decimals: number) => {
    // trim trailing zeros (e.g. 2.50 -> 2.5, 2.00 -> 2)
    const s = value
      .toFixed(decimals)
      .replace(/\.0+$/, "")
      .replace(/(\.\d*[1-9])0+$/, "$1");
    return `${sign}Rs ${s}${suffix}`;
  };

  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    return formatScaled(v, "B", v < 10 ? 2 : 1);
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    // Show 2dp under 10M so "1.47M" doesn't round to "1.5M"
    return formatScaled(v, "M", v < 10 ? 2 : 1);
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    // Keep large K values clean ("225K"), but show some precision for smaller values ("9.5K")
    return formatScaled(v, "K", v < 100 ? 1 : 0);
  }
  return `${sign}Rs ${formatNumber(abs)}`;
}


