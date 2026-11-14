// =====================================================================
//  Conexión a MySQL mediante un pool de conexiones (mysql2/promise)
// =====================================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pizzeria',
    port: Number(process.env.DB_PORT) || 3306,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
    queueLimit: 0,
    // Devuelve DECIMAL como número y fechas como texto ISO estable
    decimalNumbers: true,
    dateStrings: true
});

/**
 * Ejecuta una función dentro de una transacción.
 * Si la función lanza un error se hace ROLLBACK; si termina bien, COMMIT.
 * La conexión siempre se libera.
 */
async function enTransaccion(fn) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        const resultado = await fn(conexion);
        await conexion.commit();
        return resultado;
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = { pool, enTransaccion };
