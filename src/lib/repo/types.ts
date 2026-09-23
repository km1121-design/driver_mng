import type {
  AlertLog,
  DailyReport,
  DefectReport,
  Document,
  Driver,
  Vehicle,
} from "../types";

export type Tables = {
  drivers: Driver;
  vehicles: Vehicle;
  daily_reports: DailyReport;
  documents: Document;
  defect_reports: DefectReport;
  alert_logs: AlertLog;
};

export type TableName = keyof Tables;

/** データソース (モック / Google Sheets) を差し替えるための共通インターフェース */
export interface Repository {
  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: Tables[T]): Promise<void>;
  /** id 一致の行を部分更新する。見つからなければ例外 */
  update<T extends TableName>(
    table: T,
    id: string,
    patch: Partial<Tables[T]>,
  ): Promise<Tables[T]>;
  /** 一括登録・一括更新 (取り込み用。Sheets では API 呼び出しを1回にまとめる) */
  insertMany<T extends TableName>(table: T, rows: Tables[T][]): Promise<void>;
  updateMany<T extends TableName>(
    table: T,
    patches: { id: string; patch: Partial<Tables[T]> }[],
  ): Promise<void>;
}
