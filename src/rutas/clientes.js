// =====================================================================
//  Rutas: /api/clientes
// =====================================================================
const { Router } = require('express');
const { pool } = require('../db');
const { HttpError, noEncontrado } = require('../errores');
const { validarId, validarCliente } = require('../validaciones');

const router = Router();

const SELECT_CLIENTE = `
    SELECT c.id, c.nombre, c.telefono, c.email, c.direccion, c.fecha_registro,
           COUNT(p.id) AS total_pedidos,
           COALESCE(SUM(CASE WHEN p.estado <> 'Cancelado' THEN p.total END), 0) AS total_gastado
    FROM clientes c
    LEFT JOIN pedidos p ON p.cliente_id = c.id`;

async function obtenerCliente(id) {
    const [filas] = await pool.query(`${SELECT_CLIENTE} WHERE c.id = ? GROUP BY c.id`, [id]);
    if (filas.length === 0) throw noEncontrado('Cliente');
    return filas[0];
}

// ---------- Listar clientes (filtro: buscar) ----------
router.get('/', async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.buscar) {
        const patron = `%${String(req.query.buscar).trim()}%`;
        where = 'WHERE c.nombre LIKE ? OR c.telefono LIKE ? OR c.email LIKE ?';
        params.push(patron, patron, patron);
    }
    const [clientes] = await pool.query(
        `${SELECT_CLIENTE} ${where} GROUP BY c.id ORDER BY c.nombre`, params
    );
    res.json({ status: 'Success', total: clientes.length, data: clientes });
});

// ---------- Obtener un cliente con su historial de pedidos ----------
router.get('/:id', async (req, res) => {
    const id = validarId(req.params.id);
    const cliente = await obtenerCliente(id);
    const [pedidos] = await pool.query(
        `SELECT id, fecha, estado, total FROM pedidos WHERE cliente_id = ? ORDER BY fecha DESC, id DESC`, [id]
    );
    res.json({ status: 'Success', data: { ...cliente, pedidos } });
});

// ---------- Crear cliente ----------
router.post('/', async (req, res) => {
    const datos = validarCliente(req.body);
    const [resultado] = await pool.query(
        `INSERT INTO clientes (nombre, telefono, email, direccion) VALUES (?, ?, ?, ?)`,
        [datos.nombre, datos.telefono ?? null, datos.email ?? null, datos.direccion ?? null]
    );
    res.status(201).json({
        status: 'Success',
        message: 'Cliente creado correctamente',
        cliente_id: resultado.insertId,
        data: await obtenerCliente(resultado.insertId)
    });
});

// ---------- Actualizar cliente (parcial) ----------
router.put('/:id', async (req, res) => {
    const id = validarId(req.params.id);
    const datos = validarCliente(req.body, { parcial: true });
    await obtenerCliente(id);

    const campos = Object.keys(datos);
    await pool.query(
        `UPDATE clientes SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...campos.map((c) => datos[c]), id]
    );
    res.json({
        status: 'Success',
        message: 'Cliente actualizado correctamente',
        data: await obtenerCliente(id)
    });
});

// ---------- Eliminar cliente (solo si no tiene pedidos) ----------
router.delete('/:id', async (req, res) => {
    const id = validarId(req.params.id);
    const cliente = await obtenerCliente(id);
    if (cliente.total_pedidos > 0) {
        throw new HttpError(409, 'El cliente tiene pedidos registrados y no se puede eliminar');
    }
    await pool.query('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ status: 'Success', message: 'Cliente eliminado correctamente' });
});

module.exports = router;
