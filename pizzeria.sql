-- =====================================================================
--  SISTEMA DE GESTIÓN DE PEDIDOS - PIZZERÍA
--  Script de creación de la base de datos (v2.0)
--  Compatible con MySQL 8.0+ y MariaDB 10.6+
--
--  ADVERTENCIA: este script BORRA y vuelve a crear la base "pizzeria".
--  Úsalo para instalar o reiniciar el entorno de desarrollo.
--  Para respaldar datos reales usa mysqldump (ver README).
-- =====================================================================

SET NAMES utf8mb4;

-- @@BEGIN_DB
DROP DATABASE IF EXISTS pizzeria;
CREATE DATABASE pizzeria
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE pizzeria;
-- @@END_DB


-- ---------------------------------------------------------------------
--  CATEGORÍAS
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL,
    descripcion VARCHAR(150),
    icono       VARCHAR(10)  DEFAULT '🍽️',
    CONSTRAINT uq_categorias_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  CLIENTES
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    telefono       VARCHAR(15),
    email          VARCHAR(120),
    direccion      VARCHAR(200),
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_clientes_telefono UNIQUE (telefono),
    CONSTRAINT uq_clientes_email    UNIQUE (email),
    CONSTRAINT ck_clientes_nombre   CHECK (CHAR_LENGTH(TRIM(nombre)) >= 3),
    CONSTRAINT ck_clientes_telefono CHECK (telefono IS NULL OR telefono REGEXP '^[0-9]{7,15}$')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  PRODUCTOS
-- ---------------------------------------------------------------------
CREATE TABLE productos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100)  NOT NULL,
    descripcion    VARCHAR(255),
    precio         DECIMAL(10,2) NOT NULL,
    categoria_id   INT           NOT NULL,
    disponible     BOOLEAN       NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_productos_nombre   UNIQUE (nombre),
    CONSTRAINT ck_productos_precio   CHECK (precio > 0),
    CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX ix_productos_categoria ON productos(categoria_id);

-- ---------------------------------------------------------------------
--  PEDIDOS
-- ---------------------------------------------------------------------
CREATE TABLE pedidos (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id          INT NOT NULL,
    fecha               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM(
        'Pendiente',
        'En preparación',
        'Listo',
        'En camino',
        'Entregado',
        'Cancelado'
    ) NOT NULL DEFAULT 'Pendiente',
    tipo_entrega        ENUM('Domicilio', 'Recoger en tienda') NOT NULL DEFAULT 'Domicilio',
    metodo_pago         ENUM('Efectivo', 'Tarjeta', 'Transferencia') NOT NULL DEFAULT 'Efectivo',
    direccion_entrega   VARCHAR(200),
    observaciones       VARCHAR(255),
    subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_domicilio     DECIMAL(10,2) NOT NULL DEFAULT 0,
    total               DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT ck_pedidos_montos CHECK (subtotal >= 0 AND costo_domicilio >= 0 AND total >= 0),
    CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX ix_pedidos_estado  ON pedidos(estado);
CREATE INDEX ix_pedidos_fecha   ON pedidos(fecha);
CREATE INDEX ix_pedidos_cliente ON pedidos(cliente_id);

-- ---------------------------------------------------------------------
--  DETALLE DEL PEDIDO
-- ---------------------------------------------------------------------
CREATE TABLE detalle_pedido (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id   INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad    INT NOT NULL,
    precio      DECIMAL(10,2) NOT NULL,
    subtotal    DECIMAL(10,2) NOT NULL,
    CONSTRAINT uq_detalle_producto UNIQUE (pedido_id, producto_id),
    CONSTRAINT ck_detalle_cantidad CHECK (cantidad BETWEEN 1 AND 50),
    CONSTRAINT ck_detalle_precio   CHECK (precio > 0 AND subtotal > 0),
    CONSTRAINT fk_detalle_pedido   FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id)
        REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  HISTORIAL DE ESTADOS (trazabilidad de cada cambio)
-- ---------------------------------------------------------------------
CREATE TABLE historial_estados (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id       INT NOT NULL,
    estado_anterior VARCHAR(20),
    estado_nuevo    VARCHAR(20) NOT NULL,
    observacion     VARCHAR(255),
    fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historial_pedido FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_historial_pedido ON historial_estados(pedido_id);

-- ---------------------------------------------------------------------
--  VISTAS PARA REPORTES
-- ---------------------------------------------------------------------
CREATE VIEW vista_pedidos AS
SELECT
    p.id,
    p.fecha,
    p.estado,
    p.tipo_entrega,
    p.metodo_pago,
    p.total,
    c.id       AS cliente_id,
    c.nombre   AS cliente,
    c.telefono AS telefono,
    (SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_pedido d WHERE d.pedido_id = p.id) AS unidades
FROM pedidos p
INNER JOIN clientes c ON c.id = p.cliente_id;

CREATE VIEW vista_ventas_producto AS
SELECT
    pr.id,
    pr.nombre,
    ca.nombre                    AS categoria,
    COALESCE(SUM(CASE WHEN p.estado <> 'Cancelado' THEN d.cantidad END), 0) AS unidades_vendidas,
    COALESCE(SUM(CASE WHEN p.estado <> 'Cancelado' THEN d.subtotal END), 0) AS ingresos
FROM productos pr
INNER JOIN categorias ca ON ca.id = pr.categoria_id
LEFT JOIN detalle_pedido d ON d.producto_id = pr.id
LEFT JOIN pedidos p ON p.id = d.pedido_id
GROUP BY pr.id, pr.nombre, ca.nombre;

-- =====================================================================
--  DATOS INICIALES
-- =====================================================================

INSERT INTO categorias (nombre, descripcion, icono) VALUES
('Pizza',     'Pizzas artesanales horneadas al momento', '🍕'),
('Bebida',    'Bebidas frías',                            '🥤'),
('Entrada',   'Acompañamientos para compartir',          '🥖'),
('Postre',    'Postres de la casa',                       '🍰');

INSERT INTO productos (nombre, descripcion, precio, categoria_id) VALUES
('Pizza Pepperoni',     'Pepperoni y queso mozzarella',                 28000, 1),
('Pizza Hawaiana',      'Jamón, piña y queso mozzarella',               26000, 1),
('Pizza Mexicana',      'Carne molida, jalapeño, maíz y queso',         30000, 1),
('Pizza Vegetariana',   'Champiñones, pimentón, cebolla y aceitunas',   27000, 1),
('Pizza Margarita',     'Tomate, albahaca fresca y mozzarella',         24000, 1),
('Pizza Cuatro Quesos', 'Mozzarella, parmesano, azul y provolone',      32000, 1),
('Gaseosa',             'Gaseosa personal 400 ml',                       5000, 2),
('Agua',                'Agua embotellada 600 ml',                       3000, 2),
('Limonada Natural',    'Limonada de la casa 350 ml',                    6000, 2),
('Gaseosa 1.5 L',       'Gaseosa familiar para compartir',               9000, 2),
('Pan de Ajo',          'Pan artesanal con mantequilla de ajo',          9000, 3),
('Alitas BBQ',          '8 alitas en salsa BBQ',                        18000, 3),
('Brownie con Helado',  'Brownie de chocolate con helado de vainilla',  12000, 4),
('Tiramisú',            'Postre italiano de café y mascarpone',         11000, 4);

INSERT INTO clientes (nombre, telefono, email, direccion) VALUES
('Paula Román',       '3001234567', 'paula.roman@correo.com',   'Carrera 10 #15-20'),
('Carlos Pérez',      '3019876543', 'carlos.perez@correo.com',  'Calle 20 #10-30'),
('María López',       '3154567890', 'maria.lopez@correo.com',   'Carrera 25 #8-15'),
('Andrés Gómez',      '3205551234', NULL,                       'Avenida 68 #45-12'),
('Laura Martínez',    '3112223344', 'laura.martinez@correo.com','Calle 72 #11-40');

-- Pedido 1: en preparación, a domicilio
INSERT INTO pedidos (cliente_id, estado, tipo_entrega, metodo_pago, direccion_entrega, subtotal, costo_domicilio, total)
VALUES (1, 'En preparación', 'Domicilio', 'Efectivo', 'Carrera 10 #15-20', 33000, 5000, 38000);
INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal) VALUES
(1, 1, 1, 28000, 28000),
(1, 7, 1,  5000,  5000);
INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, observacion) VALUES
(1, NULL,        'Pendiente',      'Pedido creado'),
(1, 'Pendiente', 'En preparación', 'Cambio de estado');

