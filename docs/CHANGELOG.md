# Registro de cambios

## v2.0.0 – Noviembre 2026

### Defectos corregidos (revisión de calidad ISO/IEC 25010)

| # | Defecto en la v1 | Característica afectada | Corrección | Caso que lo verifica |
|---|---|---|---|---|
| D-01 | `cantidad` no se validaba: 0, negativa o texto generaba totales negativos o `NaN` | Adecuación funcional – corrección | Entero entre 1 y 50, validado en la API y con `CHECK` en la BD | CP-24 |
| D-02 | Un `cliente_id` inexistente respondía 500 por error de llave foránea | Fiabilidad | Se verifica el cliente y se responde 404 | CP-25 |
| D-03 | `getConnection()` estaba fuera del `try`: si MySQL fallaba la petición quedaba sin respuesta | Fiabilidad – tolerancia a fallos | Helper `enTransaccion()` con commit, rollback y liberación garantizados | CP-26, CP-27 |
| D-04 | Las respuestas 500 enviaban `error.message` de MySQL al cliente | Seguridad – confidencialidad | Manejador central: detalle solo en el log del servidor | CP-40 |
| D-05 | Se aceptaban productos con precio negativo o cero | Adecuación funcional | Validación en la API y `CHECK (precio > 0)` en la BD | CP-07 |
| D-06 | La interfaz no permitía cambiar el estado de un pedido | Adecuación funcional – completitud | Botones de cambio de estado en el detalle, solo con los estados permitidos | CP-32, CP-33 |
| D-07 | `pizzeria.sql` fallaba si se ejecutaba dos veces | Mantenibilidad | El script elimina y recrea la base | — |
| D-08 | El frontend insertaba datos del usuario con `innerHTML` sin escapar (riesgo de XSS) | Seguridad – integridad | `escaparHTML()` en todos los datos pintados | CP-39 |
| D-09 | Se podía cambiar a cualquier estado (por ejemplo, de Cancelado a Pendiente) | Fiabilidad | Máquina de estados con transiciones permitidas | CP-34, CP-36 |
| D-10 | JSON mal formado respondía 500 | Fiabilidad | Se responde 400 con un mensaje claro | CP-40 |
| D-11 | Productos repetidos en un pedido creaban líneas duplicadas | Adecuación funcional – corrección | Se unen sumando cantidades | CP-23 |

### Nuevas funcionalidades
- Panel de inicio con ventas, ticket promedio, pedidos por estado y productos más vendidos.
- Tipo de entrega (domicilio o recoger en tienda), método de pago, dirección y observaciones en el pedido; costo de domicilio configurable.
- Historial de estados de cada pedido (tabla `historial_estados`) mostrado como línea de tiempo.
- Filtros de pedidos por estado, cliente y fechas; búsqueda en pedidos, clientes y productos.
- Gestión completa de clientes (editar, eliminar, correo, total comprado) y de productos (crear, editar, disponibilidad, eliminar).
- Actualización automática de pedidos cada 20 segundos.
- Carrito que se conserva al recargar la página.
- La API también sirve el frontend: todo funciona en `http://localhost:3000`.

### Base de datos
- Nueva tabla `categorias` (Pizza, Bebida, Entrada, Postre) relacionada con `productos`.
- Nueva tabla `historial_estados`.
- Restricciones `UNIQUE` y `CHECK` (teléfono, correo, precio, cantidad, montos) e índices en columnas de búsqueda.
- Vistas `vista_pedidos` y `vista_ventas_producto` para reportes.
- 14 productos, 5 clientes y 4 pedidos de ejemplo con historial coherente.

### Arquitectura
- Código del backend separado en módulos (`src/`): conexión, errores, validaciones, estados y rutas.
- Cabeceras de seguridad básicas, límite de tamaño de las peticiones y CORS configurable.

### Calidad
- 40 casos de prueba automáticos (CP-01 a CP-40) ejecutados con `npm test` contra una base separada.
- Informe de ejecución IEEE 829 generado automáticamente en `docs/informe-ejecucion-pruebas.md`.
