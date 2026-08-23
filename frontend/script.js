// ========================================
// CONFIGURACIÓN
// ========================================

const API_URL = "http://localhost:3000/api";


// ========================================
// VARIABLES
// ========================================

let productos = [];
let clientes = [];
let pedidos = [];
let carrito = [];


// ========================================
// INICIO
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    cargarProductos();
    cargarClientes();
    cargarPedidos();

});


// ========================================
// NAVEGACIÓN
// ========================================

function mostrarSeccion(nombre) {

    document.querySelectorAll(".seccion")
        .forEach(seccion => {
            seccion.classList.remove("activa");
        });

    const seccion = document.getElementById(nombre);

    if (seccion) {
        seccion.classList.add("activa");
    }


    document.querySelectorAll(".nav-btn")
        .forEach(btn => {
            btn.classList.remove("active");
        });


    const botones = document.querySelectorAll(".nav-btn");

    botones.forEach(btn => {

        if (
            btn.textContent
                .trim()
                .toLowerCase()
                .includes(nombre.toLowerCase())
        ) {
            btn.classList.add("active");
        }

    });


    if (nombre === "clientes") {
        cargarClientes();
    }

    if (nombre === "pedidos") {
        cargarPedidos();
    }

}


// ========================================
// PRODUCTOS
// ========================================

