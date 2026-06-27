"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { SplitPerson, SplitResult } from "./lib/split";

const symbolViewBoxes = {
  clipboard: "0 0 300 420",
  "clipboard-sm": "0 0 300 280",
  "btn-primary": "0 0 220 44",
  "btn-outline": "0 0 220 44",
  "btn-wide": "0 0 280 48",
  "input-box": "0 0 220 36",
  "input-box-sm": "0 0 100 32",
  "input-underline": "0 0 180 16",
  "item-card": "0 0 270 52",
  "item-card-selected": "0 0 270 52",
  chip: "0 0 56 24",
  "chip-checked": "0 0 56 24",
  "checkbox-empty": "0 0 16 16",
  "checkbox-checked": "0 0 16 16",
  "divider-solid": "0 0 270 12",
  "divider-dashed": "0 0 270 12",
  "warning-squiggle": "0 0 120 16",
  "checkmark-done": "0 0 16 14",
  "dot-unpaid": "0 0 8 8",
  clip: "0 0 52 18",
} as const;

type SymbolId = keyof typeof symbolViewBoxes;
type ScreenId =
  | "home"
  | "setup"
  | "items"
  | "assign"
  | "charges"
  | "results"
  | "detail"
  | "quick";
type SplitStatus = "loading" | "ready" | "error";

type BillItem = {
  id: string;
  name: string;
  price: string;
  assignees: string[];
};

const initialPeople = ["p1", "p2", "p3"];
const initialItems: BillItem[] = [
  { id: "item-1", name: "", price: "0.00", assignees: ["p1"] },
  { id: "item-2", name: "", price: "0.00", assignees: ["p2"] },
  { id: "item-3", name: "", price: "0.00", assignees: ["p3"] },
];

