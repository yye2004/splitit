export type SplitItem = {
  name: string;
  cents: number;
  assignees: string[];
};

export type SplitInput = {
  people: string[];
  items: SplitItem[];
  includeServiceCharge: boolean;
  roundTotals: boolean;
  serviceRatePercent: number;
  taxCents: number;
  receiptTotalCents: number;
};

export type SplitPersonItem = {
  name: string;
  cents: number;
};

export type SplitPerson = {
  name: string;
  itemSubtotalCents: number;
  chargeShareCents: number;
  totalCents: number;
  items: SplitPersonItem[];
};

export type SplitResult = {
  subtotalCents: number;
  serviceRatePercent: number;
  serviceCents: number;
  taxCents: number;
  computedTotalCents: number;
  receiptTotalCents: number;
  mismatchCents: number;
  people: SplitPerson[];
};

export function calculateSplit(input: SplitInput): SplitResult {
  const people = dedupe(input.people.map((person) => person.trim()).filter(Boolean));
  const emptyRows: [string, SplitPerson][] = people.map((name) => [
    name,
    {
      name,
      itemSubtotalCents: 0,
      chargeShareCents: 0,
      totalCents: 0,
      items: [],
    },
  ]);
  const personRows = new Map(emptyRows);

  const items = input.items
    .map((item) => ({
      ...item,
      cents: cleanCents(item.cents),
      assignees: dedupe(item.assignees.filter((name) => personRows.has(name))),
    }))
    .filter((item) => item.cents > 0 && item.assignees.length > 0);

  const subtotalCents = items.reduce((total, item) => total + item.cents, 0);

  for (const item of items) {
    const shares = allocateCents(
      item.cents,
      item.assignees.map(() => 1),
    );

    item.assignees.forEach((name, index) => {
      const person = personRows.get(name);
      if (!person) {
        return;
      }

      const cents = shares[index] ?? 0;
      person.itemSubtotalCents += cents;
      person.items.push({ name: item.name, cents });
    });
  }

  const serviceRatePercent = clampNumber(input.serviceRatePercent, 0, 100);
  const serviceCents = input.includeServiceCharge
    ? cleanCents((subtotalCents * serviceRatePercent) / 100)
    : 0;
  const taxCents = cleanCents(input.taxCents);
  const chargeCents = serviceCents + taxCents;
  const peopleList = people.map((name) => personRows.get(name)).filter(isSplitPerson);
  const chargeShares = allocateCents(
    chargeCents,
    peopleList.map((person) => person.itemSubtotalCents),
  );

  peopleList.forEach((person, index) => {
    person.chargeShareCents = chargeShares[index] ?? 0;
    const rawTotal = person.itemSubtotalCents + person.chargeShareCents;
    person.totalCents = input.roundTotals ? roundToNearestTenCents(rawTotal) : rawTotal;
  });

  const computedTotalCents = subtotalCents + serviceCents + taxCents;

  return {
    subtotalCents,
    serviceRatePercent,
    serviceCents,
    taxCents,
    computedTotalCents,
    receiptTotalCents: cleanCents(input.receiptTotalCents),
    mismatchCents: computedTotalCents - cleanCents(input.receiptTotalCents),
    people: peopleList,
  };
}

function allocateCents(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const total = cleanCents(totalCents);
  const weightTotal = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  const safeWeights = weightTotal > 0 ? weights : weights.map(() => 1);
  const safeWeightTotal = safeWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  const rawShares = safeWeights.map((weight) => (total * Math.max(0, weight)) / safeWeightTotal);
  const shares = rawShares.map((share) => Math.floor(share));
  let remainder = total - shares.reduce((sum, share) => sum + share, 0);

  rawShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remainder <= 0) {
        return;
      }

      shares[index] += 1;
      remainder -= 1;
    });

  return shares;
}

function cleanCents(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function roundToNearestTenCents(value: number): number {
  return Math.round(cleanCents(value) / 10) * 10;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isSplitPerson(value: SplitPerson | undefined): value is SplitPerson {
  return Boolean(value);
}
