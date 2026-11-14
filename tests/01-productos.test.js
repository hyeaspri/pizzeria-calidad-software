// =====================================================================
//  CP-01 a CP-11 · Productos y categorías
// =====================================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { reiniciarBaseDePruebas } = require('./helpers');

let app, pool, request;

before(async () => {
    await reiniciarBaseDePruebas();
    app = require('../app');
    ({ pool } = require('../src/db'));
    request = require('supertest')(app);
});
after(() => pool.end());

test('CP-01 | Adecuación funcional | Consultar las categorías con su número de productos', async () => {
    const res = await request.get('/api/categorias').expect(200);
    assert.equal(res.body.status, 'Success');
    assert.deepEqual(res.body.data.map((c) => c.nombre), ['Pizza', 'Bebida', 'Entrada', 'Postre']);
    assert.equal(res.body.data.find((c) => c.nombre === 'Pizza').total_productos, 6);
});

test('CP-02 | Adecuación funcional | Listar todos los productos con su categoría', async () => {
    const res = await request.get('/api/productos').expect(200);
    assert.equal(res.body.total, 14);
    const pepperoni = res.body.data.find((p) => p.nombre === 'Pizza Pepperoni');
    assert.equal(pepperoni.precio, 28000);
    assert.equal(pepperoni.categoria, 'Pizza');
    assert.equal(pepperoni.disponible, true);
});

test('CP-03 | Adecuación funcional | Filtrar productos por categoría y buscar por texto', async () => {
    const bebidas = await request.get('/api/productos').query({ categoria: 'Bebida' }).expect(200);
    assert.equal(bebidas.body.total, 4);
    assert.ok(bebidas.body.data.every((p) => p.categoria === 'Bebida'));

    const busqueda = await request.get('/api/productos').query({ buscar: 'queso' }).expect(200);
    assert.ok(busqueda.body.total >= 3);
    assert.ok(busqueda.body.data.every((p) => /queso/i.test(`${p.nombre} ${p.descripcion}`)));
});

test('CP-04 | Fiabilidad | Consultar un producto inexistente responde 404', async () => {
    const res = await request.get('/api/productos/9999').expect(404);
    assert.equal(res.body.message, 'Producto no encontrado');
});

test('CP-05 | Fiabilidad | Un id no numérico en la URL responde 400', async () => {
    const res = await request.get('/api/productos/abc').expect(400);
    assert.match(res.body.message, /entero positivo/);
});

test('CP-06 | Adecuación funcional | Crear un producto válido', async () => {
    const res = await request.post('/api/productos')
        .send({ nombre: 'Pizza BBQ', descripcion: 'Pollo y salsa BBQ', precio: 31000, categoria_id: 1 })
        .expect(201);
    assert.equal(res.body.data.nombre, 'Pizza BBQ');
    assert.equal(res.body.data.categoria, 'Pizza');
    assert.equal(res.body.data.disponible, true);
});

test('CP-07 | Adecuación funcional | Rechazar producto con precio negativo, cero o sin nombre', async () => {
    for (const cuerpo of [
        { nombre: 'Pizza X', precio: -1000, categoria_id: 1 },
        { nombre: 'Pizza X', precio: 0, categoria_id: 1 },
        { nombre: 'Pizza X', precio: 'gratis', categoria_id: 1 },
        { precio: 10000, categoria_id: 1 }
    ]) {
        const res = await request.post('/api/productos').send(cuerpo).expect(400);
        assert.equal(res.body.status, 'Error');
    }
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM productos WHERE nombre = 'Pizza X'");
    assert.equal(total, 0);
});

test('CP-08 | Adecuación funcional | Rechazar producto con categoría inexistente', async () => {
    const res = await request.post('/api/productos')
        .send({ nombre: 'Producto huérfano', precio: 5000, categoria_id: 99 }).expect(400);
    assert.match(res.body.message, /categoría/);
});

test('CP-09 | Fiabilidad | Rechazar producto con nombre duplicado (409)', async () => {
    const res = await request.post('/api/productos')
        .send({ nombre: 'Pizza Hawaiana', precio: 26000, categoria_id: 1 }).expect(409);
    assert.match(res.body.message, /Ya existe/);
});

test('CP-10 | Adecuación funcional | Actualizar precio y disponibilidad de un producto', async () => {
    const res = await request.put('/api/productos/8').send({ precio: 3500, disponible: false }).expect(200);
    assert.equal(res.body.data.precio, 3500);
    assert.equal(res.body.data.disponible, false);

    const lista = await request.get('/api/productos').query({ disponible: 'true' }).expect(200);
    assert.ok(!lista.body.data.some((p) => p.id === 8));
});

test('CP-11 | Fiabilidad | No eliminar productos usados en pedidos; sí eliminar los que no tienen ventas', async () => {
    const usado = await request.delete('/api/productos/1').expect(409);
    assert.match(usado.body.message, /no disponible/);

    const nuevo = await request.post('/api/productos')
        .send({ nombre: 'Producto temporal', precio: 1000, categoria_id: 2 }).expect(201);
    await request.delete(`/api/productos/${nuevo.body.data.id}`).expect(200);
    await request.get(`/api/productos/${nuevo.body.data.id}`).expect(404);
});
