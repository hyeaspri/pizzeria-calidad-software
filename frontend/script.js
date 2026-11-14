// =====================================================================
//  PIZZERÍA · Sistema de pedidos v2.0 — lógica del frontend
// =====================================================================
'use strict';

const {
    formatearPrecio, formatearFecha, escaparHTML: e, agregarAlCarrito: sumarAlCarrito,
    cambiarCantidad: variarCantidad, eliminarDelCarrito: quitarDelCarrito,
    calcularTotales, validarCliente, validarProducto, claseEstado
} = window.PizzeriaUtils;

// Si la página la sirve Express usa la misma URL; si se abre con Live Server o file:// apunta al puerto 3000
const API_URL = location.protocol.startsWith('http') && location.port === '3000'
    ? '/api'
    : 'http://localhost:3000/api';

const ESTADOS = ['Pendiente', 'En preparación', 'Listo', 'En camino', 'Entregado', 'Cancelado'];
const COLORES_ESTADO = {
    'Pendiente': '#f59e0b', 'En preparación': '#3b82f6', 'Listo': '#a855f7',
    'En camino': '#0ea5e9', 'Entregado': '#14b8a6', 'Cancelado': '#ef4444'
};
const ICONO_ACCION = {
    'En preparación': '👨‍🍳', 'Listo': '✅', 'En camino': '🛵', 'Entregado': '📦', 'Cancelado': '✖'
};
const INTERVALO_REFRESCO = 20000;

