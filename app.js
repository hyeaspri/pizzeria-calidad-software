// =====================================================================
//  SISTEMA DE GESTIÓN DE PEDIDOS - PIZZERÍA
//  API REST con Node.js + Express 5 + MySQL
// =====================================================================
require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const cors = require('cors');

const { pool } = require('./src/db');
const { rutaNoEncontrada, manejadorErrores } = require('./src/errores');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ---------------------------------------------------------------------
//  Middlewares
// ---------------------------------------------------------------------
app.disable('x-powered-by');

// CORS: por defecto abierto en desarrollo; en producción definir CORS_ORIGIN
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));

app.use(express.json({ limit: '100kb' }));

// Cabeceras básicas de seguridad
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin'
    });
    next();
});

// Registro simple de peticiones (desactivado en pruebas)
if (process.env.NODE_ENV !== 'test') {
    app.use('/api', (req, res, next) => {
        const inicio = Date.now();
        res.on('finish', () => {
            console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - inicio} ms)`);
        });
        next();
    });
}

// ---------------------------------------------------------------------
//  Rutas de la API
// ---------------------------------------------------------------------
app.get('/api', (req, res) => {
    res.json({
        status: 'Success',
        message: 'API de Pizzería funcionando correctamente',
        version: '2.0.0',
        configuracion: { costo_domicilio: Number(process.env.COSTO_DOMICILIO ?? 5000) }
    });
});

// Verifica que la API y la base de datos respondan
app.get('/api/salud', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'Success', api: 'OK', base_de_datos: 'OK' });
    } catch {
        res.status(503).json({ status: 'Error', api: 'OK', base_de_datos: 'Sin conexión' });
    }
});

app.use('/api', require('./src/rutas/productos'));          // /api/productos, /api/categorias
app.use('/api/clientes', require('./src/rutas/clientes'));
app.use('/api/pedidos', require('./src/rutas/pedidos'));
app.use('/api/estadisticas', require('./src/rutas/estadisticas'));

app.use('/api', rutaNoEncontrada);

// ---------------------------------------------------------------------
//  Frontend: la misma app sirve la página en http://localhost:PORT
// ---------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'frontend')));

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

// ---------------------------------------------------------------------
//  Inicio del servidor (solo si se ejecuta directamente, no en pruebas)
// ---------------------------------------------------------------------
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log('====================================');
        console.log('🍕 SISTEMA DE PIZZERÍA v2.0');
        console.log('====================================');
        console.log(`Aplicación: http://localhost:${PORT}`);
        console.log(`API:        http://localhost:${PORT}/api`);
        try {
            await pool.query('SELECT 1');
            console.log('Conexión a BD: OK');
        } catch (error) {
            console.error('❌ Error conectando a MySQL:', error.message);
            console.error('   Revisa las variables del archivo .env');
        }
        console.log('====================================');
    });
}

module.exports = app;
