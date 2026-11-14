// =====================================================================
//  Máquina de estados del pedido
//  Define qué cambios de estado están permitidos.
// =====================================================================

const ESTADOS = ['Pendiente', 'En preparación', 'Listo', 'En camino', 'Entregado', 'Cancelado'];

const TRANSICIONES = {
    'Pendiente':      ['En preparación', 'Cancelado'],
    'En preparación': ['Listo', 'Cancelado'],
    'Listo':          ['En camino', 'Entregado'],
    'En camino':      ['Entregado'],
    'Entregado':      [],
    'Cancelado':      []
};

/**
 * Siguientes estados posibles según el estado actual y el tipo de entrega.
 * Un pedido para recoger en tienda nunca pasa por "En camino".
 */
function siguientesEstados(estadoActual, tipoEntrega = 'Domicilio') {
    let opciones = TRANSICIONES[estadoActual] || [];
    if (estadoActual === 'Listo') {
        opciones = tipoEntrega === 'Domicilio' ? ['En camino'] : ['Entregado'];
    }
    return opciones;
}

function esTransicionValida(actual, nuevo, tipoEntrega) {
    return siguientesEstados(actual, tipoEntrega).includes(nuevo);
}

module.exports = { ESTADOS, TRANSICIONES, siguientesEstados, esTransicionValida };