const estado = {
    productos: [],
    categorias: [],
    clientes: [],
    pedidos: [],
    carrito: [],
    filtroCategoria: 'Todos',
    filtroEstado: 'Todos',
    costoDomicilio: 5000,
    seccion: 'inicio',
    ultimaCarga: null,
    pedidoResaltado: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// =====================================================================
//  COMUNICACIÓN CON LA API
// =====================================================================
async function api(ruta, { method = 'GET', body } = {}) {
    let respuesta;
    try {
        respuesta = await fetch(`${API_URL}${ruta}`, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
    } catch {
        $('#avisoConexion').hidden = false;
        throw new Error('No hay conexión con el servidor');
    }
    $('#avisoConexion').hidden = true;

    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        const error = new Error(datos.message || `Error ${respuesta.status}`);
        error.status = respuesta.status;
        error.errores = datos.errores;
        throw error;
    }
    return datos;
}

// =====================================================================
//  NAVEGACIÓN
// =====================================================================
function mostrarSeccion(nombre) {
    if (!document.getElementById(nombre)) nombre = 'inicio';
    estado.seccion = nombre;

    $$('.seccion').forEach((s) => s.classList.toggle('activa', s.id === nombre));
    $$('.nav-btn').forEach((b) => {
        const activo = b.dataset.seccion === nombre;
        b.classList.toggle('activo', activo);
        b.setAttribute('aria-current', activo ? 'page' : 'false');
    });
    if (location.hash !== `#${nombre}`) history.replaceState(null, '', `#${nombre}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const cargas = {
        inicio: cargarEstadisticas,
        menu: () => (estado.productos.length ? mostrarMenu() : cargarProductos()),
        pedidos: cargarPedidos,
        clientes: cargarClientes,
        productos: cargarProductos
    };
    cargas[nombre]?.();
}

// =====================================================================
//  INICIO: ESTADÍSTICAS
// =====================================================================
async function cargarEstadisticas() {
    try {
        const { data } = await api('/estadisticas');
        const kpis = [
            ['💰', 'Ventas totales', formatearPrecio(data.ventas_totales), 'Sin pedidos cancelados'],
            ['📅', 'Ventas de hoy', formatearPrecio(data.ventas_hoy), `${data.pedidos_hoy} pedido(s) hoy`],
            ['🧾', 'Ticket promedio', formatearPrecio(data.ticket_promedio), `${data.pedidos} pedidos en total`],
            ['👥', 'Clientes', data.clientes, `${data.productos_disponibles} de ${data.productos} productos disponibles`]
        ];
        $('#kpis').innerHTML = kpis.map(([icono, label, valor, nota]) => `
            <div class="kpi">
                <span class="kpi-label"><span aria-hidden="true">${icono}</span>${e(label)}</span>
                <div class="kpi-valor">${e(valor)}</div>
                <span class="kpi-nota">${e(nota)}</span>
            </div>`).join('');

        const conteo = data.pedidos_por_estado;
        const maximo = Math.max(1, ...Object.values(conteo));
        $('#graficoEstados').innerHTML = ESTADOS.map((est) => `
            <div class="barra">
                <span>${e(est)}</span>
                <div class="barra-pista" role="img" aria-label="${e(est)}: ${conteo[est]} pedidos">
                    <div class="barra-relleno" style="width:${(conteo[est] / maximo) * 100}%;background:${COLORES_ESTADO[est]}"></div>
                </div>
                <strong>${conteo[est]}</strong>
            </div>`).join('');

        $('#masVendidos').innerHTML = data.mas_vendidos.length
            ? data.mas_vendidos.map((p) => `
                <li>
                    <span>${e(p.nombre)}<small>${e(p.categoria)}</small></span>
                    <span class="num"><strong>${p.unidades_vendidas} und.</strong><small>${formatearPrecio(p.ingresos)}</small></span>
                </li>`).join('')
            : '<li class="secundario">Aún no hay ventas registradas</li>';
    } catch (error) {
        $('#kpis').innerHTML = `<p class="secundario">No se pudieron cargar las estadísticas: ${e(error.message)}</p>`;
    }
}

// =====================================================================
//  MENÚ Y PRODUCTOS
// =====================================================================
async function cargarCategorias() {
    const { data } = await api('/categorias');
    estado.categorias = data;
    $('#filtrosCategoria').innerHTML = [
        `<button class="filtro activo" data-categoria="Todos">Todos</button>`,
        ...data.map((c) => `<button class="filtro" data-categoria="${e(c.nombre)}">${e(c.icono)} ${e(c.nombre)}</button>`)
    ].join('');
    $('#productoCategoria').innerHTML = '<option value="">Selecciona…</option>' +
        data.map((c) => `<option value="${c.id}">${e(c.icono)} ${e(c.nombre)}</option>`).join('');
}

async function cargarProductos() {
    try {
        if (!estado.categorias.length) await cargarCategorias();
        const { data } = await api('/productos');
        estado.productos = data;
        mostrarMenu();
        mostrarTablaProductos();
    } catch (error) {
        $('#productosContainer').innerHTML = `<p class="secundario">No se pudieron cargar los productos: ${e(error.message)}</p>`;
    }
}

function mostrarMenu() {
    const texto = $('#buscarProducto').value.trim().toLowerCase();
    const lista = estado.productos.filter((p) =>
        (estado.filtroCategoria === 'Todos' || p.categoria === estado.filtroCategoria) &&
        (!texto || `${p.nombre} ${p.descripcion || ''}`.toLowerCase().includes(texto)));

    if (!lista.length) {
        $('#productosContainer').innerHTML = '<p class="secundario">No hay productos que coincidan con la búsqueda.</p>';
        return;
    }

    $('#productosContainer').innerHTML = lista.map((p) => `
        <article class="tarjeta-producto ${p.disponible ? '' : 'agotado'}">
            <div class="tarjeta-imagen" aria-hidden="true">
                <span class="chip ${p.disponible ? '' : 'no-disponible'}">${p.disponible ? e(p.categoria) : 'No disponible'}</span>
                ${e(p.icono)}
            </div>
            <div class="tarjeta-cuerpo">
                <h3>${e(p.nombre)}</h3>
                <p>${e(p.descripcion || '')}</p>
                <div class="tarjeta-pie">
                    <span class="precio">${formatearPrecio(p.precio)}</span>
                    <button class="btn btn-primario btn-chico" data-agregar="${p.id}" ${p.disponible ? '' : 'disabled'}
                            aria-label="Agregar ${e(p.nombre)} al carrito">+ Agregar</button>
                </div>
            </div>
        </article>`).join('');
}

function mostrarTablaProductos() {
    if (!estado.productos.length) {
        $('#productosTable').innerHTML = '<tr><td colspan="5" class="vacio">No hay productos registrados</td></tr>';
        return;
    }
    $('#productosTable').innerHTML = estado.productos.map((p) => `
        <tr>
            <td><strong>${e(p.icono)} ${e(p.nombre)}</strong><span class="secundario">${e(p.descripcion || '')}</span></td>
            <td>${e(p.categoria)}</td>
            <td class="num">${formatearPrecio(p.precio)}</td>
            <td>
                <label class="switch" title="${p.disponible ? 'Disponible' : 'No disponible'}">
                    <input type="checkbox" data-disponible="${p.id}" ${p.disponible ? 'checked' : ''}
                           aria-label="Disponibilidad de ${e(p.nombre)}">
                    <span></span>
                </label>
            </td>
            <td><div class="celda-acciones">
                <button class="icon-btn" data-editar-producto="${p.id}" aria-label="Editar ${e(p.nombre)}" title="Editar">✏️</button>
                <button class="icon-btn peligro" data-eliminar-producto="${p.id}" aria-label="Eliminar ${e(p.nombre)}" title="Eliminar">🗑️</button>
            </div></td>
        </tr>`).join('');
}

function abrirModalProducto(producto = null) {
    const form = $('#formProducto');
    form.reset();
    limpiarErrores(form);
    $('#titulo-producto').textContent = producto ? 'Editar producto' : 'Nuevo producto';
    $('#productoId').value = producto?.id || '';
    $('#productoNombre').value = producto?.nombre || '';
    $('#productoDescripcion').value = producto?.descripcion || '';
    $('#productoPrecio').value = producto?.precio || '';
    $('#productoCategoria').value = producto?.categoria_id || '';
    $('#productoDisponible').checked = producto ? producto.disponible : true;
    $('#modalProducto').showModal();
    $('#productoNombre').focus();
}

async function guardarProducto(evento) {
    evento.preventDefault();
    const form = evento.target;
    const datos = {
        nombre: $('#productoNombre').value,
        descripcion: $('#productoDescripcion').value,
        precio: $('#productoPrecio').value,
        categoria_id: $('#productoCategoria').value
    };
    const errores = validarProducto(datos);
    if (mostrarErrores(form, errores)) return;

    const id = $('#productoId').value;
    const cuerpo = {
        ...datos,
        precio: Number(datos.precio),
        categoria_id: Number(datos.categoria_id),
        disponible: $('#productoDisponible').checked
    };
    await enviarFormulario(form, async () => {
        const r = await api(id ? `/productos/${id}` : '/productos', { method: id ? 'PUT' : 'POST', body: cuerpo });
        $('#modalProducto').close();
        notificar(r.message);
        await cargarProductos();
    });
}

async function cambiarDisponibilidad(id, disponible, checkbox) {
    try {
        await api(`/productos/${id}`, { method: 'PUT', body: { disponible } });
        const p = estado.productos.find((x) => x.id === id);
        if (p) p.disponible = disponible;
        mostrarMenu();
        notificar(`Producto marcado como ${disponible ? 'disponible' : 'no disponible'}`);
    } catch (error) {
        checkbox.checked = !disponible;
        notificar(error.message, 'error');
    }
}

async function eliminarProducto(id) {
    const p = estado.productos.find((x) => x.id === id);
    if (!await confirmar(`Se eliminará "${p?.nombre}". Esta acción no se puede deshacer.`, 'Eliminar')) return;
    try {
        const r = await api(`/productos/${id}`, { method: 'DELETE' });
        notificar(r.message);
        await cargarProductos();
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// =====================================================================
//  CARRITO
// =====================================================================
function guardarCarrito() {
    try { localStorage.setItem('pizzeria-carrito', JSON.stringify(estado.carrito)); } catch { /* sin almacenamiento */ }
}

function restaurarCarrito() {
    try {
        const guardado = JSON.parse(localStorage.getItem('pizzeria-carrito') || '[]');
        if (Array.isArray(guardado)) estado.carrito = guardado.filter((i) => i && i.id && i.cantidad > 0);
    } catch { estado.carrito = []; }
}

function agregarAlCarrito(productoId) {
    const producto = estado.productos.find((p) => p.id === productoId);
    if (!producto || !producto.disponible) return;
    estado.carrito = sumarAlCarrito(estado.carrito, producto);
    actualizarCarrito();
    notificar(`${producto.nombre} agregado al carrito`);
    const contador = $('#contadorCarrito');
    contador.classList.remove('pulso');
    void contador.offsetWidth;
    contador.classList.add('pulso');
}

function actualizarCarrito() {
    guardarCarrito();
    const { subtotal, unidades } = calcularTotales(estado.carrito, 'Recoger en tienda');
    $('#contadorCarrito').textContent = unidades;
    $('#subtotalCarrito').textContent = formatearPrecio(subtotal);
    $('#btnContinuar').disabled = estado.carrito.length === 0;
    $('#btnVaciar').hidden = estado.carrito.length === 0;

    $('#carritoContainer').innerHTML = estado.carrito.length
        ? estado.carrito.map((i) => `
            <div class="carrito-item">
                <span class="icono" aria-hidden="true">${e(i.icono || '🍕')}</span>
                <div>
                    <h4>${e(i.nombre)}</h4>
                    <small>${formatearPrecio(i.precio)} c/u</small>
                    <div class="cantidad">
                        <button data-cantidad="${i.id}" data-delta="-1" aria-label="Quitar una unidad de ${e(i.nombre)}">−</button>
                        <span aria-label="Cantidad">${i.cantidad}</span>
                        <button data-cantidad="${i.id}" data-delta="1" aria-label="Agregar una unidad de ${e(i.nombre)}">+</button>
                    </div>
                </div>
                <div class="derecha">
                    <strong>${formatearPrecio(i.precio * i.cantidad)}</strong>
                    <button class="link-btn" data-quitar="${i.id}">Quitar</button>
                </div>
            </div>`).join('')
        : `<div class="carrito-vacio"><span aria-hidden="true">🛒</span>
             <p>Tu carrito está vacío</p>
             <button class="btn btn-secundario" data-seccion="menu" data-cerrar>Ver el menú</button></div>`;
}

// =====================================================================
//  CONFIRMAR PEDIDO
// =====================================================================
async function abrirFormularioPedido() {
    if (!estado.carrito.length) return notificar('Agrega productos al carrito primero', 'info');
    $('#modalCarrito').close();
    const form = $('#formPedido');
    limpiarErrores(form);
    if (!estado.clientes.length) await cargarClientes();
    llenarSelectClientes();
    actualizarResumenPedido();
    $('#modalPedido').showModal();
}

function llenarSelectClientes(seleccionado = '') {
    $('#selectCliente').innerHTML = '<option value="">Selecciona un cliente</option>' +
        estado.clientes.map((c) =>
            `<option value="${c.id}">${e(c.nombre)}${c.telefono ? ' · ' + e(c.telefono) : ''}</option>`).join('');
    $('#selectCliente').value = seleccionado;
    if (seleccionado) limpiarErrorCampo($('#selectCliente'));
    autocompletarDireccionYLimpiar();
}

function autocompletarDireccionYLimpiar() {
    autocompletarDireccion();
    if ($('#direccionEntrega').value) limpiarErrorCampo($('#direccionEntrega'));
}

function tipoEntregaActual() {
    return $('input[name="tipo_entrega"]:checked').value;
}

function autocompletarDireccion() {
    const cliente = estado.clientes.find((c) => c.id === Number($('#selectCliente').value));
    $('#direccionEntrega').value = cliente?.direccion || '';
}

function actualizarResumenPedido() {
    const tipo = tipoEntregaActual();
    $('#grupoDireccion').hidden = tipo !== 'Domicilio';
    const t = calcularTotales(estado.carrito, tipo, estado.costoDomicilio);
    $('#resumenProductos').innerHTML = estado.carrito.map((i) => `
        <div class="resumen-linea"><span>${i.cantidad} × ${e(i.nombre)}</span><span>${formatearPrecio(i.precio * i.cantidad)}</span></div>`).join('');
    $('#resumenSubtotal').textContent = formatearPrecio(t.subtotal);
    $('#resumenDomicilio').textContent = t.domicilio ? formatearPrecio(t.domicilio) : 'Gratis';
    $('#resumenTotal').textContent = formatearPrecio(t.total);
}

async function confirmarPedido(evento) {
    evento.preventDefault();
    const form = evento.target;
    const tipo = tipoEntregaActual();
    const errores = {};
    if (!$('#selectCliente').value) errores.cliente = 'Selecciona el cliente del pedido';
    if (tipo === 'Domicilio' && !$('#direccionEntrega').value.trim()) errores.direccion = 'Escribe la dirección de entrega';
    if (mostrarErrores(form, errores, { cliente: '#selectCliente', direccion: '#direccionEntrega' })) return;

    await enviarFormulario(form, async () => {
        const r = await api('/pedidos', {
            method: 'POST',
            body: {
                cliente_id: Number($('#selectCliente').value),
                tipo_entrega: tipo,
                metodo_pago: $('#metodoPago').value,
                direccion_entrega: $('#direccionEntrega').value.trim(),
                observaciones: $('#observaciones').value.trim(),
                productos: estado.carrito.map((i) => ({ producto_id: i.id, cantidad: i.cantidad }))
            }
        });
        estado.carrito = [];
        actualizarCarrito();
        form.reset();
        $('#modalPedido').close();
        notificar(`Pedido #${r.pedido_id} creado por ${formatearPrecio(r.total)} 🍕`);
        estado.pedidoResaltado = r.pedido_id;
        estado.filtroEstado = 'Todos';
        mostrarSeccion('pedidos');
    });
}

