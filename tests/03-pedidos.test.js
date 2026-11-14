// =====================================================================
//  CP-21 a CP-37 · Pedidos, transacciones y estados
// =====================================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { reiniciarBaseDePruebas } = require('./helpers');
const { calcularTotales } = require('../frontend/utils');

let pool, request;

const contarPedidos = async () => (await pool.query('SELECT COUNT(*) AS n FROM pedidos'))[0][0].n;
const crearPedido = (cuerpo) => request.post('/api/pedidos').send(cuerpo);
const cambiarEstado = (id, estado) => request.put(`/api/pedidos/${id}/estado`).send({ estado });

before(async () => {
    await reiniciarBaseDePruebas();
    const app = require('../app');
    ({ pool } = require('../src/db'));
    request = require('supertest')(app);
});
after(() => pool.end());

test('CP-21 | Adecuación funcional – corrección | Pedido a domicilio: subtotal + domicilio correctos y iguales al cálculo del frontend', async () => {
    const res = await crearPedido({
        cliente_id: 5,
        productos: [{ producto_id: 1, cantidad: 2 }, { producto_id: 7, cantidad: 3 }],
        metodo_pago: 'Tarjeta'
    }).expect(201);

    const { pedido, detalles, historial } = res.body.data;
    assert.equal(pedido.subtotal, 2 * 28000 + 3 * 5000);
    assert.equal(pedido.costo_domicilio, 5000);
    assert.equal(pedido.total, 76000);
    assert.equal(pedido.estado, 'Pendiente');
    assert.equal(pedido.direccion_entrega, 'Calle 72 #11-40'); // dirección registrada del cliente
    assert.equal(detalles.length, 2);
    assert.equal(historial[0].estado_nuevo, 'Pendiente');

    const carrito = [{ id: 1, precio: 28000, cantidad: 2 }, { id: 7, precio: 5000, cantidad: 3 }];
    assert.equal(calcularTotales(carrito, 'Domicilio', 5000).total, pedido.total);
});

test('CP-22 | Adecuación funcional – corrección | Pedido para recoger en tienda no cobra domicilio', async () => {
    const res = await crearPedido({
        cliente_id: 2, tipo_entrega: 'Recoger en tienda',
        productos: [{ producto_id: 5, cantidad: 1 }]
    }).expect(201);
    assert.equal(res.body.data.pedido.costo_domicilio, 0);
    assert.equal(res.body.data.pedido.total, 24000);
    assert.equal(res.body.data.pedido.direccion_entrega, null);
});

test('CP-23 | Adecuación funcional – corrección | Productos repetidos en la solicitud se unen en una sola línea', async () => {
    const res = await crearPedido({
        cliente_id: 1, tipo_entrega: 'Recoger en tienda',
        productos: [{ producto_id: 2, cantidad: 1 }, { producto_id: 2, cantidad: 2 }]
    }).expect(201);
    assert.equal(res.body.data.detalles.length, 1);
    assert.equal(res.body.data.detalles[0].cantidad, 3);
    assert.equal(res.body.data.pedido.total, 78000);
});

test('CP-24 | Adecuación funcional | Rechazar cantidades no válidas (0, negativa, decimal, texto, mayor a 50)', async () => {
    const antes = await contarPedidos();
    for (const cantidad of [0, -2, 1.5, 'abc', 51, null]) {
        const res = await crearPedido({ cliente_id: 1, productos: [{ producto_id: 1, cantidad }] }).expect(400);
        assert.match(res.body.message, /cantidad/);
    }
    assert.equal(await contarPedidos(), antes);
});

test('CP-25 | Fiabilidad | Pedido con cliente inexistente responde 404 y no se guarda', async () => {
    const antes = await contarPedidos();
    const res = await crearPedido({ cliente_id: 999, productos: [{ producto_id: 1, cantidad: 1 }] }).expect(404);
    assert.equal(res.body.message, 'Cliente no encontrado');
    assert.equal(await contarPedidos(), antes);
});

test('CP-26 | Fiabilidad | Producto inexistente: la transacción hace rollback completo', async () => {
    const antes = await contarPedidos();
    const [[{ n: detallesAntes }]] = await pool.query('SELECT COUNT(*) AS n FROM detalle_pedido');
    await crearPedido({
        cliente_id: 1, productos: [{ producto_id: 1, cantidad: 1 }, { producto_id: 9999, cantidad: 1 }]
    }).expect(400);
    const [[{ n: detallesDespues }]] = await pool.query('SELECT COUNT(*) AS n FROM detalle_pedido');
    assert.equal(await contarPedidos(), antes);
    assert.equal(detallesDespues, detallesAntes);
});

test('CP-27 | Fiabilidad | Producto no disponible: responde 409 y no crea el pedido', async () => {
    await request.put('/api/productos/14').send({ disponible: false }).expect(200);
    const antes = await contarPedidos();
    const res = await crearPedido({ cliente_id: 1, productos: [{ producto_id: 14, cantidad: 1 }] }).expect(409);
    assert.match(res.body.message, /no está disponible/);
    assert.equal(await contarPedidos(), antes);
    await request.put('/api/productos/14').send({ disponible: true }).expect(200);
});

test('CP-28 | Adecuación funcional | Rechazar pedido sin productos o sin cliente', async () => {
    await crearPedido({ cliente_id: 1, productos: [] }).expect(400);
    await crearPedido({ cliente_id: 1 }).expect(400);
    await crearPedido({ productos: [{ producto_id: 1, cantidad: 1 }] }).expect(400);
    await request.post('/api/pedidos').expect(400);
});

