// =====================================================================
//  Funciones puras del frontend (sin DOM)
//  Se usan en el navegador (window.PizzeriaUtils) y en las pruebas
//  automáticas con Node (require('./frontend/utils.js')).
// =====================================================================
(function (raiz, fabrica) {
    const api = fabrica();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else raiz.PizzeriaUtils = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const MAX_CANTIDAD = 50;

    const formatoPesos = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    });

    /** 28000 → "$ 28.000" */
    function formatearPrecio(valor) {
        const numero = Number(valor);
        return formatoPesos.format(Number.isFinite(numero) ? numero : 0);
    }

    /** "2026-11-14 11:30:23" → "14 nov 2026, 11:30 a. m." */
    function formatearFecha(fecha) {
        if (!fecha) return '—';
        const d = new Date(String(fecha).replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    /** Evita inyección de HTML (XSS) al pintar datos del usuario. */
    function escaparHTML(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Agrega un producto al carrito; si ya está, suma 1 sin pasar del máximo. */
    function agregarAlCarrito(carrito, producto) {
        const copia = carrito.map((i) => ({ ...i }));
        const existente = copia.find((i) => i.id === producto.id);
        if (existente) {
            existente.cantidad = Math.min(existente.cantidad + 1, MAX_CANTIDAD);
        } else {
            copia.push({ id: producto.id, nombre: producto.nombre, precio: Number(producto.precio), icono: producto.icono, cantidad: 1 });
        }
        return copia;
    }

    /** Cambia la cantidad; si llega a 0 elimina el producto. */
    function cambiarCantidad(carrito, id, delta) {
        return carrito
            .map((i) => (i.id === id ? { ...i, cantidad: Math.min(i.cantidad + delta, MAX_CANTIDAD) } : { ...i }))
            .filter((i) => i.cantidad > 0);
    }

    function eliminarDelCarrito(carrito, id) {
        return carrito.filter((i) => i.id !== id).map((i) => ({ ...i }));
    }

    /** Subtotal, domicilio y total, igual que los calcula la API. */
    function calcularTotales(carrito, tipoEntrega = 'Domicilio', costoDomicilio = 5000) {
        const subtotal = carrito.reduce((suma, i) => suma + Number(i.precio) * i.cantidad, 0);
        const domicilio = carrito.length && tipoEntrega === 'Domicilio' ? Number(costoDomicilio) : 0;
        const unidades = carrito.reduce((suma, i) => suma + i.cantidad, 0);
        return { subtotal, domicilio, total: subtotal + domicilio, unidades };
    }

    /** Validación del formulario de cliente (las mismas reglas que la API). */
    function validarCliente({ nombre = '', telefono = '', email = '', direccion = '' }) {
        const errores = {};
        if (nombre.trim().length < 3) errores.nombre = 'Escribe al menos 3 caracteres';
        const tel = telefono.replace(/[\s-]/g, '');
        if (tel && !/^[0-9]{7,15}$/.test(tel)) errores.telefono = 'Solo números, entre 7 y 15 dígitos';
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errores.email = 'Correo no válido';
        if (direccion.length > 200) errores.direccion = 'Máximo 200 caracteres';
        return errores;
    }

    /** Validación del formulario de producto. */
    function validarProducto({ nombre = '', precio = '', categoria_id = '' }) {
        const errores = {};
        if (nombre.trim().length < 3) errores.nombre = 'Escribe al menos 3 caracteres';
        const p = Number(precio);
        if (precio === '' || !Number.isFinite(p) || p <= 0) errores.precio = 'El precio debe ser mayor que 0';
        if (!categoria_id) errores.categoria_id = 'Selecciona una categoría';
        return errores;
    }

    /** Clase CSS del estado: "En preparación" → "estado-en-preparacion" */
    function claseEstado(estado) {
        return 'estado-' + String(estado || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/\s+/g, '-');
    }

    return {
        MAX_CANTIDAD,
        formatearPrecio,
        formatearFecha,
        escaparHTML,
        agregarAlCarrito,
        cambiarCantidad,
        eliminarDelCarrito,
        calcularTotales,
        validarCliente,
        validarProducto,
        claseEstado
    };
});
