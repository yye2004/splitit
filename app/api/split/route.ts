import { calculateSplit, type SplitInput, type SplitItem } from "@/app/lib/split";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const payload = isRecord(body) ? body : {};

  const input: SplitInput = {
    people: readStringArray(payload.people),
    items: readItems(payload.items),
    includeServiceCharge: readBoolean(payload.includeServiceCharge),
    roundTotals: readBoolean(payload.roundTotals),
    serviceRatePercent: readNumber(payload.serviceRatePercent),
    taxCents: readNumber(payload.taxCents),
    receiptTotalCents: readNumber(payload.receiptTotalCents),
  };

  return Response.json(calculateSplit(input));
}

function readItems(value: unknown): SplitItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "item",
      cents: readNumber(item.cents),
      assignees: readStringArray(item.assignees),
    }));
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
