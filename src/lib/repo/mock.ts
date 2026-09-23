import type { Repository, TableName, Tables } from "./types";
import { todayJst } from "../date";

// 認証情報なしでも UI を確認できるよう、サーバープロセス内メモリにデモデータを保持する。
// dev サーバー再起動でリセットされる。

function addDays(days: number): string {
  const base = Date.parse(`${todayJst()}T00:00:00Z`);
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function seed(): { [K in TableName]: Tables[K][] } {
  return {
    drivers: [
      {
        id: "d001",
        name: "佐藤 健一",
        type: "full_commission",
        status: "active",
        phone: "090-1234-5678",
        email: "sato@example.com",
        emergency_contact_name: "佐藤 花子 (妻)",
        emergency_contact_phone: "090-0000-1111",
        line_user_id: "",
        license_expiry: addDays(1200),
        portal_token: "demo-sato",
      },
      {
        id: "d002",
        name: "鈴木 一郎",
        type: "part_time",
        status: "active",
        phone: "080-9876-5432",
        email: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        line_user_id: "",
        license_expiry: addDays(-3),
        portal_token: "demo-suzuki",
      },
      {
        id: "d003",
        name: "田中 次郎",
        type: "full_commission",
        status: "active",
        phone: "070-2222-3333",
        email: "tanaka@example.com",
        emergency_contact_name: "田中 三郎 (父)",
        emergency_contact_phone: "070-4444-5555",
        line_user_id: "",
        license_expiry: addDays(30),
        portal_token: "demo-tanaka",
      },
      {
        id: "d004",
        name: "高橋 美咲",
        type: "part_time",
        status: "on_leave",
        phone: "090-7777-8888",
        email: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        line_user_id: "",
        license_expiry: addDays(600),
        portal_token: "demo-takahashi",
      },
    ],
    vehicles: [
      {
        id: "v001",
        plate: "品川 500 め 12-34",
        car_type: "ハイゼットカーゴ",
        usage_type: "fixed",
        current_driver_id: "d001",
        status: "active",
        inspection_expiry: addDays(12),
        insurance_expiry: addDays(40),
        current_mileage: 45200,
        last_oil_mileage: 42000,
      },
      {
        id: "v002",
        plate: "練馬 400 あ 56-78",
        car_type: "エブリイ",
        usage_type: "shared",
        current_driver_id: "",
        status: "repair",
        inspection_expiry: addDays(320),
        insurance_expiry: addDays(350),
        current_mileage: 62100,
        last_oil_mileage: 55900,
      },
      {
        id: "v003",
        plate: "足立 480 い 90-12",
        car_type: "N-VAN",
        usage_type: "fixed",
        current_driver_id: "d003",
        status: "active",
        inspection_expiry: addDays(500),
        insurance_expiry: addDays(530),
        current_mileage: 30500,
        last_oil_mileage: 29000,
      },
      {
        id: "v004",
        plate: "品川 480 う 34-56",
        car_type: "エブリイ",
        usage_type: "shared",
        current_driver_id: "d002",
        status: "loaner",
        inspection_expiry: addDays(200),
        insurance_expiry: addDays(230),
        current_mileage: 88000,
        last_oil_mileage: 82500,
      },
    ],
    daily_reports: [
      {
        id: "r001",
        date: daysAgoIso(1),
        driver_id: "d001",
        vehicle_id: "v001",
        mileage: 45200,
        is_oil_changed: false,
        tire_ok: true,
        lights_brakes_ok: true,
        photo_url: "",
      },
      {
        id: "r002",
        date: daysAgoIso(18),
        driver_id: "d003",
        vehicle_id: "v003",
        mileage: 30500,
        is_oil_changed: false,
        tire_ok: true,
        lights_brakes_ok: true,
        photo_url: "",
      },
      {
        id: "r003",
        date: daysAgoIso(3),
        driver_id: "d002",
        vehicle_id: "v004",
        mileage: 88000,
        is_oil_changed: false,
        tire_ok: true,
        lights_brakes_ok: false,
        photo_url: "",
      },
    ],
    documents: [],
    defect_reports: [
      {
        id: "x001",
        date: daysAgoIso(2),
        driver_id: "d002",
        vehicle_id: "v004",
        location: "左後方バンパーの擦り傷",
        note: "乗車前からついていたキズです",
        photo_urls: "",
        status: "open",
      },
    ],
    alert_logs: [],
  };
}

const store = globalThis as unknown as {
  __fleetMockDb?: { [K in TableName]: Tables[K][] };
};

function db() {
  store.__fleetMockDb ??= seed();
  return store.__fleetMockDb;
}

export const mockRepository: Repository = {
  async list(table) {
    return structuredClone(db()[table]);
  },
  async insert(table, row) {
    (db()[table] as Tables[typeof table][]).push(structuredClone(row));
  },
  async update(table, id, patch) {
    const rows = db()[table] as Tables[typeof table][];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`${table}: id=${id} が見つかりません`);
    rows[idx] = { ...rows[idx], ...patch };
    return structuredClone(rows[idx]);
  },
};
