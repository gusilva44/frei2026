import { pool } from "../config/database.js";

export async function listarTodos() {
  const [linhas] = await pool.execute(
    `SELECT id, nome, local, andar, cor, ordem FROM setores ORDER BY ordem ASC`,
  );
  return linhas;
}

export async function existe(id) {
  const [linhas] = await pool.execute(`SELECT id FROM setores WHERE id = ? LIMIT 1`, [id]);
  return linhas.length > 0;
}
