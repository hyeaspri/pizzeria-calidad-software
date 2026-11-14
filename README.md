# 🍕 Sistema de Gestión de Pedidos – Pizzería (v2.0)

Proyecto de las asignaturas **Estándares y Métricas** e **Ingeniería Web**.
Aplicación web para consultar el menú, armar un carrito, registrar clientes, crear pedidos y seguir su estado en tiempo real.

## Equipo (roles TSP)
| Integrante | Rol |
|---|---|
| Paula Román | Administradora del Proyecto |
| Heidy Asprilla | Líder de Calidad / Integradora |
| Hayder Carreño | Analista de Calidad / Planificación |
| Daniela Rodríguez | Analista de Procesos / Soporte y Cliente |

## Tecnologías
- **Frontend:** HTML5 semántico, CSS3 responsive, JavaScript (sin frameworks)
- **Backend:** Node.js 20+ con Express 5 (API REST)
- **Base de datos:** MySQL 8 (compatible con MariaDB 10.6+) mediante `mysql2` con pool, transacciones y consultas parametrizadas
- **Pruebas:** `node:test` + `supertest` (40 casos automáticos CP-01 a CP-40)

## Funcionalidades
- **Inicio:** panel con ventas totales, ventas del día, ticket promedio, pedidos por estado y productos más vendidos.
- **Menú:** productos por categoría (Pizza, Bebida, Entrada, Postre), búsqueda y carrito que se conserva al recargar.
- **Pedidos:** domicilio o recoger en tienda, método de pago, observaciones, costo de domicilio, filtros por estado, búsqueda, detalle con historial y actualización automática cada 20 s.
- **Estados con reglas:** Pendiente → En preparación → Listo → En camino → Entregado (o Cancelado). Las transiciones inválidas se rechazan.
- **Clientes:** crear, editar, buscar, eliminar (solo sin pedidos), total de pedidos y total comprado.
- **Productos:** crear, editar, activar o desactivar disponibilidad y eliminar (solo sin ventas).

## Estructura
```
pizzeria-calidad-software/
├── app.js                    # Punto de entrada: configura Express, rutas y frontend
├── src/
│   ├── db.js                 # Pool de MySQL y helper de transacciones
│   ├── errores.js            # Manejo centralizado de errores
│   ├── validaciones.js       # Reglas de validación de entrada
│   ├── estados.js            # Máquina de estados del pedido
│   └── rutas/
│       ├── productos.js      # /api/productos y /api/categorias
│       ├── clientes.js       # /api/clientes
│       ├── pedidos.js        # /api/pedidos
│       └── estadisticas.js   # /api/estadisticas
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── utils.js              # Funciones puras (también probadas con Node)
│   └── script.js
├── tests/                    # Casos CP-01 a CP-40 y generador del informe IEEE 829
├── docs/
│   ├── informe-ejecucion-pruebas.md
│   └── CHANGELOG.md          # Cambios de la v2.0 y defectos corregidos
├── pizzeria.sql              # Crea la base de datos con datos iniciales
├── package.json
├── .env.example
└── .gitignore
```

## Instalación
1. **Crear la base de datos** (⚠️ borra y vuelve a crear la base `pizzeria`):
   ```bash
   mysql -u root -p < pizzeria.sql
   ```
   También se puede abrir `pizzeria.sql` en MySQL Workbench y ejecutarlo completo.
2. **Configurar:** copiar `.env.example` como `.env` y escribir la contraseña de MySQL.
3. **Instalar y arrancar:**
   ```bash
   npm install
   npm start
   ```
4. **Abrir** <http://localhost:3000>. El servidor entrega la página y la API (`/api`) en el mismo puerto.

## Pruebas automáticas
```bash
npm test
```
Crea una base aparte (`pizzeria_test`), ejecuta los 40 casos y genera `docs/informe-ejecucion-pruebas.md` con el resultado de cada caso según IEEE 829. No modifica la base `pizzeria`.

## Exportar la base de datos (evidencia de entrega)
```bash
mysqldump -u root -p --databases pizzeria --routines --triggers --result-file=pizzeria_export.sql
```
En MySQL Workbench: *Server → Data Export → pizzeria → Export to Self-Contained File*.

## API REST
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api` | Estado y configuración de la API |
| GET | `/api/salud` | Verifica la conexión con la base de datos |
| GET | `/api/categorias` | Categorías con número de productos |
| GET | `/api/productos?categoria=&buscar=&disponible=` | Listar o filtrar productos |
| GET | `/api/productos/:id` | Un producto |
| POST | `/api/productos` | Crear producto |
| PUT | `/api/productos/:id` | Actualizar producto (parcial) |
| DELETE | `/api/productos/:id` | Eliminar producto sin ventas |
| GET | `/api/clientes?buscar=` | Listar o buscar clientes |
| GET | `/api/clientes/:id` | Cliente con historial de pedidos |
| POST | `/api/clientes` | Registrar cliente |
| PUT | `/api/clientes/:id` | Actualizar cliente (parcial) |
| DELETE | `/api/clientes/:id` | Eliminar cliente sin pedidos |
| GET | `/api/pedidos?estado=&cliente_id=&desde=&hasta=` | Listar o filtrar pedidos |
| GET | `/api/pedidos/:id` | Pedido con detalle, historial y siguientes estados |
| POST | `/api/pedidos` | Crear pedido (transacción) |
| PUT | `/api/pedidos/:id/estado` | Cambiar estado (respeta la máquina de estados) |
| GET | `/api/estadisticas` | Indicadores del panel de inicio |

**Ejemplo para crear un pedido:**
```json
POST /api/pedidos
{
  "cliente_id": 1,
  "tipo_entrega": "Domicilio",
  "metodo_pago": "Efectivo",
  "direccion_entrega": "Carrera 10 #15-20",
  "observaciones": "Sin cebolla",
  "productos": [
    { "producto_id": 1, "cantidad": 2 },
    { "producto_id": 7, "cantidad": 1 }
  ]
}
```

**Códigos de respuesta:** `200` correcto · `201` creado · `400` datos inválidos · `404` no existe · `409` conflicto (duplicado, estado no permitido, registro en uso) · `500` error interno (sin detalles técnicos).

## Marco de calidad
TSP (gestión del ciclo de vida) · ISO/IEC 25010 (características de calidad del producto) · ISO/IEC 12207 (procesos del ciclo de vida) · IEEE 829 (plan, casos e informe de pruebas) · Git/GitHub con ramas y Pull Requests.
