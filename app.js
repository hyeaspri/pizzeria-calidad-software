const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ========================================
// CONEXIÓN A LA BASE DE DATOS
// ========================================

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ========================================
// PRUEBA DE CONEXIÓN
// ========================================

app.get('/', (req, res) => {
    res.json({
        status: "Success",
        message: "API de Pizzería funcionando correctamente"
    });
});


// ========================================
// PEDIDOS
// ========================================

// Obtener todos los pedidos
app.get('/api/pedidos', async (req, res) => {

    try {

        const [pedidos] = await pool.query(`
            SELECT 
                p.id,
                c.nombre AS cliente,
                c.telefono,
                c.direccion,
                p.fecha,
                p.estado,
                p.total
            FROM pedidos p
            INNER JOIN clientes c ON p.cliente_id = c.id
            ORDER BY p.fecha DESC
        `);

        res.json({
            status: "Success",
            message: "Pedidos obtenidos correctamente",
            data: pedidos
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            status: "Error",
            message: "No se pudieron obtener los pedidos",
            error: error.message
        });

    }

});


// Obtener un pedido específico
app.get('/api/pedidos/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const [pedido] = await pool.query(`
            SELECT 
                p.id,
                c.nombre AS cliente,
                c.telefono,
                c.direccion,
                p.fecha,
                p.estado,
                p.total
            FROM pedidos p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = ?
        `, [id]);

        if (pedido.length === 0) {

            return res.status(404).json({
                status: "Error",
                message: "Pedido no encontrado"
            });

        }

        const [detalles] = await pool.query(`
            SELECT
                dp.id,
                pr.nombre AS producto,
                dp.cantidad,
                dp.precio,
                dp.subtotal
            FROM detalle_pedido dp
            INNER JOIN productos pr ON dp.producto_id = pr.id
            WHERE dp.pedido_id = ?
        `, [id]);

        res.json({
            status: "Success",
            pedido: pedido[0],
            detalles: detalles
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            status: "Error",
            message: "Error al consultar el pedido",
            error: error.message
        });

    }

});


// Crear un pedido
app.post('/api/pedidos', async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const {
            cliente_id,
            productos
        } = req.body;

        if (!cliente_id || !productos || productos.length === 0) {

            return res.status(400).json({
                status: "Error",
                message: "Debe proporcionar cliente y productos"
            });

        }

        await connection.beginTransaction();

        let total = 0;

        // Crear pedido inicialmente
        const [pedido] = await connection.query(`
            INSERT INTO pedidos (cliente_id, estado, total)
            VALUES (?, 'Pendiente', 0)
        `, [cliente_id]);

        const pedidoId = pedido.insertId;

        // Agregar productos
        for (const item of productos) {

            const [producto] = await connection.query(`
                SELECT id, precio
                FROM productos
                WHERE id = ? AND disponible = TRUE
            `, [item.producto_id]);

            if (producto.length === 0) {

                throw new Error(
                    `El producto ${item.producto_id} no existe o no está disponible`
                );

            }

            const precio = Number(producto[0].precio);
            const cantidad = Number(item.cantidad);
            const subtotal = precio * cantidad;

            total += subtotal;

            await connection.query(`
                INSERT INTO detalle_pedido
                (pedido_id, producto_id, cantidad, precio, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [
                pedidoId,
                item.producto_id,
                cantidad,
                precio,
                subtotal
            ]);

        }

        // Actualizar total
        await connection.query(`
            UPDATE pedidos
            SET total = ?
            WHERE id = ?
        `, [total, pedidoId]);

        await connection.commit();

        res.status(201).json({
            status: "Success",
            message: "Pedido creado correctamente",
            pedido_id: pedidoId,
            total: total
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            status: "Error",
            message: "No se pudo crear el pedido",
            error: error.message
        });

    } finally {

        connection.release();

    }

});


