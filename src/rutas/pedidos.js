// =====================================================================
//  Rutas: /api/pedidos
// =====================================================================
const { Router } = require('express');
const { pool, enTransaccion } = require('../db');
const { HttpError, noEncontrado } = require('../errores');
const { validarId, validarPedido } = require('../validaciones');
const { ESTADOS, siguientesEstados, esTransicionValida } = require('../estados');

const router = Router();

const COSTO_DOMICILIO = Number(process.env.COSTO_DOMICILIO ?? 5000);

const SELECT_PEDIDO = `
    SELECT p.id, p.cliente_id, c.nombre AS cliente, c.telefono, c.direccion,
           p.fecha, p.fecha_actualizacion, p.estado, p.tipo_entrega, p.metodo_pago,
           p.direccion_entrega, p.observaciones, p.subtotal, p.costo_domicilio, p.total
    FROM pedidos p
    INNER JOIN clientes c ON c.id = p.cliente_id`;

async function obtenerPedidoCompleto(id, db = pool) {
    const [pedidos] = await db.query(`${SELECT_PEDIDO} WHERE p.id = ?`, [id]);
    if (pedidos.length === 0) throw noEncontrado('Pedido');
    const pedido = pedidos[0];

    const [detalles] = await db.query(`
        SELECT d.id, d.producto_id, pr.nombre AS producto, d.cantidad, d.precio, d.subtotal
        FROM detalle_pedido d
        INNER JOIN productos pr ON pr.id = d.producto_id
        WHERE d.pedido_id = ?
        ORDER BY d.id`, [id]);

    const [historial] = await db.query(`
        SELECT estado_anterior, estado_nuevo, observacion, fecha
        FROM historial_estados
        WHERE pedido_id = ?
        ORDER BY fecha, id`, [id]);

    return {
        pedido: { ...pedido, siguientes_estados: siguientesEstados(pedido.estado, pedido.tipo_entrega) },
        detalles,
        historial
    };
}

