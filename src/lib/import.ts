import {
  DRIVER_STATUS_LABEL,
  DRIVER_TYPE_LABEL,
  USAGE_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  type Driver,
  type Vehicle,
} from "./types";

// 既存の台帳 (Excel・スプレッドシート) からの一括取り込み。
// 見出しの表記ゆれ・和暦・全角数字などを吸収し、取り込み前にプレビューできるようにする。

export type ImportKind = "drivers" | "vehicles";

export type PlannedRow = {
  line: number;
  action: "insert" | "update" | "skip";
  label: string;
  /** 取り込む値 (見出しが認識できた列のうち、空でないもの) */
  fields: Record<string, string | number>;
  errors: string[];
  warnings: string[];
  /** 更新対象の既存 id */
  targetId?: string;
};

export type ImportPlan = {
  kind: ImportKind;
  columns: { header: string; field: string | null }[];
  rows: PlannedRow[];
};

/* ---------- 表の読み込み ---------- */

/** Excel からのコピー (タブ区切り) と CSV の両方を受け付ける */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = src.split("\n", 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((v) => v.trim())).filter((r) => r.some((v) => v !== ""));
}

/* ---------- 見出しの対応表 ---------- */

const norm = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[\s_\-・()（）【】\[\]:：*※]/g, "");

const DRIVER_HEADERS: Record<string, string[]> = {
  id: ["id", "ドライバーid"],
  name: ["name", "氏名", "名前", "ドライバー名", "ドライバー", "従業員名"],
  type: ["type", "区分", "契約区分", "雇用区分", "契約形態"],
  status: ["status", "ステータス", "状態", "在籍状況"],
  phone: ["phone", "電話", "電話番号", "携帯", "携帯番号", "携帯電話"],
  email: ["email", "メール", "メールアドレス", "mail"],
  emergency_contact_name: ["emergencycontactname", "緊急連絡先", "緊急連絡先氏名", "緊急連絡先名前", "緊急連絡先続柄"],
  emergency_contact_phone: ["emergencycontactphone", "緊急連絡先電話", "緊急連絡先電話番号", "緊急連絡先tel"],
  line_user_id: ["lineuserid", "lineid", "lineユーザーid", "userid", "ユーザーid", "line"],
  license_expiry: ["licenseexpiry", "免許有効期限", "免許期限", "免許証有効期限", "免許証期限", "有効期限"],
  license_number: ["licensenumber", "免許証番号", "免許番号"],
  license_class: ["licenseclass", "免許種類", "免許の種類", "免許区分", "種類"],
  license_conditions: ["licenseconditions", "免許条件", "条件等", "免許の条件", "条件"],
};

const VEHICLE_HEADERS: Record<string, string[]> = {
  id: ["id", "車両id"],
  plate: ["plate", "ナンバー", "車両番号", "登録番号", "ナンバープレート", "車番"],
  car_type: ["cartype", "車種", "車名", "車両"],
  usage_type: ["usagetype", "利用区分", "区分", "使用区分", "運用"],
  current_driver_name: ["currentdriver", "担当ドライバー", "担当者", "ドライバー", "運転者", "使用者"],
  status: ["status", "ステータス", "状態"],
  inspection_expiry: ["inspectionexpiry", "車検満了日", "車検期限", "車検有効期限", "車検"],
  insurance_expiry: ["insuranceexpiry", "自賠責満了日", "自賠責期限", "自賠責保険期限", "自賠責"],
  current_mileage: ["currentmileage", "走行距離", "現在の走行距離", "現在走行距離", "メーター"],
  last_oil_mileage: ["lastoilmileage", "前回オイル交換距離", "オイル交換時距離", "前回オイル交換時の走行距離", "オイル交換距離"],
};

function mapHeaders(headers: string[], table: Record<string, string[]>) {
  const lookup = new Map<string, string>();
  for (const [field, aliases] of Object.entries(table)) for (const a of aliases) lookup.set(norm(a), field);
  const used = new Set<string>();
  return headers.map((h) => {
    const field = lookup.get(norm(h)) ?? null;
    if (!field || used.has(field)) return { header: h, field: null };
    used.add(field);
    return { header: h, field };
  });
}

/* ---------- 値の変換 ---------- */

const ERAS: Record<string, number> = { 令和: 2018, r: 2018, 平成: 1988, h: 1988, 昭和: 1925, s: 1925 };

