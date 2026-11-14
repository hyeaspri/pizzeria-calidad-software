// =====================================================================
//  Rutas: /api/productos y /api/categorias
// =====================================================================
const { Router } = require('express');
const { pool } = require('../db');
const { HttpError, noEncontrado } = require('../errores');
const { validarId, validarProducto } = require('../validaciones');

const router = Router();

const SELECT_PRODUCTO = `
    SELECT p.id, p.nombre, p.descripcion, p.precio, p.disponible,
           p.categoria_id, c.nombre AS categoria, c.icono
    FROM productos p
    INNER JOIN categorias c ON c.id = p.categoria_id`;

const normalizar = (p) => ({ ...p, disponible: Boolean(p.disponible) });

async function obtenerProducto(id) {
    const [filas] = await pool.query(`${SELECT_PRODUCTO} WHERE p.id = ?`, [id]);
    if (filas.length === 0) throw noEncontrado('Producto');
    return normalizar(filas[0]);
}

async function verificarCategoria(categoriaId) {
    const [filas] = await pool.query('SELECT id FROM categorias WHERE id = ?', [categoriaId]);
    if (filas.length === 0) throw new HttpError(400, 'La categoría seleccionada no existe');
}

// ---------- Categorías ----------
router.get('/categorias', async (req, res) => {
    const [categorias] = await pool.query(`
        SELECT c.id, c.nombre, c.descripcion, c.icono,
               COUNT(p.id) AS total_productos
        FROM categorias c
        LEFT JOIN productos p ON p.categoria_id = c.id
        GROUP BY c.id, c.nombre, c.descripcion, c.icono
        ORDER BY c.id`);
    res.json({ status: 'Success', data: categorias });
});

// ---------- Listar productos (filtros: categoria, buscar, disponible) ----------
router.get('/productos', async (req, res) => {
    const condiciones = [];
    const params = [];

    if (req.query.categoria && req.query.categoria !== 'Todos') {
        condiciones.push('c.nombre = ?');
        params.push(String(req.query.categoria));
    }
    if (req.query.buscar) {
        condiciones.push('(p.nombre LIKE ? OR p.descripcion LIKE ?)');
        const patron = `%${String(req.query.buscar).trim()}%`;
        params.push(patron, patron);
    }
    if (req.query.disponible === 'true' || req.query.disponible === 'false') {
        condiciones.push('p.disponible = ?');
        params.push(req.query.disponible === 'true');
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [productos] = await pool.query(`${SELECT_PRODUCTO} ${where} ORDER BY c.id, p.nombre`, params);

    res.json({ status: 'Success', total: productos.length, data: productos.map(normalizar) });
});

// ---------- Obtener un producto ----------
router.get('/productos/:id', async (req, res) => {
    const producto = await obtenerProducto(validarId(req.params.id));
    res.json({ status: 'Success', data: producto });
});

// ---------- Crear producto ----------
router.post('/productos', async (req, res) => {
    const datos = validarProducto(req.body);
    await verificarCategoria(datos.categoria_id);

    const [resultado] = await pool.query(
        `INSERT INTO productos (nombre, descripcion, precio, categoria_id, disponible)
         VALUES (?, ?, ?, ?, ?)`,
        [datos.nombre, datos.descripcion ?? null, datos.precio, datos.categoria_id, datos.disponible ?? true]
    );

    res.status(201).json({
        status: 'Success',
        message: 'Producto creado correctamente',
        data: await obtenerProducto(resultado.insertId)
    });
});

// ---------- Actualizar producto (parcial) ----------
router.put('/productos/:id', async (req, res) => {
    const id = validarId(req.params.id);
    const datos = validarProducto(req.body, { parcial: true });
    await obtenerProducto(id);
    if (datos.categoria_id !== undefined) await verificarCategoria(datos.categoria_id);

    const campos = Object.keys(datos);
    await pool.query(
        `UPDATE productos SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...campos.map((c) => datos[c]), id]
    );

    res.json({
        status: 'Success',
        message: 'Producto actualizado correctamente',
        data: await obtenerProducto(id)
    });
});

// ---------- Eliminar producto ----------
router.delete('/productos/:id', async (req, res) => {
    const id = validarId(req.params.id);
    await obtenerProducto(id);

    const [[{ usos }]] = await pool.query(
        'SELECT COUNT(*) AS usos FROM detalle_pedido WHERE producto_id = ?', [id]
    );
    if (usos > 0) {
        throw new HttpError(409, 'El producto aparece en pedidos registrados. Márcalo como no disponible en lugar de eliminarlo');
    }

    await pool.query('DELETE FROM productos WHERE id = ?', [id]);
    res.json({ status: 'Success', message: 'Producto eliminado correctamente' });
});

module.exports = router;