// Actualizar estado de un pedido
app.put('/api/pedidos/:id/estado', async (req, res) => {

    try {

        const { id } = req.params;
        const { estado } = req.body;

        const estadosPermitidos = [
            'Pendiente',
            'En preparación',
            'Listo',
            'En camino',
            'Entregado',
            'Cancelado'
        ];

        if (!estadosPermitidos.includes(estado)) {

            return res.status(400).json({
                status: "Error",
                message: "Estado no válido"
            });

        }

        const [resultado] = await pool.query(`
            UPDATE pedidos
            SET estado = ?
            WHERE id = ?
        `, [estado, id]);

        if (resultado.affectedRows === 0) {

            return res.status(404).json({
                status: "Error",
                message: "Pedido no encontrado"
            });

        }

        res.json({
            status: "Success",
            message: "Estado del pedido actualizado",
            pedido_id: id,
            nuevo_estado: estado
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            status: "Error",
            message: "No se pudo actualizar el estado",
            error: error.message
        });

    }

});


// ========================================
// CLIENTES
// ========================================

// Obtener clientes
app.get('/api/clientes', async (req, res) => {

    try {

        const [clientes] = await pool.query(`
            SELECT *
            FROM clientes
            ORDER BY nombre
        `);

        res.json({
            status: "Success",
            data: clientes
        });

    } catch (error) {

        res.status(500).json({
            status: "Error",
            message: "Error al obtener clientes",
            error: error.message
        });

    }

});


// Crear cliente
app.post('/api/clientes', async (req, res) => {

    try {

        const {
            nombre,
            telefono,
            direccion
        } = req.body;

        if (!nombre) {

            return res.status(400).json({
                status: "Error",
                message: "El nombre es obligatorio"
            });

        }

        const [resultado] = await pool.query(`
            INSERT INTO clientes
            (nombre, telefono, direccion)
            VALUES (?, ?, ?)
        `, [
            nombre,
            telefono,
            direccion
        ]);

        res.status(201).json({
            status: "Success",
            message: "Cliente creado correctamente",
            cliente_id: resultado.insertId
        });

    } catch (error) {

        res.status(500).json({
            status: "Error",
            message: "No se pudo crear el cliente",
            error: error.message
        });

    }

});


// ========================================
// PRODUCTOS
// ========================================

// Obtener productos
app.get('/api/productos', async (req, res) => {

    try {

        const [productos] = await pool.query(`
            SELECT *
            FROM productos
            ORDER BY categoria, nombre
        `);

        res.json({
            status: "Success",
            data: productos
        });

    } catch (error) {

        res.status(500).json({
            status: "Error",
            message: "Error al obtener productos",
            error: error.message
        });

    }

});


// Crear producto
app.post('/api/productos', async (req, res) => {

    try {

        const {
            nombre,
            descripcion,
            precio,
            categoria
        } = req.body;

        if (!nombre || !precio) {

            return res.status(400).json({
                status: "Error",
                message: "Nombre y precio son obligatorios"
            });

        }

        const [resultado] = await pool.query(`
            INSERT INTO productos
            (nombre, descripcion, precio, categoria)
            VALUES (?, ?, ?, ?)
        `, [
            nombre,
            descripcion,
            precio,
            categoria
        ]);

        res.status(201).json({
            status: "Success",
            message: "Producto creado correctamente",
            producto_id: resultado.insertId
        });

    } catch (error) {

        res.status(500).json({
            status: "Error",
            message: "No se pudo crear el producto",
            error: error.message
        });

    }

});


// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, async () => {

    try {

        const connection = await pool.getConnection();

        console.log("====================================");
        console.log("🍕 SISTEMA DE PIZZERÍA");
        console.log("====================================");
        console.log(`Servidor: http://localhost:${PORT}`);
        console.log("Base de datos: MySQL");
        console.log("Conexión a BD: OK");
        console.log("====================================");

        connection.release();

    } catch (error) {

        console.error("❌ Error conectando a MySQL:");
        console.error(error.message);

    }

});