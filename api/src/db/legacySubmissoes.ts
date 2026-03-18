import { pool } from "../db";

let hasLegacySubmissoesTableCache: boolean | null = null;

export async function hasLegacySubmissoesTable() {
  if (hasLegacySubmissoesTableCache !== null) {
    return hasLegacySubmissoesTableCache;
  }

  const result = await pool.query<{ has_submissoes: boolean }>(
    `SELECT to_regclass('public.submissoes') IS NOT NULL AS has_submissoes`
  );

  hasLegacySubmissoesTableCache = !!result.rows[0]?.has_submissoes;
  return hasLegacySubmissoesTableCache;
}