export default function Home() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [paidBy, setPaidBy] = useState(initialPeople[0]);
  const [people, setPeople] = useState(initialPeople);
  const [items, setItems] = useState(initialItems);
  const [selectedItemId, setSelectedItemId] = useState(initialItems[0].id);
  const [selectedPerson, setSelectedPerson] = useState(initialPeople[0]);
  const [paidPeople, setPaidPeople] = useState<string[]>([]);
  const [serviceRate, setServiceRate] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0.00");
  const [receiptAmount, setReceiptAmount] = useState("0.00");
  const [includeServiceCharge, setIncludeServiceCharge] = useState(true);
  const [roundTotals, setRoundTotals] = useState(false);
  const [split, setSplit] = useState<SplitResult | null>(null);
  const [splitStatus, setSplitStatus] = useState<SplitStatus>("loading");

  const activePeople = useMemo(() => normalizePeople(people), [people]);
  const splitItems = useMemo(
    () =>
      items
        .map((item) => ({
          name: item.name.trim() || "untitled item",
          cents: moneyToCents(item.price),
          assignees: item.assignees.filter((name) => activePeople.includes(name)),
        }))
        .filter((item) => item.cents > 0),
    [activePeople, items],
  );
  const subtotalCents = useMemo(
    () => splitItems.reduce((total, item) => total + item.cents, 0),
    [splitItems],
  );
  const taxCents = moneyToCents(taxAmount);
  const receiptTotalCents = moneyToCents(receiptAmount);
  const serviceRateValue = parseServiceRate(serviceRate);

  const markSplitDirty = useCallback(() => setSplitStatus("loading"), []);
  const go = useCallback((next: ScreenId) => () => setScreen(next), []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/split", {
      body: JSON.stringify({
        people: activePeople,
        items: splitItems,
        includeServiceCharge,
        receiptTotalCents,
        roundTotals,
        serviceRatePercent: serviceRateValue,
        taxCents,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("split calculation failed");
        }

        return response.json() as Promise<SplitResult>;
      })
      .then((result) => {
        setSplit(result);
        setSplitStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSplitStatus("error");
      });

    return () => controller.abort();
  }, [
    activePeople,
    includeServiceCharge,
    receiptTotalCents,
    roundTotals,
    serviceRateValue,
    splitItems,
    taxCents,
  ]);

  const updatePerson = useCallback(
    (index: number, value: string) => {
      const previousName = people[index];

      markSplitDirty();
      setPeople((current) =>
        current.map((person, personIndex) => (personIndex === index ? value : person)),
      );
      setItems((current) =>
        current.map((item) => ({
          ...item,
          assignees: item.assignees.map((assignee) =>
            assignee === previousName ? value : assignee,
          ),
        })),
      );
      setPaidPeople((current) =>
        current.map((person) => (person === previousName ? value : person)),
      );

      if (paidBy === previousName) {
        setPaidBy(value);
      }

      if (selectedPerson === previousName) {
        setSelectedPerson(value);
      }
    },
    [markSplitDirty, paidBy, people, selectedPerson],
  );

  const addPerson = useCallback(() => {
    markSplitDirty();
    setPeople((current) => [...current, `p${current.length + 1}`]);
  }, [markSplitDirty]);

  const addItem = useCallback(() => {
    markSplitDirty();
    setItems((current) => {
      const nextItem = {
        assignees: activePeople.slice(0, 1),
        id: `item-${Date.now()}`,
        name: "",
        price: "0.00",
      };

      setSelectedItemId(nextItem.id);
      return [...current, nextItem];
    });
  }, [activePeople, markSplitDirty]);

  const updateItemName = useCallback(
    (id: string, name: string) => {
      markSplitDirty();
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, name } : item)),
      );
    },
    [markSplitDirty],
  );

  const updateItemPrice = useCallback(
    (id: string, price: string) => {
      markSplitDirty();
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, price } : item)),
      );
    },
    [markSplitDirty],
  );

  const normalizeItemPrice = useCallback(
    (id: string) => {
      markSplitDirty();
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, price: formatMoneyInput(moneyToCents(item.price)) }
            : item,
        ),
      );
    },
    [markSplitDirty],
  );

  const openAssignSheet = useCallback((id: string) => {
    setSelectedItemId(id);
    setScreen("assign");
  }, []);

  const toggleItemAssignee = useCallback(
    (itemId: string, person: string) => {
      markSplitDirty();
      setItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          const hasPerson = item.assignees.includes(person);
          return {
            ...item,
            assignees: hasPerson
              ? item.assignees.filter((assignee) => assignee !== person)
              : [...item.assignees, person],
          };
        }),
      );
    },
    [markSplitDirty],
  );

  const togglePaidPerson = useCallback((person: string) => {
    setPaidPeople((current) =>
      current.includes(person)
        ? current.filter((paidPerson) => paidPerson !== person)
        : [...current, person],
    );
  }, []);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];

  const setReceipt = (value: string) => {
    markSplitDirty();
    setReceiptAmount(value);
  };
  const setTax = (value: string) => {
    markSplitDirty();
    setTaxAmount(value);
  };
  const setService = (value: string) => {
    markSplitDirty();
    setServiceRate(value);
  };
  const setIncludeService = (value: boolean) => {
    markSplitDirty();
    setIncludeServiceCharge(value);
  };
  const setRounding = (value: boolean) => {
    markSplitDirty();
    setRoundTotals(value);
  };

  const currentScreen: Record<ScreenId, ReactNode> = {
    home: (
      <HomeScreen
        go={go}
        peopleCount={activePeople.length}
        place={place}
        totalCents={receiptTotalCents}
      />
    ),
    setup: (
      <SetupScreen
        addPerson={addPerson}
        date={date}
        go={go}
        includeServiceCharge={includeServiceCharge}
        paidBy={paidBy}
        people={people}
        place={place}
        roundTotals={roundTotals}
        setDate={setDate}
        setIncludeServiceCharge={setIncludeService}
        setPaidBy={setPaidBy}
        setPlace={setPlace}
        setRoundTotals={setRounding}
        updatePerson={updatePerson}
      />
    ),
    items: (
      <ItemsScreen
        addItem={addItem}
        go={go}
        items={items}
        normalizeItemPrice={normalizeItemPrice}
        openAssignSheet={openAssignSheet}
        split={split}
        subtotalCents={subtotalCents}
        updateItemName={updateItemName}
        updateItemPrice={updateItemPrice}
      />
    ),
    assign: (
      <AssignScreen
        activePeople={activePeople}
        go={go}
        items={items}
        selectedItem={selectedItem}
        split={split}
        subtotalCents={subtotalCents}
        toggleItemAssignee={toggleItemAssignee}
      />
    ),
    charges: (
      <ChargesScreen
        go={go}
        includeServiceCharge={includeServiceCharge}
        receiptAmount={receiptAmount}
        setIncludeServiceCharge={setIncludeService}
        setReceiptAmount={setReceipt}
        setServiceRate={setService}
        serviceRate={serviceRate}
        setTaxAmount={setTax}
        split={split}
        status={splitStatus}
        subtotalCents={subtotalCents}
        taxAmount={taxAmount}
      />
    ),
    results: (
      <ResultsScreen
        go={go}
        paidBy={paidBy}
        paidPeople={paidPeople}
        setSelectedPerson={setSelectedPerson}
        split={split}
        togglePaidPerson={togglePaidPerson}
      />
    ),
    detail: (
      <DetailScreen
        go={go}
        paid={paidPeople.includes(selectedPerson)}
        personName={selectedPerson}
        split={split}
      />
    ),
    quick: <QuickSplitScreen go={go} people={activePeople} />,
  };

  return (
    <main className="app-page">
      <SketchSymbols />
      <section className="app-stage" aria-label="splitlah sketch prototype">
        <Clipboard>{currentScreen[screen]}</Clipboard>
      </section>
    </main>
  );
}