-- Pedido 2: entregado, recoger en tienda
INSERT INTO pedidos (cliente_id, estado, tipo_entrega, metodo_pago, subtotal, costo_domicilio, total, observaciones)
VALUES (2, 'Entregado', 'Recoger en tienda', 'Tarjeta', 74000, 0, 74000, 'Sin cebolla en la vegetariana');
INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal) VALUES
(2, 2,  1, 26000, 26000),
(2, 4,  1, 27000, 27000),
(2, 10, 1,  9000,  9000),
(2, 13, 1, 12000, 12000);
INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, observacion) VALUES
(2, NULL,             'Pendiente',      'Pedido creado'),
(2, 'Pendiente',      'En preparación', 'Cambio de estado'),
(2, 'En preparación', 'Listo',          'Cambio de estado'),
(2, 'Listo',          'Entregado',      'Cliente recogió en tienda');

-- Pedido 3: pendiente, a domicilio
INSERT INTO pedidos (cliente_id, estado, tipo_entrega, metodo_pago, direccion_entrega, subtotal, costo_domicilio, total)
VALUES (3, 'Pendiente', 'Domicilio', 'Transferencia', 'Carrera 25 #8-15', 69000, 5000, 74000);
INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal) VALUES
(3, 3,  1, 30000, 30000),
(3, 11, 1,  9000,  9000),
(3, 12, 1, 18000, 18000),
(3, 9,  2,  6000, 12000);
INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, observacion) VALUES
(3, NULL, 'Pendiente', 'Pedido creado');

-- Pedido 4: cancelado
INSERT INTO pedidos (cliente_id, estado, tipo_entrega, metodo_pago, direccion_entrega, subtotal, costo_domicilio, total)
VALUES (4, 'Cancelado', 'Domicilio', 'Efectivo', 'Avenida 68 #45-12', 32000, 5000, 37000);
INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio, subtotal) VALUES
(4, 6, 1, 32000, 32000);
INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, observacion) VALUES
(4, NULL,        'Pendiente', 'Pedido creado'),
(4, 'Pendiente', 'Cancelado', 'Cliente canceló por teléfono');
