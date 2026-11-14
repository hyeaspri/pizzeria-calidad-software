// =====================================================================
//  Utilidades para las pruebas automáticas
//  Las pruebas usan una base SEPARADA (pizzeria_test) para no tocar
//  los datos reales. Se recrea desde pizzeria.sql antes de cada archivo.
// =====================================================================
process.env.NODE_ENV = 'test';
require('dotenv').config({ quiet: true });
process.env.DB_NAME = process.env.DB_NAME_TEST || 'pizzeria_test';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function reiniciarBaseDePruebas() {
    const nombre = process.env.DB_NAME;
    if (!/^[a-z0-9_]+_test$/i.test(nombre)) {
        throw new Error(`Por seguridad la base de pruebas debe terminar en "_test" (actual: ${nombre})`);
    }

    // Se quita el bloque que crea la base "pizzeria" y se usa la de pruebas
    const script = fs.readFileSync(path.join(__dirname, '..', 'pizzeria.sql'), 'utf8')
        .replace(/-- @@BEGIN_DB[\s\S]*?-- @@END_DB/, '');

    const conexion = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true,
        charset: 'utf8mb4'
    });
    try {
        await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
        await conexion.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await conexion.query(`USE \`${nombre}\``);
        await conexion.query(script);
    } finally {
        await conexion.end();
    }
}

module.exports = { reiniciarBaseDePruebas };