function SketchSymbols() {
  return (
    <svg
      aria-hidden="true"
      className="symbol-defs"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <symbol id="clipboard" viewBox={symbolViewBoxes.clipboard}>
        <path
          d="M31 25 C21 29 15 40 16 55 C19 138 17 217 15 356 C16 394 30 409 62 409 C119 411 187 407 242 410 C273 410 287 394 285 361 C280 258 285 148 282 57 C281 36 270 25 249 25 C220 24 187 27 160 25 C120 22 72 23 31 25 Z"
          fill="#f5f2eb"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.8"
        />
        <path
          d="M123 18 C123 10 130 6 141 7 C153 8 166 6 178 7 C186 8 193 12 193 21 C190 34 124 34 121 22 C122 20 122 19 123 18 Z"
          fill="#f5f2eb"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          transform="rotate(1.4 157 20)"
        />
      </symbol>
      <symbol id="clipboard-sm" viewBox={symbolViewBoxes["clipboard-sm"]}>
        <path
          d="M28 23 C19 27 15 38 16 51 C17 109 15 171 16 236 C17 260 31 270 58 268 C115 266 183 270 241 268 C267 267 283 255 283 232 C280 176 284 106 281 52 C280 35 269 24 249 23 C196 25 140 21 87 23 C65 24 45 21 28 23 Z"
          fill="#f5f2eb"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          d="M124 16 C126 8 132 6 143 7 C154 8 167 6 178 8 C187 9 193 13 193 21 C190 33 125 33 122 22 C122 20 123 18 124 16 Z"
          fill="#f5f2eb"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.1"
          transform="rotate(-1.2 157 20)"
        />
      </symbol>
      <symbol id="btn-primary" viewBox={symbolViewBoxes["btn-primary"]}>
        <path
          d="M22 3 C64 2 112 1 160 3 C197 4 218 12 217 23 C216 35 196 42 161 41 C117 40 73 43 25 41 C9 40 2 32 3 22 C4 11 11 5 22 3 Z"
          fill="#1a1a1a"
        />
      </symbol>
      <symbol id="btn-outline" viewBox={symbolViewBoxes["btn-outline"]}>
        <path
          d="M20 4 C62 3 113 4 161 3 C197 3 216 12 216 24 C216 35 196 41 161 40 C114 39 70 42 25 40 C10 39 3 31 4 21 C5 11 10 5 20 4 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </symbol>
      <symbol id="btn-wide" viewBox={symbolViewBoxes["btn-wide"]}>
        <path
          d="M11 5 C82 3 154 4 269 5 C276 9 278 16 277 24 C278 33 274 42 266 44 C184 42 95 45 12 43 C5 39 3 31 4 23 C4 14 5 8 11 5 Z"
          fill="#1a1a1a"
        />
      </symbol>
      <symbol id="input-box" viewBox={symbolViewBoxes["input-box"]}>
        <path
          d="M5 7 C49 5 96 7 139 5 C169 5 194 4 214 7 C216 14 215 23 214 31 C160 29 114 33 65 31 C42 30 23 32 6 30 C3 22 4 14 5 7 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </symbol>
      <symbol id="input-box-sm" viewBox={symbolViewBoxes["input-box-sm"]}>
        <path
          d="M5 6 C26 4 48 6 68 5 C80 4 91 5 96 7 C97 13 96 23 95 27 C72 29 45 27 23 28 C14 28 7 27 5 25 C4 18 4 11 5 6 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </symbol>
      <symbol id="input-underline" viewBox={symbolViewBoxes["input-underline"]}>
        <path
          d="M4 9 C33 7 61 11 89 9 C121 7 146 10 176 8"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="item-card" viewBox={symbolViewBoxes["item-card"]}>
        <path
          d="M9 6 C60 4 109 6 157 5 C196 5 232 3 262 7 C266 16 266 34 262 45 C204 47 154 45 98 46 C61 46 31 48 8 44 C5 32 5 17 9 6 Z"
          fill="#f0ede4"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      </symbol>
      <symbol id="item-card-selected" viewBox={symbolViewBoxes["item-card-selected"]}>
        <path
          d="M8 6 C59 3 113 7 158 4 C198 5 232 2 263 8 C267 18 266 35 261 46 C204 48 154 44 98 47 C61 47 29 48 7 44 C4 32 4 17 8 6 Z"
          fill="#f0ede4"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </symbol>
      <symbol id="chip" viewBox={symbolViewBoxes.chip}>
        <path
          d="M9 4 C19 3 32 5 45 4 C52 5 55 9 54 14 C53 20 49 22 42 21 C31 20 21 22 10 21 C5 20 2 16 3 12 C3 8 5 5 9 4 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      </symbol>
      <symbol id="chip-checked" viewBox={symbolViewBoxes["chip-checked"]}>
        <path
          d="M9 4 C20 3 32 5 45 4 C52 5 55 9 54 14 C53 20 49 22 42 21 C31 20 21 22 10 21 C5 20 2 16 3 12 C3 8 5 5 9 4 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
        <path
          d="M9 12 C11 15 13 17 15 18 C18 14 21 10 24 7"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </symbol>
      <symbol id="checkbox-empty" viewBox={symbolViewBoxes["checkbox-empty"]}>
        <path
          d="M3 2 C7 1 11 2 14 3 C15 7 14 11 13 14 C9 15 5 14 2 13 C1 9 2 5 3 2 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="checkbox-checked" viewBox={symbolViewBoxes["checkbox-checked"]}>
        <path
          d="M3 2 C7 1 11 2 14 3 C15 7 14 11 13 14 C9 15 5 14 2 13 C1 9 2 5 3 2 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M4 9 C6 10 7 12 8 13 C10 9 12 6 14 4"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </symbol>
      <symbol id="divider-solid" viewBox={symbolViewBoxes["divider-solid"]}>
        <path
          d="M4 6 C46 5 88 8 130 6 C177 4 223 8 266 6"
          fill="none"
          opacity="0.3"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeWidth="1"
        />
      </symbol>
      <symbol id="divider-dashed" viewBox={symbolViewBoxes["divider-dashed"]}>
        <path
          d="M4 6 C12 5 19 7 27 6 M40 6 C48 4 55 7 63 6 M76 7 C86 5 94 5 102 6 M116 6 C124 7 133 5 142 6 M156 6 C164 5 171 7 179 6 M193 7 C202 5 211 6 220 6 M234 6 C244 5 253 8 266 6"
          fill="none"
          opacity="0.3"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeWidth="1"
        />
      </symbol>
      <symbol id="warning-squiggle" viewBox={symbolViewBoxes["warning-squiggle"]}>
        <path
          d="M4 9 C11 3 18 15 25 9 C32 3 39 15 46 9 C53 3 60 15 67 9 C74 3 81 15 88 9 C95 3 102 15 116 8"
          fill="none"
          stroke="#cc5500"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="checkmark-done" viewBox={symbolViewBoxes["checkmark-done"]}>
        <path
          d="M2 7 C5 10 7 12 9 12 C11 8 13 5 15 2"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </symbol>
      <symbol id="dot-unpaid" viewBox={symbolViewBoxes["dot-unpaid"]}>
        <path
          d="M4 1 C6 1 7 3 7 4 C7 6 5 7 4 7 C2 7 1 6 1 4 C1 2 2 1 4 1 Z"
          fill="none"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      </symbol>
      <symbol id="clip" viewBox={symbolViewBoxes.clip}>
        <path
          d="M3 15 C4 6 11 2 21 3 C29 4 36 2 47 4 C50 7 50 12 48 16 C33 15 18 17 3 15 Z"
          fill="#dddddd"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          transform="rotate(1.5 26 9)"
        />
      </symbol>
    </svg>
  );
}

