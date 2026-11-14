// =====================================================================
//  CP-38 a CP-40 · Estadísticas, seguridad y fiabilidad general
// =====================================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { reiniciarBaseDePruebas } = require('./helpers');
const { escaparHTML } = require('../frontend/utils');

let pool, request;

before(async () => {
    await reiniciarBaseDePruebas();
    const app = require('../app');
    ({ pool } = require('../src/db'));
    request = require('supertest')(app);
});
after(() => pool.end());

test('CP-38 | Adecuación funcional – corrección | Las estadísticas del panel coinciden con los datos (sin cancelados)', async () => {
    const res = await request.get('/api/estadisticas').expect(200);
    const d = res.body.data;
    assert.equal(d.pedidos, 4);
    assert.equal(d.clientes, 5);
    assert.equal(d.productos, 14);
    assert.equal(d.ventas_totales, 38000 + 74000 + 74000); // el pedido 4 está cancelado
    assert.equal(d.pedidos_por_estado.Cancelado, 1);
    assert.equal(d.pedidos_por_estado['En camino'], 0);
    assert.ok(d.mas_vendidos.length > 0);
    assert.ok(!d.mas_vendidos.some((p) => p.nombre === 'Pizza Cuatro Quesos')); // solo vendida en el cancelado
});

test('CP-39 | Seguridad | Resistencia a inyección SQL y a inyección de HTML (XSS)', async () => {
    const ataques = ["' OR '1'='1", "'; DROP TABLE clientes; --", '%" OR 1=1 #'];
    for (const buscar of ataques) {
        const res = await request.get('/api/clientes').query({ buscar }).expect(200);
        assert.equal(res.body.total, 0);
        await request.get('/api/productos').query({ buscar, categoria: buscar }).expect(200);
    }
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM clientes');
    assert.equal(n, 5);
    await request.get("/api/pedidos/1 OR 1=1").expect(400);

    // El frontend escapa el HTML antes de pintarlo
    assert.equal(escaparHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    const creado = await request.post('/api/clientes').send({ nombre: '<script>alert(1)</script>' }).expect(201);
    assert.equal(creado.body.data.nombre, '<script>alert(1)</script>'); // se guarda tal cual, se escapa al mostrar
});

test('CP-40 | Fiabilidad | Errores controlados: JSON mal formado, rutas inexistentes, sin detalles internos y cabeceras seguras', async () => {
    const malJson = await request.post('/api/clientes')
        .set('Content-Type', 'application/json').send('{"nombre": ').expect(400);
    assert.equal(malJson.body.message, 'El cuerpo de la petición no es un JSON válido');

    const ruta = await request.get('/api/no-existe').expect(404);
    assert.match(ruta.body.message, /Ruta no encontrada/);

    const salud = await request.get('/api/salud').expect(200);
    assert.equal(salud.body.base_de_datos, 'OK');
    assert.equal(salud.headers['x-content-type-options'], 'nosniff');
    assert.equal(salud.headers['x-powered-by'], undefined);

    // Ningún error expone mensajes técnicos de MySQL
    const errores = [ruta.body, malJson.body, (await request.get('/api/productos/0')).body];
    for (const cuerpo of errores) {
        assert.ok(!/ER_|sql|mysql|stack/i.test(JSON.stringify(cuerpo)));
    }

    const pagina = await request.get('/').expect(200);
    assert.match(pagina.text, /<title>Pizzería/);
});