/** 2026/5/1・2026-05-01・2026年5月1日・令和8年5月1日・R8.5.1・Excel のシリアル値 → YYYY-MM-DD */
export function parseDate(raw: string): string | null {
  const s = raw.normalize("NFKC").trim().toLowerCase().replace(/\s/g, "");
  if (!s) return null;
  const pad = (y: number, m: number, d: number) => {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const t = new Date(`${iso}T00:00:00Z`);
    return t.getUTCMonth() + 1 === m && t.getUTCDate() === d ? iso : null;
  };
  let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (m) return pad(+m[1], +m[2], +m[3]);
  m = s.match(/^(令和|平成|昭和|r|h|s)(\d{1,2}|元)[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (m) return pad(ERAS[m[1]] + (m[2] === "元" ? 1 : +m[2]), +m[3], +m[4]);
  if (/^\d{5}$/.test(s)) {
    // Excel の日付シリアル値 (1900 年方式)
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseKm(raw: string): number | null {
  const s = raw.normalize("NFKC").replace(/[,\s]|km/gi, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function matchLabel<K extends string>(raw: string, labels: Record<K, string>, extra: Record<string, K>): K | null {
  const s = norm(raw);
  if (!s) return null;
  for (const [k, v] of Object.entries(labels) as [K, string][]) if (norm(k) === s || norm(v) === s) return k;
  for (const [alias, k] of Object.entries(extra)) if (s.includes(norm(alias))) return k;
  return null;
}

const TYPE_ALIASES: Record<string, Driver["type"]> = {
  フルコミ: "full_commission", 業務委託: "full_commission", 委託: "full_commission", 正社員: "full_commission",
  社員: "full_commission", アルバイト: "part_time", パート: "part_time", バイト: "part_time",
};
const DRIVER_STATUS_ALIASES: Record<string, Driver["status"]> = {
  稼働: "active", 在籍: "active", 休: "on_leave", 退職: "retired", 退社: "retired",
};
const USAGE_ALIASES: Record<string, Vehicle["usage_type"]> = {
  固定: "fixed", 専用: "fixed", 専属: "fixed", 共有: "shared", 共用: "shared",
};
const VEHICLE_STATUS_ALIASES: Record<string, Vehicle["status"]> = {
  代車: "loaner", 修理: "repair", 整備: "repair", 予備: "spare", 待機: "spare", 廃車: "retired", 売却: "retired", 稼働: "active",
};

const nameKey = (s: string) => s.normalize("NFKC").replace(/\s/g, "");
const plateKey = (s: string) => s.normalize("NFKC").replace(/[\s-]/g, "");

/* ---------- 取り込み計画 ---------- */

export function planImport(
  kind: ImportKind,
  text: string,
  existing: { drivers: Driver[]; vehicles: Vehicle[] },
): ImportPlan {
  const table = parseTable(text);
  if (table.length < 2) throw new Error("見出し行と、1行以上のデータを貼り付けてください");
  const [headerRow, ...body] = table;
  const columns = mapHeaders(headerRow, kind === "drivers" ? DRIVER_HEADERS : VEHICLE_HEADERS);
  const mustHave = kind === "drivers" ? "name" : "plate";
  if (!columns.some((c) => c.field === mustHave)) {
    throw new Error(
      kind === "drivers"
        ? "「氏名」の列が見つかりません。1行目に見出し (氏名・電話番号 など) があるか確認してください"
        : "「ナンバー」の列が見つかりません。1行目に見出し (ナンバー・車種 など) があるか確認してください",
    );
  }

  const seen = new Set<string>();
  const rows = body.map((cells, i): PlannedRow => {
    const raw: Record<string, string> = {};
    columns.forEach((c, j) => {
      if (c.field && cells[j]) raw[c.field] = cells[j];
    });
    const row: PlannedRow = { line: i + 2, action: "insert", label: "", fields: {}, errors: [], warnings: [] };
    if (kind === "drivers") planDriver(raw, row, existing.drivers, seen);
    else planVehicle(raw, row, existing, seen);
    if (row.errors.length) row.action = "skip";
    return row;
  });
  return { kind, columns, rows };
}

function planDriver(raw: Record<string, string>, row: PlannedRow, drivers: Driver[], seen: Set<string>) {
  const f = row.fields;
  const name = raw.name?.normalize("NFKC").replace(/\s+/g, " ").trim() ?? "";
  row.label = name || "(氏名なし)";
  if (!name) row.errors.push("氏名が空です");
  const key = raw.id || nameKey(name);
  if (key && seen.has(key)) row.errors.push("同じドライバーが上の行にもあります");
  seen.add(key);

  const target = raw.id ? drivers.find((d) => d.id === raw.id) : drivers.find((d) => nameKey(d.name) === nameKey(name));
  if (raw.id && !target) row.errors.push(`id「${raw.id}」の既存ドライバーが見つかりません`);
  if (target) {
    row.action = "update";
    row.targetId = target.id;
  }
  if (name) f.name = name;

  if (raw.type) {
    const v = matchLabel(raw.type, DRIVER_TYPE_LABEL, TYPE_ALIASES);
    if (v) f.type = v;
    else row.warnings.push(`区分「${raw.type}」を判別できないため${target ? "変更しません" : "フルコミにします"}`);
  }
  if (raw.status) {
    const v = matchLabel(raw.status, DRIVER_STATUS_LABEL, DRIVER_STATUS_ALIASES);
    if (v) f.status = v;
    else row.warnings.push(`ステータス「${raw.status}」を判別できないため${target ? "変更しません" : "稼働中にします"}`);
  }
  for (const k of ["phone", "email", "emergency_contact_name", "emergency_contact_phone", "license_class", "license_conditions"]) {
    if (raw[k]) f[k] = raw[k].normalize("NFKC").trim();
  }
  if (raw.license_number) {
    const n = raw.license_number.normalize("NFKC").replace(/\D/g, "");
    if (n.length === 12) f.license_number = n;
    else row.warnings.push(`免許証番号「${raw.license_number}」が12桁ではないため取り込みません`);
  }
  if (raw.license_expiry) {
    const d = parseDate(raw.license_expiry);
    if (d) f.license_expiry = d;
    else row.errors.push(`免許有効期限「${raw.license_expiry}」を日付として読めません`);
  }
  if (raw.line_user_id) {
    const id = raw.line_user_id.trim();
    if (/^U[0-9a-f]{32}$/.test(id)) {
      f.line_user_id = id;
      const other = drivers.find((d) => d.line_user_id === id && d.id !== target?.id);
      if (other) row.errors.push(`この LINE ユーザーIDは「${other.name}」さんに登録済みです`);
    } else row.errors.push(`LINE ユーザーID「${id}」の形式が違います (U から始まる33文字)`);
  }
}

function planVehicle(
  raw: Record<string, string>,
  row: PlannedRow,
  existing: { drivers: Driver[]; vehicles: Vehicle[] },
  seen: Set<string>,
) {
  const f = row.fields;
  const plate = raw.plate?.normalize("NFKC").replace(/\s+/g, " ").trim() ?? "";
  row.label = plate || "(ナンバーなし)";
  if (!plate) row.errors.push("ナンバーが空です");
  const key = raw.id || plateKey(plate);
  if (key && seen.has(key)) row.errors.push("同じ車両が上の行にもあります");
  seen.add(key);

  const target = raw.id
    ? existing.vehicles.find((v) => v.id === raw.id)
    : existing.vehicles.find((v) => plateKey(v.plate) === plateKey(plate));
  if (raw.id && !target) row.errors.push(`id「${raw.id}」の既存車両が見つかりません`);
  if (target) {
    row.action = "update";
    row.targetId = target.id;
  }
  if (plate) f.plate = plate;
  if (raw.car_type) f.car_type = raw.car_type.normalize("NFKC").trim();

  if (raw.current_driver_name) {
    const d = existing.drivers.find((x) => nameKey(x.name) === nameKey(raw.current_driver_name));
    if (d) f.current_driver_id = d.id;
    else row.warnings.push(`担当ドライバー「${raw.current_driver_name}」が台帳にないため空欄にします (先にドライバーを取り込んでください)`);
  }
  if (raw.usage_type) {
    const v = matchLabel(raw.usage_type, USAGE_TYPE_LABEL, USAGE_ALIASES);
    if (v) f.usage_type = v;
    else row.warnings.push(`利用区分「${raw.usage_type}」を判別できません`);
  }
  if (raw.status) {
    const v = matchLabel(raw.status, VEHICLE_STATUS_LABEL, VEHICLE_STATUS_ALIASES);
    if (v) f.status = v;
    else row.warnings.push(`ステータス「${raw.status}」を判別できません`);
  }
  for (const k of ["inspection_expiry", "insurance_expiry"] as const) {
    if (!raw[k]) continue;
    const d = parseDate(raw[k]);
    if (d) f[k] = d;
    else row.errors.push(`${k === "inspection_expiry" ? "車検満了日" : "自賠責満了日"}「${raw[k]}」を日付として読めません`);
  }
  for (const k of ["current_mileage", "last_oil_mileage"] as const) {
    if (!raw[k]) continue;
    const n = parseKm(raw[k]);
    if (n !== null) f[k] = n;
    else row.errors.push(`「${raw[k]}」を距離として読めません`);
  }
}