function Shape({ id, className = "" }: { id: SymbolId; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`shape ${className}`}
      focusable="false"
      viewBox={symbolViewBoxes[id]}
    >
      <use href={`#${id}`} />
    </svg>
  );
}

function Clipboard({ children }: { children: ReactNode }) {
  return (
    <div className="clipboard-shell">
      <Shape id="clipboard" className="clipboard-shape" />
      <div className="clipboard-content">{children}</div>
    </div>
  );
}

function HomeScreen({
  go,
  peopleCount,
  place,
  totalCents,
}: {
  go: (screen: ScreenId) => () => void;
  peopleCount: number;
  place: string;
  totalCents: number;
}) {
  return (
    <div className="screen screen-home">
      <div className="home-title">
        <span className="tiny-label">receipt math, but kinder</span>
        <h1>split it!</h1>
      </div>
      <Divider />
      <div className="home-actions">
        <SketchButton onClick={go("setup")}>+ new bill</SketchButton>
        <SketchButton onClick={go("quick")} variant="outline">
          quick split
        </SketchButton>
        <SketchButton onClick={go("results")} variant="outline">
          current split
        </SketchButton>
      </div>
      <div className="recent-note">
        <span>current bill</span>
        <strong>{place || "untitled bill"}</strong>
        <small>
          {peopleCount} people · {formatCurrency(totalCents)}
        </small>
      </div>
    </div>
  );
}

