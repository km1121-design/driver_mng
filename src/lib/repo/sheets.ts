import { googleFetch } from "../google/auth";
import type { Repository, TableName, Tables } from "./types";

// 各シートの列定義（1行目ヘッダー）。シートが空なら初回アクセス時に自動作成する。
export const COLUMNS: { [K in TableName]: (keyof Tables[K] & string)[] } = {
  drivers: [
    "id",
    "name",
    "type",
    "status",
    "phone",
    "email",
    "emergency_contact_name",
    "emergency_contact_phone",
    "line_user_id",
    "license_expiry",
    "license_number",
    "license_class",
    "license_conditions",
    "portal_token",
  ],
  vehicles: [
    "id",
    "plate",
    "car_type",
    "usage_type",
    "current_driver_id",
    "status",
    "inspection_expiry",
    "insurance_expiry",
    "current_mileage",
    "last_oil_mileage",
  ],
  daily_reports: [
    "id",
    "date",
    "driver_id",
    "vehicle_id",
    "mileage",
    "is_oil_changed",
    "tire_ok",
    "lights_brakes_ok",
    "photo_url",
  ],
  documents: [
    "id",
    "date",
    "driver_id",
    "vehicle_id",
    "doc_type",
    "file_url",
    "parsed_expiry_date",
    "uploaded_by",
  ],
  defect_reports: [
    "id",
    "date",
    "driver_id",
    "vehicle_id",
    "location",
    "note",
    "photo_urls",
    "status",
  ],
  alert_logs: ["id", "date", "driver_id", "kind", "channel"],
};

const NUMBER_FIELDS = new Set(["current_mileage", "last_oil_mileage", "mileage"]);
const BOOLEAN_FIELDS = new Set(["is_oil_changed", "tire_ok", "lights_brakes_ok"]);
const DATE_FIELDS = new Set(["license_expiry", "inspection_expiry", "insurance_expiry", "parsed_expiry_date"]);

/** シートを手で編集して「2026/5/1」等の表示形式になった日付も YYYY-MM-DD に揃える */
function normalizeYmd(v: string) {
  const m = v.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : v.trim();
}

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const CACHE_TTL_MS = 10_000;

function spreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID が未設定です");
  return id;
}

function colLetter(n: number) {
  let s = "";
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  }
  return s;
}

function parseCell(field: string, raw: unknown): unknown {
  const v = raw ?? "";
  if (NUMBER_FIELDS.has(field)) return Number(String(v).replaceAll(",", "")) || 0;
  if (BOOLEAN_FIELDS.has(field)) return String(v).toUpperCase() === "TRUE";
  if (DATE_FIELDS.has(field)) return normalizeYmd(String(v));
  return String(v);
}

function serializeCell(field: string, v: unknown): string | number | boolean {
  if (NUMBER_FIELDS.has(field)) return Number(v) || 0;
  if (BOOLEAN_FIELDS.has(field)) return Boolean(v);
  return v == null ? "" : String(v);
}

type Sheet = { header: string[]; rows: unknown[][] };

const cache = new Map<TableName, { at: number; sheet: Sheet }>();
const ensured = new Set<TableName>();

async function ensureSheet(table: TableName) {
  if (ensured.has(table)) return;
  const meta = await googleFetch(
    `${API}/${spreadsheetId()}?fields=sheets.properties.title`,
  ).then((r) => r.json() as Promise<{ sheets: { properties: { title: string } }[] }>);
  if (!meta.sheets.some((s) => s.properties.title === table)) {
    await googleFetch(`${API}/${spreadsheetId()}:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: table } } }] }),
    });
  }
  const head = await googleFetch(
    `${API}/${spreadsheetId()}/values/${encodeURIComponent(`${table}!1:1`)}`,
  ).then((r) => r.json() as Promise<{ values?: string[][] }>);
  if (!head.values?.[0]?.length) {
    await googleFetch(
      `${API}/${spreadsheetId()}/values/${encodeURIComponent(`${table}!A1`)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [COLUMNS[table]] }),
      },
    );
  }
  ensured.add(table);
}

async function readSheet(table: TableName): Promise<Sheet> {
  const hit = cache.get(table);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.sheet;
  await ensureSheet(table);
  const res = await googleFetch(
    `${API}/${spreadsheetId()}/values/${encodeURIComponent(table)}`,
  ).then((r) => r.json() as Promise<{ values?: unknown[][] }>);
  const [header = [], ...rows] = res.values ?? [];
  const sheet = { header: header.map(String), rows };
  cache.set(table, { at: Date.now(), sheet });
  return sheet;
}

function toRecord<T extends TableName>(header: string[], row: unknown[]): Tables[T] {
  const rec: Record<string, unknown> = {};
  header.forEach((field, i) => {
    rec[field] = parseCell(field, row[i]);
  });
  return rec as Tables[T];
}

function toRow(header: string[], rec: Record<string, unknown>) {
  return header.map((field) => serializeCell(field, rec[field]));
}

export const sheetsRepository: Repository = {
  async list(table) {
    const { header, rows } = await readSheet(table);
    return rows
      .filter((r) => r.length > 0 && String(r[0] ?? "") !== "")
      .map((r) => toRecord(header, r));
  },

  async insert(table, row) {
    const { header } = await readSheet(table);
    await googleFetch(
      `${API}/${spreadsheetId()}/values/${encodeURIComponent(table)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [toRow(header, row as Record<string, unknown>)] }),
      },
    );
    cache.delete(table);
  },

  async update(table, id, patch) {
    cache.delete(table);
    const { header, rows } = await readSheet(table);
    const idCol = header.indexOf("id");
    const idx = rows.findIndex((r) => String(r[idCol] ?? "") === id);
    if (idx < 0) throw new Error(`${table}: id=${id} が見つかりません`);
    const merged = { ...toRecord(header, rows[idx]), ...patch } as Record<string, unknown>;
    // 行番号: ヘッダー(1行目) + 0始まり index
    const rowNo = idx + 2;
    await googleFetch(
      `${API}/${spreadsheetId()}/values/${encodeURIComponent(
        `${table}!A${rowNo}:${colLetter(header.length)}${rowNo}`,
      )}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [toRow(header, merged)] }),
      },
    );
    cache.delete(table);
    return merged as Tables[typeof table];
  },
};