// =====================================================================
//  CLIENTES
// =====================================================================
async function cargarClientes() {
    try {
        const { data } = await api('/clientes');
        estado.clientes = data;
        mostrarClientes();
    } catch (error) {
        $('#clientesTable').innerHTML = `<tr><td colspan="7" class="vacio">No se pudieron cargar los clientes: ${e(error.message)}</td></tr>`;
    }
}

function mostrarClientes() {
    const texto = $('#buscarCliente').value.trim().toLowerCase();
    const lista = estado.clientes.filter((c) =>
        !texto || `${c.nombre} ${c.telefono || ''} ${c.email || ''}`.toLowerCase().includes(texto));

    $('#clientesTable').innerHTML = lista.length
        ? lista.map((c) => `
            <tr>
                <td><strong>${e(c.nombre)}</strong><span class="secundario">Desde ${e(formatearFecha(c.fecha_registro))}</span></td>
                <td>${e(c.telefono || '—')}</td>
                <td>${e(c.email || '—')}</td>
                <td>${e(c.direccion || '—')}</td>
                <td class="num">${c.total_pedidos}</td>
                <td class="num">${formatearPrecio(c.total_gastado)}</td>
                <td><div class="celda-acciones">
                    <button class="icon-btn" data-pedidos-cliente="${c.id}" aria-label="Ver pedidos de ${e(c.nombre)}" title="Ver pedidos">📦</button>
                    <button class="icon-btn" data-editar-cliente="${c.id}" aria-label="Editar ${e(c.nombre)}" title="Editar">✏️</button>
                    <button class="icon-btn peligro" data-eliminar-cliente="${c.id}" aria-label="Eliminar ${e(c.nombre)}" title="Eliminar">🗑️</button>
                </div></td>
            </tr>`).join('')
        : '<tr><td colspan="7" class="vacio">No hay clientes que coincidan</td></tr>';
}