function SetupScreen({
  addPerson,
  date,
  go,
  includeServiceCharge,
  paidBy,
  people,
  place,
  roundTotals,
  setDate,
  setIncludeServiceCharge,
  setPaidBy,
  setPlace,
  setRoundTotals,
  updatePerson,
}: {
  addPerson: () => void;
  date: string;
  go: (screen: ScreenId) => () => void;
  includeServiceCharge: boolean;
  paidBy: string;
  people: string[];
  place: string;
  roundTotals: boolean;
  setDate: (value: string) => void;
  setIncludeServiceCharge: (value: boolean) => void;
  setPaidBy: (value: string) => void;
  setPlace: (value: string) => void;
  setRoundTotals: (value: boolean) => void;
  updatePerson: (index: number, value: string) => void;
}) {
  return (
    <div className="screen">
      <BackLink onClick={go("home")} />
      <h2>bill setup</h2>
      <div className="field-stack setup-scroll">
        <SketchInput label="place" onChange={setPlace} value={place} />
        <div className="field-row">
          <SketchInput label="date" onChange={setDate} size="sm" value={date} />
          <SketchInput label="paid by" onChange={setPaidBy} size="sm" value={paidBy} />
        </div>
        <div className="people-list" aria-label="people on this bill">
          {people.map((person, index) => (
            <PersonNameChip
              key={`p-${index}`}
              label={`p ${index + 1}`}
              onChange={(value) => updatePerson(index, value)}
              value={person}
            />
          ))}
          <button
            aria-label="add person"
            className="chip-button"
            onClick={addPerson}
            type="button"
          >
            <Shape id="chip" />
            <span>+</span>
          </button>
        </div>
        <CheckboxRow
          checked={includeServiceCharge}
          label="include service charge"
          onToggle={() => setIncludeServiceCharge(!includeServiceCharge)}
        />
        <CheckboxRow
          checked={roundTotals}
          label="round final totals"
          onToggle={() => setRoundTotals(!roundTotals)}
        />
      </div>
      <BottomAction onClick={go("items")}>next -&gt;</BottomAction>
    </div>
  );
}

function ItemsScreen({
  addItem,
  go,
  items,
  normalizeItemPrice,
  openAssignSheet,
  split,
  subtotalCents,
  updateItemName,
  updateItemPrice,
}: {
  addItem: () => void;
  go: (screen: ScreenId) => () => void;
  items: BillItem[];
  normalizeItemPrice: (id: string) => void;
  openAssignSheet: (id: string) => void;
  split: SplitResult | null;
  subtotalCents: number;
  updateItemName: (id: string, name: string) => void;
  updateItemPrice: (id: string, price: string) => void;
}) {
  return (
    <div className="screen">
      <BackLink onClick={go("setup")} />
      <div className="title-row">
        <h2>items</h2>
        <div className="running-total">
          <Shape id="btn-outline" />
          <span>{formatCurrency(split?.subtotalCents ?? subtotalCents)}</span>
        </div>
      </div>
      <div className="item-list item-list-scroll">
        {items.map((item, index) => (
          <EditableItemRow
            item={item}
            key={item.id}
            label={`item ${index + 1}`}
            normalizeItemPrice={normalizeItemPrice}
            onAssign={() => openAssignSheet(item.id)}
            updateItemName={updateItemName}
            updateItemPrice={updateItemPrice}
          />
        ))}
      </div>
      <button className="mini-add-button" onClick={addItem} type="button">
        <Shape id="btn-outline" />
        <span>+ add item</span>
      </button>
      <BottomAction onClick={go("charges")}>next -&gt;</BottomAction>
    </div>
  );
}

function AssignScreen({
  activePeople,
  go,
  items,
  selectedItem,
  split,
  subtotalCents,
  toggleItemAssignee,
}: {
  activePeople: string[];
  go: (screen: ScreenId) => () => void;
  items: BillItem[];
  selectedItem: BillItem;
  split: SplitResult | null;
  subtotalCents: number;
  toggleItemAssignee: (itemId: string, person: string) => void;
}) {
  return (
    <div className="screen">
      <BackLink onClick={go("items")} />
      <div className="title-row">
        <h2>items</h2>
        <div className="running-total">
          <Shape id="btn-outline" />
          <span>{formatCurrency(split?.subtotalCents ?? subtotalCents)}</span>
        </div>
      </div>
      <div className="item-list faded-context">
        {items.slice(0, 3).map((item) => (
          <ItemSummaryRow item={item} key={item.id} />
        ))}
      </div>
      <div className="bottom-sheet" role="dialog" aria-label="assign item">
        <Shape id="clipboard-sm" className="sheet-shape" />
        <div className="sheet-content">
          <div>
            <span className="tiny-label">assign item</span>
            <h3>{selectedItem.name || "untitled item"}</h3>
            <strong>{formatCurrency(moneyToCents(selectedItem.price))}</strong>
          </div>
          <div className="assign-options">
            {activePeople.length > 0 ? (
              activePeople.map((person) => {
                const checked = selectedItem.assignees.includes(person);

                return (
                  <button
                    className="assign-person"
                    key={person}
                    onClick={() => toggleItemAssignee(selectedItem.id, person)}
                    type="button"
                  >
                    <Shape id={checked ? "chip-checked" : "chip"} />
                    <span>{person}</span>
                  </button>
                );
              })
            ) : (
              <span className="empty-note">add people first</span>
            )}
          </div>
          <SketchButton onClick={go("items")}>done</SketchButton>
        </div>
      </div>
    </div>
  );
}

