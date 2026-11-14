// =====================================================================
//  Rutas: /api/estadisticas (panel de inicio)
// =====================================================================
const { Router } = require('express');
const { pool } = require('../db');
const { ESTADOS } = require('../estados');

const router = Router();

router.get('/', async (req, res) => {
    const [[totales]] = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM productos WHERE disponible = TRUE) AS productos_disponibles,
            (SELECT COUNT(*) FROM productos)                          AS productos,
            (SELECT COUNT(*) FROM clientes)                           AS clientes,
            (SELECT COUNT(*) FROM pedidos)                            AS pedidos,
            (SELECT COUNT(*) FROM pedidos WHERE DATE(fecha) = CURDATE()) AS pedidos_hoy,
            (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE estado <> 'Cancelado') AS ventas_totales,
            (SELECT COALESCE(SUM(total), 0) FROM pedidos
              WHERE estado <> 'Cancelado' AND DATE(fecha) = CURDATE())               AS ventas_hoy,
            (SELECT COALESCE(AVG(total), 0) FROM pedidos WHERE estado <> 'Cancelado') AS ticket_promedio`);

    const [porEstado] = await pool.query('SELECT estado, COUNT(*) AS cantidad FROM pedidos GROUP BY estado');
    const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    porEstado.forEach((f) => { conteo[f.estado] = Number(f.cantidad); });

    const [masVendidos] = await pool.query(`
        SELECT id, nombre, categoria, unidades_vendidas, ingresos
        FROM vista_ventas_producto
        WHERE unidades_vendidas > 0
        ORDER BY unidades_vendidas DESC, ingresos DESC
        LIMIT 5`);

    const numero = (v) => Math.round(Number(v) * 100) / 100;
    res.json({
        status: 'Success',
        data: {
            ...Object.fromEntries(Object.entries(totales).map(([k, v]) => [k, numero(v)])),
            pedidos_por_estado: conteo,
            mas_vendidos: masVendidos.map((p) => ({
                ...p, unidades_vendidas: Number(p.unidades_vendidas), ingresos: Number(p.ingresos)
            }))
        }
    });
});

module.exports = router;