let origenCliente = null; // 'pedido' cuando se crea desde la confirmación del pedido

function abrirModalCliente(cliente = null, origen = null) {
    origenCliente = origen;
    const form = $('#formCliente');
    form.reset();
    limpiarErrores(form);
    $('#titulo-cliente').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente';
    $('#clienteId').value = cliente?.id || '';
    $('#clienteNombre').value = cliente?.nombre || '';
    $('#clienteTelefono').value = cliente?.telefono || '';
    $('#clienteEmail').value = cliente?.email || '';
    $('#clienteDireccion').value = cliente?.direccion || '';
    $('#modalCliente').showModal();
    $('#clienteNombre').focus();
}

async function guardarCliente(evento) {
    evento.preventDefault();
    const form = evento.target;
    const datos = {
        nombre: $('#clienteNombre').value,
        telefono: $('#clienteTelefono').value,
        email: $('#clienteEmail').value,
        direccion: $('#clienteDireccion').value
    };
    if (mostrarErrores(form, validarCliente(datos))) return;

    const id = $('#clienteId').value;
    await enviarFormulario(form, async () => {
        const r = await api(id ? `/clientes/${id}` : '/clientes', { method: id ? 'PUT' : 'POST', body: datos });
        $('#modalCliente').close();
        notificar(r.message);
        await cargarClientes();
        if (origenCliente === 'pedido') llenarSelectClientes(String(r.data.id));
    });
}