function ChargesScreen({
  go,
  includeServiceCharge,
  receiptAmount,
  setIncludeServiceCharge,
  setReceiptAmount,
  serviceRate,
  setServiceRate,
  split,
  status,
  subtotalCents,
  taxAmount,
  setTaxAmount,
}: {
  go: (screen: ScreenId) => () => void;
  includeServiceCharge: boolean;
  receiptAmount: string;
  setIncludeServiceCharge: (value: boolean) => void;
  setReceiptAmount: (value: string) => void;
  serviceRate: string;
  setServiceRate: (value: string) => void;
  split: SplitResult | null;
  status: SplitStatus;
  subtotalCents: number;
  taxAmount: string;
  setTaxAmount: (value: string) => void;
}) {
  return (
    <div className="screen">
      <BackLink onClick={go("items")} />
      <h2>charges</h2>
      <div className="charge-lines">
        <AmountLine
          label="items total"
          value={formatCurrency(split?.subtotalCents ?? subtotalCents)}
        />
        <div className="service-charge-control">
          <div className="service-charge-top">
            <span>service charge</span>
            <strong>{split ? formatCurrency(split.serviceCents) : "..."}</strong>
          </div>
          <PercentStepper value={serviceRate} onChange={setServiceRate} />
          <CheckboxRow
            checked={includeServiceCharge}
            compact
            label="use service charge"
            onToggle={() => setIncludeServiceCharge(!includeServiceCharge)}
          />
        </div>
        <MoneyAmountLine label="tax" onChange={setTaxAmount} value={taxAmount} />
        <Divider variant="dashed" />
        <MoneyAmountLine
          label="receipt says"
          onChange={setReceiptAmount}
          value={receiptAmount}
        />
        {split && split.mismatchCents !== 0 ? (
          <div className="warning-line">
            <span>mismatch: {formatSignedCurrency(split.mismatchCents)}</span>
            <Shape id="warning-squiggle" />
          </div>
        ) : (
          <div className="matched-line">
            <Shape id={status === "ready" ? "checkmark-done" : "dot-unpaid"} />
            <span>{calculationStatusText(status)}</span>
          </div>
        )}
      </div>
      <BottomAction onClick={go("results")}>show split -&gt;</BottomAction>
    </div>
  );
}

function ResultsScreen({
  go,
  paidBy,
  paidPeople,
  setSelectedPerson,
  split,
  togglePaidPerson,
}: {
  go: (screen: ScreenId) => () => void;
  paidBy: string;
  paidPeople: string[];
  setSelectedPerson: (person: string) => void;
  split: SplitResult | null;
  togglePaidPerson: (person: string) => void;
}) {
  const resultPeople = split?.people ?? emptyPeople();
  const personForButton = resultPeople.find((person) => person.name === paidBy) ?? resultPeople[0];

  return (
    <div className="screen">
      <BackLink onClick={go("charges")} />
      <h2>results</h2>
      <div className="result-list">
        {resultPeople.map((person) => (
          <ResultPerson
            key={person.name}
            name={person.name}
            onOpen={() => {
              setSelectedPerson(person.name);
              go("detail")();
            }}
            onTogglePaid={() => togglePaidPerson(person.name)}
            paid={paidPeople.includes(person.name)}
            value={split ? formatCurrency(person.totalCents) : "..."}
          />
        ))}
      </div>
      <Divider />
      <button
        className="plain-link"
        onClick={() => {
          if (personForButton) {
            setSelectedPerson(personForButton.name);
          }

          go("detail")();
        }}
        type="button"
      >
        view details
      </button>
      {personForButton ? (
        <SketchButton
          onClick={() => togglePaidPerson(personForButton.name)}
          variant="outline"
        >
          {paidPeople.includes(personForButton.name)
            ? `unmark ${personForButton.name}`
            : `mark ${personForButton.name} paid`}
        </SketchButton>
      ) : null}
      <BottomAction onClick={go("home")}>done -&gt;</BottomAction>
    </div>
  );
}

function DetailScreen({
  go,
  paid,
  personName,
  split,
}: {
  go: (screen: ScreenId) => () => void;
  paid: boolean;
  personName: string;
  split: SplitResult | null;
}) {
  const person = split?.people.find((row) => row.name === personName);

  return (
    <div className="screen">
      <BackLink onClick={go("results")} />
      <h2>{personName || "person"} detail</h2>
      <div className="detail-stack">
        {person && person.items.length > 0 ? (
          person.items.map((item) => (
            <AmountLine
              key={item.name}
              label={`${item.name} share`}
              value={formatCurrency(item.cents)}
            />
          ))
        ) : (
          <AmountLine label="items share" value="..." />
        )}
        <AmountLine
          label="service + tax"
          value={person ? formatCurrency(person.chargeShareCents) : "..."}
        />
        <Divider variant="dashed" />
        <AmountLine
          label={`${personName || "person"} pays`}
          value={person ? formatCurrency(person.totalCents) : "..."}
        />
      </div>
      <div className="paid-note">
        <Shape id={paid ? "checkmark-done" : "dot-unpaid"} />
        <span>{paid ? "paid" : "not paid yet"}</span>
      </div>
      <BottomAction onClick={go("results")}>back -&gt;</BottomAction>
    </div>
  );
}

