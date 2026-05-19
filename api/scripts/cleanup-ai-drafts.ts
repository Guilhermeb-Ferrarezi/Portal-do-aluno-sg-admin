import "../src/load-env";
import { pool } from "../src/db";

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const before = await client.query<{
      user_id: number;
      draft_count: string;
    }>(
      `SELECT user_id, COUNT(*)::text AS draft_count
       FROM ai_threads
       WHERE title = 'Nova conversa'
         AND status = 'idle'
         AND last_message_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM ai_messages m
           WHERE m.thread_id = ai_threads.id
         )
       GROUP BY user_id
       HAVING COUNT(*) > 1
       ORDER BY user_id ASC`
    );

    const deleted = await client.query<{
      id: number;
      user_id: number;
      title: string;
      updated_at: string;
    }>(
      `WITH ranked AS (
         SELECT
           id,
           user_id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY updated_at DESC, id DESC
           ) AS rn
         FROM ai_threads
         WHERE title = 'Nova conversa'
           AND status = 'idle'
           AND last_message_at IS NULL
           AND NOT EXISTS (
             SELECT 1
             FROM ai_messages m
             WHERE m.thread_id = ai_threads.id
           )
       ),
       deleted AS (
         DELETE FROM ai_threads t
         USING ranked r
         WHERE t.id = r.id
           AND r.rn > 1
         RETURNING t.id, t.user_id, t.title, t.updated_at
       )
       SELECT * FROM deleted
       ORDER BY user_id ASC, updated_at DESC, id DESC`
    );

    await client.query("COMMIT");

    console.log(`Drafts duplicados encontrados: ${before.rowCount}`);
    console.log(`Drafts removidos: ${deleted.rowCount}`);
    for (const row of deleted.rows) {
      console.log(`- user ${row.user_id}: thread ${row.id} (${row.title})`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