async function eliminarCliente(id) {
    const c = estado.clientes.find((x) => x.id === id);
    if (!await confirmar(`Se eliminará a "${c?.nombre}". Esta acción no se puede deshacer.`, 'Eliminar')) return;
    try {
        const r = await api(`/clientes/${id}`, { method: 'DELETE' });
        notificar(r.message);
        await cargarClientes();
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// =====================================================================
//  PEDIDOS
// =====================================================================
async function cargarPedidos({ silencioso = false } = {}) {
    try {
        const { data } = await api('/pedidos');
        estado.pedidos = data;
        estado.ultimaCarga = new Date();
        mostrarFiltrosEstado();
        mostrarPedidos();
        actualizarMarcaTiempo();
    } catch (error) {
        if (!silencioso) {
            $('#pedidosTable').innerHTML = `<tr><td colspan="7" class="vacio">No se pudieron cargar los pedidos: ${e(error.message)}</td></tr>`;
        }
    }
}

function mostrarFiltrosEstado() {
    const conteo = Object.fromEntries(ESTADOS.map((s) => [s, 0]));
    estado.pedidos.forEach((p) => { conteo[p.estado] += 1; });
    $('#filtrosEstado').innerHTML = ['Todos', ...ESTADOS].map((s) => `
        <button class="filtro ${estado.filtroEstado === s ? 'activo' : ''}" data-estado="${e(s)}" aria-pressed="${estado.filtroEstado === s}">
            ${e(s)} <span class="num-filtro">${s === 'Todos' ? estado.pedidos.length : conteo[s]}</span>
        </button>`).join('');
}

function mostrarPedidos() {
    const texto = $('#buscarPedido').value.trim().toLowerCase().replace(/^#/, '');
    const lista = estado.pedidos.filter((p) =>
        (estado.filtroEstado === 'Todos' || p.estado === estado.filtroEstado) &&
        (!texto || String(p.id) === texto || p.cliente.toLowerCase().includes(texto)));

    $('#pedidosTable').innerHTML = lista.length
        ? lista.map((p) => `
            <tr class="${estado.pedidoResaltado === p.id ? 'fila-nueva' : ''}">
                <td><strong>#${p.id}</strong></td>
                <td><strong>${e(p.cliente)}</strong><span class="secundario">${e(p.telefono || '')}</span></td>
                <td>${e(formatearFecha(p.fecha))}</td>
                <td>${p.tipo_entrega === 'Domicilio' ? '🛵' : '🏪'} ${e(p.tipo_entrega)}<span class="secundario">${p.unidades} und. · ${e(p.metodo_pago)}</span></td>
                <td><span class="estado ${claseEstado(p.estado)}">${e(p.estado)}</span></td>
                <td class="num"><strong>${formatearPrecio(p.total)}</strong></td>
                <td><div class="celda-acciones">
                    <button class="btn btn-secundario btn-chico" data-ver-pedido="${p.id}">Ver detalle</button>
                </div></td>
            </tr>`).join('')
        : '<tr><td colspan="7" class="vacio">No hay pedidos con este filtro</td></tr>';
    estado.pedidoResaltado = null;
}

function actualizarMarcaTiempo() {
    if (!estado.ultimaCarga) return;
    const segundos = Math.round((Date.now() - estado.ultimaCarga) / 1000);
    $('#ultimaActualizacion').textContent =
        `🟢 Se actualiza automáticamente · última actualización hace ${segundos < 5 ? 'un momento' : segundos + ' s'}`;
}

async function verDetallePedido(id) {
    const modal = $('#modalDetalle');
    $('#detallePedidoContainer').innerHTML = '<p class="secundario">Cargando…</p>';
    if (!modal.open) modal.showModal();
    try {
        const { data } = await api(`/pedidos/${id}`);
        pintarDetalle(data);
    } catch (error) {
        $('#detallePedidoContainer').innerHTML = `<p class="secundario">${e(error.message)}</p>`;
    }
}

function pintarDetalle({ pedido: p, detalles, historial }) {
    $('#titulo-detalle').textContent = `Pedido #${p.id}`;
    const acciones = p.siguientes_estados.length
        ? `<div class="acciones-estado">
               <p>Cambiar estado:</p>
               ${p.siguientes_estados.map((s) => `
                   <button class="btn ${s === 'Cancelado' ? 'btn-peligro' : 'btn-primario'} btn-chico"
                           data-cambiar-estado="${e(s)}" data-pedido="${p.id}">${ICONO_ACCION[s] || ''} ${e(s)}</button>`).join('')}
           </div>`
        : `<div class="acciones-estado"><p>Este pedido está <strong>${e(p.estado)}</strong> y no admite más cambios.</p></div>`;

    $('#detallePedidoContainer').innerHTML = `
        <div class="detalle-grid">
            <div class="dato"><small>Estado</small><span class="estado ${claseEstado(p.estado)}">${e(p.estado)}</span></div>
            <div class="dato"><small>Cliente</small><strong>${e(p.cliente)}</strong></div>
            <div class="dato"><small>Teléfono</small><strong>${e(p.telefono || '—')}</strong></div>
            <div class="dato"><small>Fecha</small><strong>${e(formatearFecha(p.fecha))}</strong></div>
            <div class="dato"><small>Entrega</small><strong>${e(p.tipo_entrega)}</strong></div>
            <div class="dato"><small>Pago</small><strong>${e(p.metodo_pago)}</strong></div>
            ${p.direccion_entrega ? `<div class="dato ancho-completo"><small>Dirección de entrega</small><strong>${e(p.direccion_entrega)}</strong></div>` : ''}
            ${p.observaciones ? `<div class="dato ancho-completo"><small>Observaciones</small><strong>${e(p.observaciones)}</strong></div>` : ''}
        </div>
        <div class="detalle-columnas">
            <div>
                <h3>Productos</h3>
                <div class="tabla-contenedor">
                    <table>
                        <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
                        <tbody>${detalles.map((d) => `
                            <tr><td>${e(d.producto)}</td><td class="num">${d.cantidad}</td>
                                <td class="num">${formatearPrecio(d.precio)}</td><td class="num">${formatearPrecio(d.subtotal)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="resumen-pedido">
                    <div class="fila-total"><span>Subtotal</span><span>${formatearPrecio(p.subtotal)}</span></div>
                    <div class="fila-total"><span>Domicilio</span><span>${p.costo_domicilio ? formatearPrecio(p.costo_domicilio) : 'Gratis'}</span></div>
                    <div class="fila-total grande"><span>Total</span><strong>${formatearPrecio(p.total)}</strong></div>
                </div>
            </div>
            <div>
                <h3>Historial</h3>
                <ol class="linea-tiempo">
                    ${historial.map((h) => `
                        <li><strong>${e(h.estado_nuevo)}</strong>
                            <small>${e(formatearFecha(h.fecha))}${h.observacion ? ' · ' + e(h.observacion) : ''}</small></li>`).join('')}
                </ol>
            </div>
        </div>
        ${acciones}`;
}

async function cambiarEstadoPedido(id, nuevoEstado, boton) {
    let observacion;
    if (nuevoEstado === 'Cancelado') {
        if (!await confirmar(`El pedido #${id} se cancelará y no podrá reactivarse.`, 'Cancelar pedido')) return;
        observacion = 'Cancelado desde el sistema';
    }
    boton.disabled = true;
    try {
        const r = await api(`/pedidos/${id}/estado`, { method: 'PUT', body: { estado: nuevoEstado, observacion } });
        pintarDetalle(r.data);
        notificar(`Pedido #${id}: ${r.estado_anterior} → ${r.nuevo_estado}`);
        cargarPedidos({ silencioso: true });
    } catch (error) {
        notificar(error.message, 'error');
        boton.disabled = false;
    }
}

// =====================================================================
//  UTILIDADES DE INTERFAZ
// =====================================================================
function notificar(mensaje, tipo = 'exito') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    toast.textContent = `${tipo === 'error' ? '⚠️' : tipo === 'info' ? 'ℹ️' : '✅'} ${mensaje}`;
    $('#toasts').appendChild(toast);
    setTimeout(() => {
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 300);
    }, tipo === 'error' ? 5000 : 3000);
}

function confirmar(texto, textoBoton = 'Sí, continuar') {
    const modal = $('#modalConfirmar');
    $('#textoConfirmacion').textContent = texto;
    $('#btnConfirmarAccion').textContent = textoBoton;
    modal.showModal();
    return new Promise((resolver) => {
        const responder = (ev) => {
            const r = ev.target.closest('[data-respuesta]');
            if (!r) return;
            modal.removeEventListener('click', responder);
            modal.close();
            resolver(r.dataset.respuesta === 'si');
        };
        modal.addEventListener('click', responder);
        modal.addEventListener('cancel', () => {
            modal.removeEventListener('click', responder);
            resolver(false);
        }, { once: true });
    });
}

function limpiarErrores(form) {
    form.querySelectorAll('.error').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.invalido').forEach((el) => {
        el.classList.remove('invalido');
        el.removeAttribute('aria-invalid');
    });
}

