import "server-only";
import { mockRepository } from "./mock";
import { sheetsRepository } from "./sheets";
import type { Repository } from "./types";

export type { Repository, TableName, Tables } from "./types";

/** DATA_SOURCE=sheets で Google Sheets、それ以外はメモリ上のデモデータを使う */
export function isSheetsMode() {
  return process.env.DATA_SOURCE === "sheets";
}

export function getRepo(): Repository {
  return isSheetsMode() ? sheetsRepository : mockRepository;
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/** ポータルURL用トークン (推測困難な 128bit 相当) */
export function newPortalToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}
