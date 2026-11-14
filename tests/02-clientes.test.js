// =====================================================================
//  CP-12 a CP-20 · Clientes
// =====================================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { reiniciarBaseDePruebas } = require('./helpers');

let pool, request;

before(async () => {
    await reiniciarBaseDePruebas();
    const app = require('../app');
    ({ pool } = require('../src/db'));
    request = require('supertest')(app);
});
after(() => pool.end());

test('CP-12 | Adecuación funcional | Registrar un cliente válido (normaliza el teléfono)', async () => {
    const res = await request.post('/api/clientes')
        .send({ nombre: '  Sofía Ruiz ', telefono: '310 777-8899', email: 'Sofia@Correo.com', direccion: 'Calle 45 #12-10' })
        .expect(201);
    assert.ok(res.body.cliente_id > 0);
    assert.equal(res.body.data.nombre, 'Sofía Ruiz');
    assert.equal(res.body.data.telefono, '3107778899');
    assert.equal(res.body.data.email, 'sofia@correo.com');
});

test('CP-13 | Adecuación funcional | Rechazar cliente sin nombre o con nombre de menos de 3 letras', async () => {
    await request.post('/api/clientes').send({ telefono: '3000000001' }).expect(400);
    const res = await request.post('/api/clientes').send({ nombre: 'Jo' }).expect(400);
    assert.match(res.body.message, /al menos 3/);
});

test('CP-14 | Adecuación funcional | Rechazar teléfono con letras o longitud incorrecta', async () => {
    for (const telefono of ['300abc4567', '123', '1234567890123456']) {
        const res = await request.post('/api/clientes').send({ nombre: 'Ana Gómez', telefono }).expect(400);
        assert.match(res.body.message, /teléfono/);
    }
});

test('CP-15 | Adecuación funcional | Rechazar correo electrónico inválido', async () => {
    const res = await request.post('/api/clientes').send({ nombre: 'Ana Gómez', email: 'ana@correo' }).expect(400);
    assert.match(res.body.message, /correo/);
});

test('CP-16 | Fiabilidad | Rechazar teléfono ya registrado (409)', async () => {
    const res = await request.post('/api/clientes')
        .send({ nombre: 'Otra Persona', telefono: '3001234567' }).expect(409);
    assert.match(res.body.message, /teléfono/);
});

test('CP-17 | Usabilidad | Buscar clientes por nombre, teléfono o correo', async () => {
    const porNombre = await request.get('/api/clientes').query({ buscar: 'lópez' }).expect(200);
    assert.deepEqual(porNombre.body.data.map((c) => c.nombre), ['María López']);
    const porTelefono = await request.get('/api/clientes').query({ buscar: '3019876543' }).expect(200);
    assert.equal(porTelefono.body.data[0].nombre, 'Carlos Pérez');
});

test('CP-18 | Adecuación funcional | Consultar un cliente con su historial y total comprado', async () => {
    const res = await request.get('/api/clientes/2').expect(200);
    assert.equal(res.body.data.nombre, 'Carlos Pérez');
    assert.equal(res.body.data.total_pedidos, 1);
    assert.equal(res.body.data.total_gastado, 74000);
    assert.equal(res.body.data.pedidos.length, 1);
});

test('CP-19 | Adecuación funcional | Actualizar parcialmente los datos de un cliente', async () => {
    const res = await request.put('/api/clientes/3').send({ direccion: 'Carrera 30 #9-99' }).expect(200);
    assert.equal(res.body.data.direccion, 'Carrera 30 #9-99');
    assert.equal(res.body.data.nombre, 'María López');
    await request.put('/api/clientes/3').send({}).expect(400);
    await request.put('/api/clientes/999').send({ nombre: 'Nadie Aquí' }).expect(404);
});

test('CP-20 | Fiabilidad | No eliminar clientes con pedidos; sí eliminar los que no tienen', async () => {
    const conPedidos = await request.delete('/api/clientes/1').expect(409);
    assert.match(conPedidos.body.message, /pedidos registrados/);
    const nuevo = await request.post('/api/clientes').send({ nombre: 'Cliente Temporal' }).expect(201);
    await request.delete(`/api/clientes/${nuevo.body.cliente_id}`).expect(200);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM clientes WHERE id = ?', [nuevo.body.cliente_id]);
    assert.equal(total, 0);
});