/** Pinta los errores bajo cada campo. Devuelve true si hubo errores. */
function mostrarErrores(form, errores, campos = {}) {
    limpiarErrores(form);
    const claves = Object.keys(errores);
    claves.forEach((clave) => {
        const msg = form.querySelector(`[data-error="${clave}"]`);
        if (msg) msg.textContent = errores[clave];
        const input = campos[clave] ? form.querySelector(campos[clave]) : msg?.parentElement.querySelector('input, select, textarea');
        if (input) {
            input.classList.add('invalido');
            input.setAttribute('aria-invalid', 'true');
        }
    });
    if (claves.length) {
        const primero = form.querySelector('.invalido');
        primero?.focus();
    }
    return claves.length > 0;
}

/** Deshabilita el botón mientras se envía y muestra el error del servidor. */
async function enviarFormulario(form, accion) {
    const boton = form.querySelector('[type="submit"]');
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
        await accion();
    } catch (error) {
        notificar(error.message, 'error');
    } finally {
        boton.disabled = false;
        boton.textContent = texto;
    }
}

const conRetraso = (fn, ms = 200) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// =====================================================================
//  EVENTOS (delegación: un solo listener para toda la página)
// =====================================================================
document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, [data-seccion]');
    if (!el) return;
    const d = el.dataset;

    if (d.cerrar !== undefined) el.closest('dialog')?.close();
    if (d.seccion) { ev.preventDefault(); mostrarSeccion(d.seccion); }
    if (d.agregar) agregarAlCarrito(Number(d.agregar));
    if (d.categoria) {
        estado.filtroCategoria = d.categoria;
        $$('#filtrosCategoria .filtro').forEach((b) => b.classList.toggle('activo', b === el));
        mostrarMenu();
    }
    if (d.estado) { estado.filtroEstado = d.estado; mostrarFiltrosEstado(); mostrarPedidos(); }
    if (d.cantidad) { estado.carrito = variarCantidad(estado.carrito, Number(d.cantidad), Number(d.delta)); actualizarCarrito(); }
    if (d.quitar) { estado.carrito = quitarDelCarrito(estado.carrito, Number(d.quitar)); actualizarCarrito(); }
    if (d.verPedido) verDetallePedido(Number(d.verPedido));
    if (d.cambiarEstado) cambiarEstadoPedido(Number(d.pedido), d.cambiarEstado, el);
    if (d.editarCliente) abrirModalCliente(estado.clientes.find((c) => c.id === Number(d.editarCliente)));
    if (d.eliminarCliente) eliminarCliente(Number(d.eliminarCliente));
    if (d.pedidosCliente) {
        const c = estado.clientes.find((x) => x.id === Number(d.pedidosCliente));
        $('#buscarPedido').value = c?.nombre || '';
        estado.filtroEstado = 'Todos';
        mostrarSeccion('pedidos');
    }
    if (d.editarProducto) abrirModalProducto(estado.productos.find((p) => p.id === Number(d.editarProducto)));
    if (d.eliminarProducto) eliminarProducto(Number(d.eliminarProducto));
});