// ---------- Listar pedidos (filtros: estado, cliente_id, desde, hasta) ----------
router.get('/', async (req, res) => {
    const condiciones = [];
    const params = [];

    if (req.query.estado && req.query.estado !== 'Todos') {
        if (!ESTADOS.includes(req.query.estado)) throw new HttpError(400, 'Estado de filtro no válido');
        condiciones.push('p.estado = ?');
        params.push(req.query.estado);
    }
    if (req.query.cliente_id) {
        condiciones.push('p.cliente_id = ?');
        params.push(validarId(req.query.cliente_id, 'cliente_id'));
    }
    const fecha = /^\d{4}-\d{2}-\d{2}$/;
    if (req.query.desde) {
        if (!fecha.test(req.query.desde)) throw new HttpError(400, 'La fecha "desde" debe tener formato AAAA-MM-DD');
        condiciones.push('p.fecha >= ?');
        params.push(`${req.query.desde} 00:00:00`);
    }
    if (req.query.hasta) {
        if (!fecha.test(req.query.hasta)) throw new HttpError(400, 'La fecha "hasta" debe tener formato AAAA-MM-DD');
        condiciones.push('p.fecha <= ?');
        params.push(`${req.query.hasta} 23:59:59`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [pedidos] = await pool.query(`
        SELECT p.id, p.cliente_id, c.nombre AS cliente, c.telefono, c.direccion,
               p.fecha, p.estado, p.tipo_entrega, p.metodo_pago, p.total,
               (SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_pedido d WHERE d.pedido_id = p.id) AS unidades
        FROM pedidos p
        INNER JOIN clientes c ON c.id = p.cliente_id
        ${where}
        ORDER BY p.fecha DESC, p.id DESC`, params);

    res.json({
        status: 'Success',
        message: 'Pedidos obtenidos correctamente',
        total: pedidos.length,
        data: pedidos.map((p) => ({ ...p, unidades: Number(p.unidades) }))
    });
});

// ---------- Obtener pedido con detalle e historial ----------
router.get('/:id', async (req, res) => {
    const resultado = await obtenerPedidoCompleto(validarId(req.params.id));
    // "pedido" y "detalles" se mantienen en la raíz por compatibilidad con la v1
    res.json({ status: 'Success', ...resultado, data: resultado });
});

// ---------- Crear pedido (transacción) ----------
router.post('/', async (req, res) => {
    const datos = validarPedido(req.body);

    const pedidoId = await enTransaccion(async (cx) => {
        // 1. El cliente debe existir
        const [clientes] = await cx.query('SELECT id, direccion FROM clientes WHERE id = ?', [datos.cliente_id]);
        if (clientes.length === 0) throw new HttpError(404, 'Cliente no encontrado');

        // 2. Dirección: la enviada o la registrada del cliente
        const direccion = datos.tipo_entrega === 'Domicilio'
            ? (datos.direccion_entrega || clientes[0].direccion)
            : null;
        if (datos.tipo_entrega === 'Domicilio' && !direccion) {
            throw new HttpError(400, 'Los pedidos a domicilio requieren una dirección de entrega');
        }

        // 3. Precios siempre desde la BD (nunca confiar en el precio que envía el navegador)
        const ids = datos.productos.map((p) => p.producto_id);
        const [productos] = await cx.query(
            'SELECT id, nombre, precio, disponible FROM productos WHERE id IN (?) FOR UPDATE', [ids]
        );
        const porId = new Map(productos.map((p) => [p.id, p]));

        let subtotal = 0;
        const lineas = datos.productos.map(({ producto_id, cantidad }) => {
            const producto = porId.get(producto_id);
            if (!producto) throw new HttpError(400, `El producto ${producto_id} no existe`);
            if (!producto.disponible) throw new HttpError(409, `El producto "${producto.nombre}" no está disponible`);
            const precio = Number(producto.precio);
            const totalLinea = precio * cantidad;
            subtotal += totalLinea;
            return [producto_id, cantidad, precio, totalLinea];
        });

        const costoDomicilio = datos.tipo_entrega === 'Domicilio' ? COSTO_DOMICILIO : 0;
        const total = subtotal + costoDomicilio;

        // 4. Encabezado, detalle e historial
        const [pedido] = await cx.query(`
            INSERT INTO pedidos (cliente_id, estado, tipo_entrega, metodo_pago, direccion_entrega,
                                 observaciones, subtotal, costo_domicilio, total)
            VALUES (?, 'Pendiente', ?, ?, ?, ?, ?, ?, ?)`,
            [datos.cliente_id, datos.tipo_entrega, datos.metodo_pago, direccion,
             datos.observaciones, subtotal, costoDomicilio, total]);

        await cx.query(
            'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal) VALUES ?',
            [lineas.map((l) => [pedido.insertId, ...l])]
        );

        await cx.query(
            `INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, observacion)
             VALUES (?, NULL, 'Pendiente', 'Pedido creado')`, [pedido.insertId]
        );

        return pedido.insertId;
    });

    const completo = await obtenerPedidoCompleto(pedidoId);
    res.status(201).json({
        status: 'Success',
        message: 'Pedido creado correctamente',
        pedido_id: pedidoId,
        total: completo.pedido.total,
        data: completo
    });
});

// ---------- Cambiar estado (respeta la máquina de estados) ----------
router.put('/:id/estado', async (req, res) => {
    const id = validarId(req.params.id);
    const estado = typeof req.body?.estado === 'string' ? req.body.estado.trim() : '';
    const observacion = typeof req.body?.observacion === 'string' ? req.body.observacion.trim().slice(0, 255) : null;

    if (!ESTADOS.includes(estado)) {
        throw new HttpError(400, `Estado no válido. Opciones: ${ESTADOS.join(', ')}`);
    }

    const anterior = await enTransaccion(async (cx) => {
        const [filas] = await cx.query('SELECT estado, tipo_entrega FROM pedidos WHERE id = ? FOR UPDATE', [id]);
        if (filas.length === 0) throw noEncontrado('Pedido');
        const { estado: actual, tipo_entrega } = filas[0];

        if (!esTransicionValida(actual, estado, tipo_entrega)) {
            const opciones = siguientesEstados(actual, tipo_entrega);
            throw new HttpError(409,
                opciones.length
                    ? `No se puede pasar de "${actual}" a "${estado}". Estados permitidos: ${opciones.join(', ')}`
                    : `El pedido ya está "${actual}" y no admite más cambios`);
        }

        await cx.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, id]);
        await cx.query(
            `INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, observacion)
             VALUES (?, ?, ?, ?)`, [id, actual, estado, observacion || 'Cambio de estado']
        );
        return actual;
    });

    res.json({
        status: 'Success',
        message: 'Estado del pedido actualizado',
        pedido_id: id,
        estado_anterior: anterior,
        nuevo_estado: estado,
        data: await obtenerPedidoCompleto(id)
    });
});

module.exports = router;