function QuickSplitScreen({
  go,
  people,
}: {
  go: (screen: ScreenId) => () => void;
  people: string[];
}) {
  const quickPeople = people.length > 0 ? people : ["you"];
  const [total, setTotal] = useState("0.00");
  const [selectedPeople, setSelectedPeople] = useState(quickPeople);
  const selectedCount = selectedPeople.length || 1;
  const eachPays = Math.round(moneyToCents(total) / selectedCount);

  const toggleQuickPerson = (person: string) => {
    setSelectedPeople((current) =>
      current.includes(person)
        ? current.filter((selected) => selected !== person)
        : [...current, person],
    );
  };

  return (
    <div className="screen quick-screen">
      <BackLink onClick={go("home")} />
      <h2>quick split</h2>
      <div className="quick-amount">
        <span>total</span>
        <label className="quick-total-input">
          <span>rm</span>
          <input
            aria-label="quick split total"
            inputMode="numeric"
            onBlur={() => setTotal(formatMoneyInput(moneyToCents(total)))}
            onChange={(event) => setTotal(moneyDigitsToInput(event.target.value))}
            onFocus={(event) => event.target.select()}
            type="text"
            value={total}
          />
        </label>
        <Shape id="input-underline" />
      </div>
      <div className="quick-people">
        {quickPeople.map((person) => (
          <CheckboxRow
            checked={selectedPeople.includes(person)}
            key={person}
            label={person}
            onToggle={() => toggleQuickPerson(person)}
          />
        ))}
      </div>
      <Divider />
      <div className="per-person">
        <span>each pays</span>
        <strong>{formatCurrency(eachPays)}</strong>
      </div>
      <BottomAction onClick={go("home")}>save split -&gt;</BottomAction>
    </div>
  );
}

function PercentStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parsedValue = parseServiceRate(value);

  const step = (delta: number) => {
    onChange(formatRateValue(parsedValue + delta));
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(sanitizeRateInput(event.target.value));
  };

  return (
    <div className="percent-stepper" aria-label="service charge percent">
      <button
        aria-label="decrease service charge"
        className="step-button"
        data-testid="service-rate-decrease"
        onClick={() => step(-1)}
        type="button"
      >
        <Shape id="chip" />
        <span>-</span>
      </button>
      <label className="percent-input-wrap">
        <Shape id="input-box-sm" />
        <input
          aria-label="service charge percent"
          className="percent-input"
          data-testid="service-rate-input"
          inputMode="decimal"
          onBlur={() => onChange(formatRateValue(parsedValue))}
          onChange={handleInput}
          type="text"
          value={value}
        />
      </label>
      <span className="percent-mark">%</span>
      <button
        aria-label="increase service charge"
        className="step-button"
        data-testid="service-rate-increase"
        onClick={() => step(1)}
        type="button"
      >
        <Shape id="chip" />
        <span>+</span>
      </button>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button className="back-link" onClick={onClick} type="button">
      &lt;- back
    </button>
  );
}

function SketchButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "outline";
}) {
  return (
    <button className={`sketch-button ${variant}`} onClick={onClick} type="button">
      <Shape id={variant === "primary" ? "btn-primary" : "btn-outline"} />
      <span>{children}</span>
    </button>
  );
}

function BottomAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="bottom-action" onClick={onClick} type="button">
      <Shape id="btn-wide" />
      <span>{children}</span>
    </button>
  );
}

function SketchInput({
  inputMode,
  label,
  onBlur,
  onChange,
  size = "regular",
  value,
}: {
  inputMode?: "decimal" | "text";
  label: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  size?: "regular" | "sm";
  value: string;
}) {
  const shape = size === "sm" ? "input-box-sm" : "input-box";

  return (
    <label className={`sketch-field ${size}`}>
      <span>{label}</span>
      <span className="field-box">
        <Shape id={shape} />
        <input
          aria-label={label}
          className="field-input"
          inputMode={inputMode}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
      </span>
    </label>
  );
}

function PersonNameChip({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="person-chip">
      <Shape id="chip" />
      <input
        aria-label={label}
        className="chip-input"
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}

function CheckboxRow({
  checked = false,
  compact = false,
  label,
  onToggle,
}: {
  checked?: boolean;
  compact?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`checkbox-row ${compact ? "compact" : ""}`}
      onClick={onToggle}
      type="button"
    >
      <Shape id={checked ? "checkbox-checked" : "checkbox-empty"} />
      <span>{label}</span>
    </button>
  );
}