// Al corregir un campo marcado como inválido se borra su mensaje de error
function limpiarErrorCampo(campo) {
    if (!campo.classList?.contains('invalido')) return;
    campo.classList.remove('invalido');
    campo.removeAttribute('aria-invalid');
    const msg = campo.closest('.form-group')?.querySelector('.error');
    if (msg) msg.textContent = '';
}
document.addEventListener('input', (ev) => limpiarErrorCampo(ev.target));

document.addEventListener('change', (ev) => {
    limpiarErrorCampo(ev.target);
    if (ev.target.dataset.disponible) {
        cambiarDisponibilidad(Number(ev.target.dataset.disponible), ev.target.checked, ev.target);
    }
});

// Cerrar un diálogo al hacer clic en el fondo
$$('dialog').forEach((dlg) => dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg && dlg.id !== 'modalConfirmar') dlg.close();
}));

$('#btnCarrito').addEventListener('click', () => { actualizarCarrito(); $('#modalCarrito').showModal(); });
$('#btnContinuar').addEventListener('click', abrirFormularioPedido);
$('#btnVaciar').addEventListener('click', async () => {
    if (await confirmar('Se quitarán todos los productos del carrito.', 'Vaciar')) {
        estado.carrito = [];
        actualizarCarrito();
    }
});
$('#btnNuevoCliente').addEventListener('click', () => abrirModalCliente());
$('#btnClienteRapido').addEventListener('click', () => abrirModalCliente(null, 'pedido'));
$('#btnNuevoProducto').addEventListener('click', async () => {
    if (!estado.categorias.length) await cargarCategorias();
    abrirModalProducto();
});
$('#btnReintentar').addEventListener('click', () => mostrarSeccion(estado.seccion));