async function cargarProductos() {

    const container =
        document.getElementById("productosContainer");

    try {

        const respuesta =
            await fetch(`${API_URL}/productos`);

        const resultado =
            await respuesta.json();


        if (resultado.status !== "Success") {
            throw new Error(resultado.message);
        }


        productos = resultado.data;


        document.getElementById("totalProductos")
            .textContent = productos.length;


        mostrarProductos(productos);

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="loading">
                ❌ No se pudieron cargar los productos.
                <br><br>
                Verifica que el backend esté ejecutándose.
            </div>
        `;

    }

}


// ========================================
// MOSTRAR PRODUCTOS
// ========================================

function mostrarProductos(lista) {

    const container =
        document.getElementById("productosContainer");


    if (!lista || lista.length === 0) {

        container.innerHTML = `
            <div class="loading">
                No hay productos disponibles.
            </div>
        `;

        return;
    }


    container.innerHTML = "";


    lista.forEach(producto => {

        const icono =
            producto.categoria === "Pizza"
                ? "🍕"
                : "🥤";


        const card =
            document.createElement("div");

        card.className = "producto-card";


        card.innerHTML = `

            <div class="producto-imagen">
                ${icono}
            </div>

            <div class="producto-info">

                <h3>
                    ${producto.nombre}
                </h3>

                <p>
                    ${producto.descripcion || "Producto de la pizzería"}
                </p>

                <span class="categoria">
                    ${producto.categoria || "Producto"}
                </span>

                <div class="producto-bottom">

                    <span class="precio">
                        ${formatearPrecio(producto.precio)}
                    </span>

                    <button
                        class="btn-agregar"
                        onclick="agregarAlCarrito(${producto.id})">

                        + Agregar

                    </button>

                </div>

            </div>
        `;


        container.appendChild(card);

    });

}


// ========================================
// FILTRAR PRODUCTOS
// ========================================

function filtrarProductos(categoria, boton) {

    document.querySelectorAll(".filtro")
        .forEach(btn => {
            btn.classList.remove("active");
        });


    boton.classList.add("active");


    if (categoria === "Todos") {

        mostrarProductos(productos);

    } else {

        const filtrados =
            productos.filter(
                producto =>
                    producto.categoria === categoria
            );

        mostrarProductos(filtrados);

    }

}


// ========================================
// CARRITO
// ========================================

function agregarAlCarrito(productoId) {

    const producto =
        productos.find(
            p => p.id === productoId
        );


    if (!producto) {

        mostrarNotificacion(
            "Producto no encontrado",
            true
        );

        return;
    }


    const existente =
        carrito.find(
            item => item.producto_id === productoId
        );


    if (existente) {

        existente.cantidad++;

    } else {

        carrito.push({

            producto_id: producto.id,
            nombre: producto.nombre,
            precio: Number(producto.precio),
            cantidad: 1,
            categoria: producto.categoria

        });

    }


    actualizarCarrito();

    mostrarNotificacion(
        `${producto.nombre} agregado al carrito`
    );

}


// ========================================
// ACTUALIZAR CARRITO
// ========================================

function actualizarCarrito() {

    const contador =
        carrito.reduce(
            (total, item) =>
                total + item.cantidad,
            0
        );


    document.getElementById(
        "contadorCarrito"
    ).textContent = contador;


    mostrarCarrito();

}


// ========================================
// MOSTRAR CARRITO
// ========================================

function mostrarCarrito() {

    const container =
        document.getElementById(
            "carritoContainer"
        );


    const total =
        calcularTotal();


    document.getElementById(
        "totalCarrito"
    ).textContent =
        formatearPrecio(total);


    if (carrito.length === 0) {

        container.innerHTML = `

            <div class="carrito-vacio">

                <span>🛒</span>

                <p>
                    Tu carrito está vacío
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML = "";


    carrito.forEach((item, index) => {

        const icono =
            item.categoria === "Pizza"
                ? "🍕"
                : "🥤";


        const elemento =
            document.createElement("div");

        elemento.className =
            "carrito-item";


        elemento.innerHTML = `

            <div class="carrito-icono">
                ${icono}
            </div>


            <div class="carrito-info">

                <h4>
                    ${item.nombre}
                </h4>

                <small>
                    ${formatearPrecio(item.precio)}
                </small>

            </div>


            <div class="cantidad">

                <button
                    class="btn-cantidad"
                    onclick="cambiarCantidad(${index}, -1)">
                    -
                </button>

                <strong>
                    ${item.cantidad}
                </strong>

                <button
                    class="btn-cantidad"
                    onclick="cambiarCantidad(${index}, 1)">
                    +
                </button>

            </div>


            <strong>
                ${formatearPrecio(
                    item.precio * item.cantidad
                )}
            </strong>


            <button
                class="btn-eliminar"
                onclick="eliminarDelCarrito(${index})">

                🗑️

            </button>

        `;


        container.appendChild(elemento);

    });

}


// ========================================
// CAMBIAR CANTIDAD
// ========================================

function cambiarCantidad(index, cambio) {

    if (!carrito[index]) {
        return;
    }


    carrito[index].cantidad += cambio;


    if (carrito[index].cantidad <= 0) {

        carrito.splice(index, 1);

    }


    actualizarCarrito();

}


// ========================================
// ELIMINAR DEL CARRITO
// ========================================

function eliminarDelCarrito(index) {

    if (!carrito[index]) {
        return;
    }


    carrito.splice(index, 1);

    actualizarCarrito();

}


// ========================================
// CALCULAR TOTAL
// ========================================

function calcularTotal() {

    return carrito.reduce(
        (total, item) =>
            total +
            (item.precio * item.cantidad),
        0
    );

}


// ========================================
// ABRIR CARRITO
// ========================================

function abrirCarrito() {

    document.getElementById(
        "modalCarrito"
    ).classList.add("mostrar");


    mostrarCarrito();

}


// ========================================
// CERRAR CARRITO
// ========================================

function cerrarCarrito() {

    document.getElementById(
        "modalCarrito"
    ).classList.remove("mostrar");

}


// ========================================
// CLIENTES
// ========================================

async function cargarClientes() {

    try {

        const respuesta =
            await fetch(`${API_URL}/clientes`);

        const resultado =
            await respuesta.json();


        if (resultado.status !== "Success") {
            throw new Error(resultado.message);
        }


        clientes = resultado.data;


        document.getElementById(
            "totalClientes"
        ).textContent =
            clientes.length;


        mostrarClientes();

        llenarSelectClientes();

    } catch (error) {

        console.error(error);

        document.getElementById(
            "clientesTable"
        ).innerHTML = `

            <tr>
                <td colspan="5" class="loading">
                    ❌ Error al cargar clientes
                </td>
            </tr>

        `;

    }

}


// ========================================
// MOSTRAR CLIENTES
// ========================================

function mostrarClientes() {

    const tbody =
        document.getElementById(
            "clientesTable"
        );


    tbody.innerHTML = "";


    if (clientes.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td colspan="5"
                    class="loading">

                    No hay clientes registrados.

                </td>

            </tr>

        `;

        return;
    }


    clientes.forEach(cliente => {

        const fila =
            document.createElement("tr");


        fila.innerHTML = `

            <td>
                ${cliente.id}
            </td>

            <td>
                <strong>
                    ${cliente.nombre}
                </strong>
            </td>

            <td>
                ${cliente.telefono || "No registrado"}
            </td>

            <td>
                ${cliente.direccion || "No registrada"}
            </td>

            <td>
                ${formatearFecha(
                    cliente.fecha_registro
                )}
            </td>

        `;


        tbody.appendChild(fila);

    });

}


// ========================================
// MODAL NUEVO CLIENTE
// ========================================

function abrirModalCliente() {

    document.getElementById(
        "modalCliente"
    ).classList.add("mostrar");

}


function cerrarModalCliente() {

    document.getElementById(
        "modalCliente"
    ).classList.remove("mostrar");


    document.getElementById(
        "formCliente"
    ).reset();

}


// ========================================
// CREAR CLIENTE
// ========================================

document.getElementById(
    "formCliente"
).addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const nombre =
            document.getElementById(
                "clienteNombre"
            ).value.trim();


        const telefono =
            document.getElementById(
                "clienteTelefono"
            ).value.trim();


        const direccion =
            document.getElementById(
                "clienteDireccion"
            ).value.trim();


        try {

            const respuesta =
                await fetch(
                    `${API_URL}/clientes`,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            nombre,
                            telefono,
                            direccion

                        })

                    }
                );


            const resultado =
                await respuesta.json();


            if (resultado.status !== "Success") {

                throw new Error(
                    resultado.message
                );

            }


            mostrarNotificacion(
                "Cliente creado correctamente"
            );


            cerrarModalCliente();

            await cargarClientes();


        } catch (error) {

            console.error(error);

            mostrarNotificacion(
                "No se pudo crear el cliente",
                true
            );

        }

    }
);


// ========================================
// SELECT CLIENTES
// ========================================

function llenarSelectClientes() {

    const select =
        document.getElementById(
            "selectCliente"
        );


    select.innerHTML = `

        <option value="">
            Selecciona un cliente
        </option>

    `;


    clientes.forEach(cliente => {

        const option =
            document.createElement("option");


        option.value = cliente.id;


        option.textContent =
            `${cliente.nombre} - ${
                cliente.telefono || "Sin teléfono"
            }`;


        select.appendChild(option);

    });

}


// ========================================
// PEDIDOS
// ========================================

async function cargarPedidos() {

    try {

        const respuesta =
            await fetch(`${API_URL}/pedidos`);


        const resultado =
            await respuesta.json();


        if (resultado.status !== "Success") {
            throw new Error(resultado.message);
        }


        pedidos = resultado.data;


        document.getElementById(
            "totalPedidos"
        ).textContent =
            pedidos.length;


        mostrarPedidos();

    } catch (error) {

        console.error(error);

        document.getElementById(
            "pedidosTable"
        ).innerHTML = `

            <tr>

                <td colspan="7"
                    class="loading">

                    ❌ Error al cargar pedidos

                </td>

            </tr>

        `;

    }

}


// ========================================
// MOSTRAR PEDIDOS
// ========================================

function mostrarPedidos() {

    const tbody =
        document.getElementById(
            "pedidosTable"
        );


    tbody.innerHTML = "";


    if (pedidos.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td colspan="7"
                    class="loading">

                    No hay pedidos registrados.

                </td>

            </tr>

        `;

        return;
    }


    pedidos.forEach(pedido => {

        const fila =
            document.createElement("tr");


        fila.innerHTML = `

            <td>
                <strong>
                    #${pedido.id}
                </strong>
            </td>

            <td>
                ${pedido.cliente}
            </td>

            <td>
                ${pedido.telefono || "-"}
            </td>

            <td>
                ${formatearFecha(pedido.fecha)}
            </td>

            <td>
                ${crearEstadoHTML(pedido.estado)}
            </td>

            <td>
                <strong>
                    ${formatearPrecio(pedido.total)}
                </strong>
            </td>

            <td>

                <button
                    class="btn-agregar"
                    onclick="verDetallePedido(${pedido.id})">

                    Ver

                </button>

            </td>

        `;


        tbody.appendChild(fila);

    });

}


// ========================================
// ESTADO DEL PEDIDO
// ========================================

function crearEstadoHTML(estado) {

    let clase = "estado-pendiente";


    switch (estado) {

        case "En preparación":
            clase = "estado-preparacion";
            break;

        case "Listo":
            clase = "estado-listo";
            break;

        case "En camino":
            clase = "estado-camino";
            break;

        case "Entregado":
            clase = "estado-entregado";
            break;

        case "Cancelado":
            clase = "estado-cancelado";
            break;

    }


    return `
        <span class="estado ${clase}">
            ${estado}
        </span>
    `;

}


// ========================================
// ABRIR FORMULARIO PEDIDO
// ========================================

function abrirFormularioPedido() {

    if (carrito.length === 0) {

        mostrarNotificacion(
            "Agrega productos al carrito primero",
            true
        );

        return;
    }


    cerrarCarrito();


    llenarSelectClientes();

    mostrarResumenPedido();


    document.getElementById(
        "modalPedido"
    ).classList.add("mostrar");

}


// ========================================
// CERRAR FORMULARIO PEDIDO
// ========================================

function cerrarFormularioPedido() {

    document.getElementById(
        "modalPedido"
    ).classList.remove("mostrar");

}


// ========================================
// RESUMEN DEL PEDIDO
// ========================================

function mostrarResumenPedido() {

    const container =
        document.getElementById(
            "resumenProductos"
        );


    container.innerHTML = "";


    carrito.forEach(item => {

        const div =
            document.createElement("div");


        div.className =
            "resumen-item";


        div.innerHTML = `

            <span>
                ${item.cantidad} x ${item.nombre}
            </span>

            <strong>
                ${formatearPrecio(
                    item.precio * item.cantidad
                )}
            </strong>

        `;


        container.appendChild(div);

    });


    document.getElementById(
        "resumenTotal"
    ).textContent =
        formatearPrecio(
            calcularTotal()
        );

}


// ========================================
// CREAR PEDIDO
// ========================================

document.getElementById(
    "formPedido"
).addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const clienteId =
            document.getElementById(
                "selectCliente"
            ).value;


        if (!clienteId) {

            mostrarNotificacion(
                "Selecciona un cliente",
                true
            );

            return;
        }


        const productosPedido =
            carrito.map(item => ({

                producto_id:
                    item.producto_id,

                cantidad:
                    item.cantidad

            }));


        try {

            const respuesta =
                await fetch(
                    `${API_URL}/pedidos`,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            cliente_id:
                                Number(clienteId),

                            productos:
                                productosPedido

                        })

                    }
                );


            const resultado =
                await respuesta.json();


            if (resultado.status !== "Success") {

                throw new Error(
                    resultado.message
                );

            }


            mostrarNotificacion(
                `Pedido #${resultado.pedido_id} creado correctamente`
            );


            carrito = [];

            actualizarCarrito();

            cerrarFormularioPedido();


            await cargarPedidos();


            mostrarSeccion("pedidos");


        } catch (error) {

            console.error(error);

            mostrarNotificacion(
                "No se pudo crear el pedido",
                true
            );

        }

    }
);


