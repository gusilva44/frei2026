import mysql from "mysql2/promise";
const conn = await mysql.createConnection("mysql://root:1234@localhost:3306/feira_frei_2026");
const [rows] = await conn.execute("SELECT id, email, papel, ativo, senha_hash FROM administradores");
console.log(JSON.stringify(rows, null, 2));
await conn.end();