function EditableItemRow({
  item,
  label,
  normalizeItemPrice,
  onAssign,
  updateItemName,
  updateItemPrice,
}: {
  item: BillItem;
  label: string;
  normalizeItemPrice: (id: string) => void;
  onAssign: () => void;
  updateItemName: (id: string, name: string) => void;
  updateItemPrice: (id: string, price: string) => void;
}) {
  return (
    <div className="item-row item-editor">
      <Shape id="item-card" />
      <span className="item-main item-input-grid">
        <input
          aria-label={`${label} name`}
          className="item-name-input"
          onChange={(event) => updateItemName(item.id, event.target.value)}
          type="text"
          value={item.name}
        />
        <label className="item-price-input">
          <span>rm</span>
          <input
            aria-label={`${label} price`}
            inputMode="numeric"
            onBlur={() => normalizeItemPrice(item.id)}
            onChange={(event) => updateItemPrice(item.id, moneyDigitsToInput(event.target.value))}
            onFocus={(event) => event.target.select()}
            type="text"
            value={item.price}
          />
        </label>
      </span>
      <span className="item-chips">
        <button className="assign-open" onClick={onAssign} type="button">
          <Shape id="chip" />
          <span>assign</span>
        </button>
        {item.assignees.slice(0, 2).map((person) => (
          <Chip key={person}>{person}</Chip>
        ))}
      </span>
    </div>
  );
}

function ItemSummaryRow({ item }: { item: BillItem }) {
  return (
    <div className="item-row">
      <Shape id="item-card" />
      <span className="item-main">
        <strong>{item.name || "untitled item"}</strong>
        <span>{formatCurrency(moneyToCents(item.price))}</span>
      </span>
      <span className="item-chips">
        {item.assignees.map((person) => (
          <Chip key={person}>{person}</Chip>
        ))}
      </span>
    </div>
  );
}

function Chip({ children, checked = false }: { children: ReactNode; checked?: boolean }) {
  return (
    <span className={`chip ${checked ? "checked" : ""}`}>
      <Shape id={checked ? "chip-checked" : "chip"} />
      <span>{children}</span>
    </span>
  );
}

function MoneyAmountLine({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="amount-line editable-amount-line">
      <span>{label}</span>
      <label className="amount-input-wrap">
        <Shape id="input-box-sm" />
        <span>rm</span>
        <input
          aria-label={label}
          inputMode="numeric"
          onBlur={() => onChange(formatMoneyInput(moneyToCents(value)))}
          onChange={(event) => onChange(moneyDigitsToInput(event.target.value))}
          onFocus={(event) => event.target.select()}
          type="text"
          value={value}
        />
      </label>
    </div>
  );
}

function AmountLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="amount-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultPerson({
  name,
  onOpen,
  onTogglePaid,
  paid = false,
  value,
}: {
  name: string;
  onOpen: () => void;
  onTogglePaid: () => void;
  paid?: boolean;
  value: string;
}) {
  return (
    <div className="result-person">
      <button
        aria-label={`${paid ? "unmark" : "mark"} ${name} status`}
        className="status-button"
        onClick={onTogglePaid}
        type="button"
      >
        <Shape id={paid ? "checkmark-done" : "dot-unpaid"} />
      </button>
      <button className="result-open" onClick={onOpen} type="button">
        <strong>{name}</strong>
        <span>{value}</span>
      </button>
    </div>
  );
}

function Divider({ variant = "solid" }: { variant?: "solid" | "dashed" }) {
  return (
    <div className="divider">
      <Shape id={variant === "solid" ? "divider-solid" : "divider-dashed"} />
    </div>
  );
}

function parseServiceRate(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function sanitizeRateInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [wholePart, ...decimalParts] = cleaned.split(".");
  const whole = wholePart.slice(0, 3);

  if (decimalParts.length === 0) {
    return whole;
  }

  return `${whole}.${decimalParts.join("").slice(0, 2)}`;
}

function formatRateValue(value: number): string {
  const clamped = Math.min(100, Math.max(0, value));
  const rounded = Math.round(clamped * 100) / 100;

  return String(rounded);
}

function moneyToCents(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function moneyDigitsToInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d{3})/, "").slice(0, 8);
  const cents = Number(digits || "0");

  return formatMoneyInput(cents);
}

function formatMoneyInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

function formatCurrency(cents: number): string {
  return `rm ${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatSignedCurrency(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "-" : "";

  return `${sign}${formatCurrency(cents)}`;
}

function calculationStatusText(status: SplitStatus): string {
  if (status === "loading") {
    return "calculating...";
  }

  if (status === "error") {
    return "backend needs a retry";
  }

  return "totals match";
}

function normalizePeople(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function emptyPeople(): SplitPerson[] {
  return initialPeople.map((name) => ({
    chargeShareCents: 0,
    itemSubtotalCents: 0,
    items: [],
    name,
    totalCents: 0,
  }));
}