// ========================================
// DETALLE PEDIDO
// ========================================

async function verDetallePedido(id) {

    const modal =
        document.getElementById(
            "modalDetalle"
        );


    const container =
        document.getElementById(
            "detallePedidoContainer"
        );


    modal.classList.add("mostrar");


    container.innerHTML =
        `<div class="loading">
            Cargando pedido...
        </div>`;


    try {

        const respuesta =
            await fetch(
                `${API_URL}/pedidos/${id}`
            );


        const resultado =
            await respuesta.json();


        if (resultado.status !== "Success") {

            throw new Error(
                resultado.message
            );

        }


        const pedido =
            resultado.pedido;


        const detalles =
            resultado.detalles;


        let productosHTML = "";


        detalles.forEach(detalle => {

            productosHTML += `

                <div class="resumen-item">

                    <span>
                        ${detalle.cantidad} x
                        ${detalle.producto}
                    </span>

                    <strong>
                        ${formatearPrecio(
                            detalle.subtotal
                        )}
                    </strong>

                </div>

            `;

        });


        container.innerHTML = `

            <div class="resumen-pedido">

                <h3>
                    Pedido #${pedido.id}
                </h3>

                <p>
                    <strong>Cliente:</strong>
                    ${pedido.cliente}
                </p>

                <p>
                    <strong>Teléfono:</strong>
                    ${pedido.telefono || "-"}
                </p>

                <p>
                    <strong>Dirección:</strong>
                    ${pedido.direccion || "-"}
                </p>

                <p>
                    <strong>Fecha:</strong>
                    ${formatearFecha(pedido.fecha)}
                </p>

                <p>
                    <strong>Estado:</strong>
                    ${crearEstadoHTML(pedido.estado)}
                </p>

                <br>

                <h3>
                    Productos
                </h3>

                ${productosHTML}

                <div class="resumen-total">

                    <span>
                        Total
                    </span>

                    <strong>
                        ${formatearPrecio(pedido.total)}
                    </strong>

                </div>

            </div>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="loading">
                ❌ No se pudo cargar el detalle.
            </div>
        `;

    }

}


