// Google Sheets の各シート（1行目ヘッダー）と 1:1 で対応するレコード型。
// 列の追加・変更時は src/lib/repo/sheets.ts の COLUMNS も合わせて更新すること。

export type DriverType = "full_commission" | "part_time";
export type DriverStatus = "active" | "on_leave" | "retired";

export type Driver = {
  id: string;
  name: string;
  type: DriverType;
  status: DriverStatus;
  phone: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  line_user_id: string;
  /** 運転免許証の有効期限 (YYYY-MM-DD) */
  license_expiry: string;
  /** 免許証番号 (12桁) */
  license_number: string;
  /** 免許の種類 (例: 普通・準中型) */
  license_class: string;
  /** 免許の条件等 (例: AT限定、眼鏡等) */
  license_conditions: string;
  /** ポータルURL用の推測困難なトークン。漏えい時は再発行する */
  portal_token: string;
};

export type VehicleUsageType = "fixed" | "shared";
export type VehicleStatus = "active" | "repair" | "loaner" | "spare" | "retired";

export type Vehicle = {
  id: string;
  plate: string;
  car_type: string;
  usage_type: VehicleUsageType;
  current_driver_id: string;
  status: VehicleStatus;
  /** 車検満了日 (YYYY-MM-DD) */
  inspection_expiry: string;
  /** 自賠責保険の満了日 (YYYY-MM-DD) */
  insurance_expiry: string;
  current_mileage: number;
  last_oil_mileage: number;
};

export type DailyReport = {
  id: string;
  /** ISO 8601 日時 */
  date: string;
  driver_id: string;
  vehicle_id: string;
  mileage: number;
  is_oil_changed: boolean;
  tire_ok: boolean;
  lights_brakes_ok: boolean;
  photo_url: string;
};

export type DocType =
  | "license_front"
  | "license_back"
  | "inspection_cert"
  | "inspection_record"
  | "insurance_cert";

export type Document = {
  id: string;
  date: string;
  driver_id: string;
  vehicle_id: string;
  doc_type: DocType;
  file_url: string;
  parsed_expiry_date: string;
  /** driver = ドライバー提出 / admin = 管理者アップロード */
  uploaded_by: "driver" | "admin";
};

export type DefectReport = {
  id: string;
  date: string;
  driver_id: string;
  vehicle_id: string;
  location: string;
  note: string;
  /** 複数写真は改行区切り */
  photo_urls: string;
  status: "open" | "resolved";
};

export type AlertLog = {
  id: string;
  date: string;
  driver_id: string;
  kind: AlertKind;
  channel: "auto" | "manual";
};

export type AlertKind = "license" | "inspection" | "insurance" | "oil" | "unreported";

export const DRIVER_TYPE_LABEL: Record<DriverType, string> = {
  full_commission: "フルコミ",
  part_time: "アルバイト",
};

export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  active: "稼働中",
  on_leave: "休業中",
  retired: "退職済",
};

export const USAGE_TYPE_LABEL: Record<VehicleUsageType, string> = {
  fixed: "固定",
  shared: "共有車",
};

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  active: "稼働中",
  repair: "修理中",
  loaner: "代車稼働中",
  spare: "予備車 (待機)",
  retired: "廃車・売却済",
};

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  license_front: "免許証 (表)",
  license_back: "免許証 (裏)",
  inspection_cert: "車検証",
  inspection_record: "検査証記録事項",
  insurance_cert: "自賠責保険証明書",
};

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  license: "免許証更新",
  inspection: "車検満了",
  insurance: "自賠責満了",
  oil: "オイル交換",
  unreported: "走行距離未報告",
};
