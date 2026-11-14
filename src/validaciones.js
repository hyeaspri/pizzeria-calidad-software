// =====================================================================
//  Validación de datos de entrada
//  Cada función devuelve { datos, errores }: datos limpios y una lista
//  de mensajes. Si hay errores la ruta responde 400 con todos juntos.
// =====================================================================
const { HttpError } = require('./errores');

const REGEX_TELEFONO = /^[0-9]{7,15}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TIPOS_ENTREGA = ['Domicilio', 'Recoger en tienda'];
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'];
const MAX_CANTIDAD = 50;
const MAX_ITEMS = 30;

const texto = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const vacio = (v) => v === undefined || v === null || texto(v) === '';

/** Lanza HttpError 400 si la lista tiene errores. */
function exigir(errores) {
    if (errores.length) {
        throw new HttpError(400, errores[0], errores);
    }
}

/** Valida un id numérico de la URL. */
function validarId(valor, nombre = 'id') {
    const id = Number(valor);
    if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, `El ${nombre} debe ser un número entero positivo`);
    }
    return id;
}

/**
 * Cliente. Con parcial = true (PUT) solo valida los campos enviados.
 */
function validarCliente(body = {}, { parcial = false } = {}) {
    const errores = [];
    const datos = {};

    if (!parcial || body.nombre !== undefined) {
        const nombre = texto(body.nombre);
        if (nombre.length < 3) errores.push('El nombre es obligatorio y debe tener al menos 3 caracteres');
        else if (nombre.length > 100) errores.push('El nombre no puede superar 100 caracteres');
        datos.nombre = nombre;
    }

    if (body.telefono !== undefined) {
        const telefono = texto(body.telefono).replace(/[\s-]/g, '');
        if (telefono && !REGEX_TELEFONO.test(telefono)) {
            errores.push('El teléfono debe tener entre 7 y 15 dígitos, solo números');
        }
        datos.telefono = telefono || null;
    }

    if (body.email !== undefined) {
        const email = texto(body.email).toLowerCase();
        if (email && !REGEX_EMAIL.test(email)) errores.push('El correo electrónico no es válido');
        if (email.length > 120) errores.push('El correo no puede superar 120 caracteres');
        datos.email = email || null;
    }

    if (body.direccion !== undefined) {
        const direccion = texto(body.direccion);
        if (direccion.length > 200) errores.push('La dirección no puede superar 200 caracteres');
        datos.direccion = direccion || null;
    }

    if (parcial && Object.keys(datos).length === 0) {
        errores.push('No se envió ningún campo para actualizar');
    }

    exigir(errores);
    return datos;
}

/** Producto. Con parcial = true (PUT) solo valida los campos enviados. */
function validarProducto(body = {}, { parcial = false } = {}) {
    const errores = [];
    const datos = {};

    if (!parcial || body.nombre !== undefined) {
        const nombre = texto(body.nombre);
        if (nombre.length < 3) errores.push('El nombre es obligatorio y debe tener al menos 3 caracteres');
        else if (nombre.length > 100) errores.push('El nombre no puede superar 100 caracteres');
        datos.nombre = nombre;
    }

    if (!parcial || body.precio !== undefined) {
        const precio = Number(body.precio);
        if (vacio(body.precio) || !Number.isFinite(precio) || precio <= 0) {
            errores.push('El precio es obligatorio y debe ser mayor que 0');
        } else if (precio > 1000000) {
            errores.push('El precio no puede superar $1.000.000');
        }
        datos.precio = Math.round(precio * 100) / 100;
    }

    if (!parcial || body.categoria_id !== undefined) {
        const categoria = Number(body.categoria_id);
        if (!Number.isInteger(categoria) || categoria <= 0) errores.push('La categoría es obligatoria');
        datos.categoria_id = categoria;
    }

    if (body.descripcion !== undefined) {
        const descripcion = texto(body.descripcion);
        if (descripcion.length > 255) errores.push('La descripción no puede superar 255 caracteres');
        datos.descripcion = descripcion || null;
    }

    if (body.disponible !== undefined) {
        if (typeof body.disponible !== 'boolean') errores.push('El campo disponible debe ser verdadero o falso');
        datos.disponible = body.disponible;
    }

    if (parcial && Object.keys(datos).length === 0) {
        errores.push('No se envió ningún campo para actualizar');
    }

    exigir(errores);
    return datos;
}

/**
 * Pedido. Une productos repetidos sumando cantidades.
 */
function validarPedido(body = {}) {
    const errores = [];

    const clienteId = Number(body.cliente_id);
    if (!Number.isInteger(clienteId) || clienteId <= 0) errores.push('Debe seleccionar un cliente válido');

    const tipoEntrega = vacio(body.tipo_entrega) ? 'Domicilio' : texto(body.tipo_entrega);
    if (!TIPOS_ENTREGA.includes(tipoEntrega)) errores.push(`Tipo de entrega no válido. Opciones: ${TIPOS_ENTREGA.join(', ')}`);

    const metodoPago = vacio(body.metodo_pago) ? 'Efectivo' : texto(body.metodo_pago);
    if (!METODOS_PAGO.includes(metodoPago)) errores.push(`Método de pago no válido. Opciones: ${METODOS_PAGO.join(', ')}`);

    const observaciones = texto(body.observaciones);
    if (observaciones.length > 255) errores.push('Las observaciones no pueden superar 255 caracteres');

    const direccion = texto(body.direccion_entrega);
    if (direccion.length > 200) errores.push('La dirección no puede superar 200 caracteres');

    const items = new Map();
    if (!Array.isArray(body.productos) || body.productos.length === 0) {
        errores.push('El pedido debe tener al menos un producto');
    } else if (body.productos.length > MAX_ITEMS) {
        errores.push(`El pedido no puede tener más de ${MAX_ITEMS} líneas`);
    } else {
        body.productos.forEach((item, i) => {
            const productoId = Number(item && item.producto_id);
            const cantidad = Number(item && item.cantidad);
            if (!Number.isInteger(productoId) || productoId <= 0) {
                errores.push(`Producto ${i + 1}: id de producto no válido`);
                return;
            }
            if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
                errores.push(`Producto ${i + 1}: la cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD}`);
                return;
            }
            items.set(productoId, (items.get(productoId) || 0) + cantidad);
        });
        for (const [id, cant] of items) {
            if (cant > MAX_CANTIDAD) errores.push(`El producto ${id} supera la cantidad máxima de ${MAX_CANTIDAD}`);
        }
    }

    exigir(errores);

    return {
        cliente_id: clienteId,
        tipo_entrega: tipoEntrega,
        metodo_pago: metodoPago,
        observaciones: observaciones || null,
        direccion_entrega: direccion || null,
        productos: [...items].map(([producto_id, cantidad]) => ({ producto_id, cantidad }))
    };
}

module.exports = {
    validarId,
    validarCliente,
    validarProducto,
    validarPedido,
    TIPOS_ENTREGA,
    METODOS_PAGO,
    MAX_CANTIDAD
};