// ========================================
// CERRAR DETALLE
// ========================================

function cerrarDetalle() {

    document.getElementById(
        "modalDetalle"
    ).classList.remove("mostrar");

}


// ========================================
// NOTIFICACIONES
// ========================================

function mostrarNotificacion(
    mensaje,
    error = false
) {

    const notificacion =
        document.getElementById(
            "notificacion"
        );


    const texto =
        document.getElementById(
            "notificacionTexto"
        );


    texto.textContent =
        error
            ? `❌ ${mensaje}`
            : `✅ ${mensaje}`;


    notificacion.classList.add(
        "mostrar"
    );


    setTimeout(() => {

        notificacion.classList.remove(
            "mostrar"
        );

    }, 3000);

}


// ========================================
// FORMATEAR PRECIO
// ========================================

function formatearPrecio(valor) {

    return new Intl.NumberFormat(
        "es-CO",
        {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }
    ).format(Number(valor));

}


// ========================================
// FORMATEAR FECHA
// ========================================

function formatearFecha(fecha) {

    if (!fecha) {
        return "-";
    }


    const fechaObj =
        new Date(fecha);


    if (isNaN(fechaObj.getTime())) {
        return fecha;
    }


    return fechaObj.toLocaleString(
        "es-CO",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );

}


// ========================================
// CERRAR MODALES AL HACER CLICK AFUERA
// ========================================

window.addEventListener(
    "click",
    function(event) {

        const modales =
            document.querySelectorAll(
                ".modal"
            );


        modales.forEach(modal => {

            if (event.target === modal) {

                modal.classList.remove(
                    "mostrar"
                );

            }

        });

    }
);