test('CP-29 | Seguridad – integridad | El precio enviado por el navegador se ignora; se usa el de la BD', async () => {
    const res = await crearPedido({
        cliente_id: 1, tipo_entrega: 'Recoger en tienda',
        productos: [{ producto_id: 6, cantidad: 1, precio: 1 }], total: 1
    }).expect(201);
    assert.equal(res.body.data.detalles[0].precio, 32000);
    assert.equal(res.body.data.pedido.total, 32000);
});

test('CP-30 | Adecuación funcional | Pedido a domicilio sin dirección disponible responde 400', async () => {
    const cliente = await request.post('/api/clientes').send({ nombre: 'Sin Dirección' }).expect(201);
    const res = await crearPedido({
        cliente_id: cliente.body.cliente_id, tipo_entrega: 'Domicilio',
        productos: [{ producto_id: 1, cantidad: 1 }]
    }).expect(400);
    assert.match(res.body.message, /dirección/);
    await crearPedido({
        cliente_id: cliente.body.cliente_id, tipo_entrega: 'Domicilio', direccion_entrega: 'Calle 1 #2-3',
        productos: [{ producto_id: 1, cantidad: 1 }]
    }).expect(201);
});

test('CP-31 | Adecuación funcional | Consultar un pedido con detalle e historial de estados', async () => {
    const res = await request.get('/api/pedidos/2').expect(200);
    assert.equal(res.body.pedido.cliente, 'Carlos Pérez');           // compatibilidad v1
    assert.equal(res.body.data.detalles.length, 4);
    assert.deepEqual(res.body.data.historial.map((h) => h.estado_nuevo),
        ['Pendiente', 'En preparación', 'Listo', 'Entregado']);
    assert.deepEqual(res.body.data.pedido.siguientes_estados, []);
    await request.get('/api/pedidos/9999').expect(404);
});

test('CP-32 | Adecuación funcional | Flujo completo a domicilio: Pendiente → En preparación → Listo → En camino → Entregado', async () => {
    const { body } = await crearPedido({ cliente_id: 3, productos: [{ producto_id: 3, cantidad: 1 }] }).expect(201);
    const id = body.pedido_id;
    for (const estado of ['En preparación', 'Listo', 'En camino', 'Entregado']) {
        const res = await cambiarEstado(id, estado).expect(200);
        assert.equal(res.body.nuevo_estado, estado);
    }
    const final = await request.get(`/api/pedidos/${id}`).expect(200);
    assert.equal(final.body.data.pedido.estado, 'Entregado');
    assert.equal(final.body.data.historial.length, 5);
});

test('CP-33 | Adecuación funcional | Pedido para recoger: de "Listo" pasa a "Entregado" sin "En camino"', async () => {
    const { body } = await crearPedido({
        cliente_id: 4, tipo_entrega: 'Recoger en tienda', productos: [{ producto_id: 5, cantidad: 1 }]
    }).expect(201);
    const id = body.pedido_id;
    await cambiarEstado(id, 'En preparación').expect(200);
    const listo = await cambiarEstado(id, 'Listo').expect(200);
    assert.deepEqual(listo.body.data.pedido.siguientes_estados, ['Entregado']);
    await cambiarEstado(id, 'En camino').expect(409);
    await cambiarEstado(id, 'Entregado').expect(200);
});

test('CP-34 | Fiabilidad | Transición de estado no permitida responde 409 y no cambia el pedido', async () => {
    const res = await cambiarEstado(3, 'Entregado').expect(409);
    assert.match(res.body.message, /No se puede pasar de "Pendiente" a "Entregado"/);
    const pedido = await request.get('/api/pedidos/3').expect(200);
    assert.equal(pedido.body.data.pedido.estado, 'Pendiente');
});

test('CP-35 | Adecuación funcional | Estado inexistente o vacío responde 400', async () => {
    await cambiarEstado(3, 'Volando').expect(400);
    await cambiarEstado(3, '').expect(400);
    await request.put('/api/pedidos/3/estado').send({}).expect(400);
    await cambiarEstado(9999, 'Cancelado').expect(404);
});

test('CP-36 | Fiabilidad | Un pedido Cancelado o Entregado no admite más cambios', async () => {
    const cancelado = await cambiarEstado(4, 'Pendiente').expect(409);
    assert.match(cancelado.body.message, /no admite más cambios/);
    await cambiarEstado(2, 'Cancelado').expect(409);
});

test('CP-37 | Usabilidad | Filtrar pedidos por estado, cliente y fecha', async () => {
    const pendientes = await request.get('/api/pedidos').query({ estado: 'Pendiente' }).expect(200);
    assert.ok(pendientes.body.total > 0);
    assert.ok(pendientes.body.data.every((p) => p.estado === 'Pendiente'));

    const delCliente = await request.get('/api/pedidos').query({ cliente_id: 2 }).expect(200);
    assert.ok(delCliente.body.data.every((p) => p.cliente_id === 2));

    const hoy = new Date().toISOString().slice(0, 10);
    await request.get('/api/pedidos').query({ desde: '2020-01-01', hasta: hoy }).expect(200);
    await request.get('/api/pedidos').query({ desde: '14/11/2026' }).expect(400);
    await request.get('/api/pedidos').query({ estado: 'Inventado' }).expect(400);
});