$('#formCliente').addEventListener('submit', guardarCliente);
$('#formProducto').addEventListener('submit', guardarProducto);
$('#formPedido').addEventListener('submit', confirmarPedido);
$('#selectCliente').addEventListener('change', autocompletarDireccionYLimpiar);
$$('input[name="tipo_entrega"]').forEach((r) => r.addEventListener('change', actualizarResumenPedido));

$('#buscarProducto').addEventListener('input', conRetraso(mostrarMenu));
$('#buscarCliente').addEventListener('input', conRetraso(mostrarClientes));
$('#buscarPedido').addEventListener('input', conRetraso(mostrarPedidos));

window.addEventListener('hashchange', () => mostrarSeccion(location.hash.slice(1)));

// =====================================================================
//  INICIO DE LA APLICACIÓN
// =====================================================================
async function iniciar() {
    restaurarCarrito();
    actualizarCarrito();
    try {
        const info = await api('');
        estado.costoDomicilio = info.configuracion?.costo_domicilio ?? estado.costoDomicilio;
    } catch { /* el aviso de conexión ya se muestra */ }
    cargarProductos();
    mostrarSeccion(location.hash.slice(1) || 'inicio');

    // Seguimiento en tiempo real: refresca pedidos y estadísticas cada 20 s
    setInterval(() => {
        if (document.hidden) return;
        if (estado.seccion === 'pedidos') cargarPedidos({ silencioso: true });
        if (estado.seccion === 'inicio') cargarEstadisticas();
    }, INTERVALO_REFRESCO);
    setInterval(actualizarMarcaTiempo, 5000);
}

iniciar();
