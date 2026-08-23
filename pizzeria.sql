CREATE DATABASE IF NOT EXISTS pizzeria;
USE pizzeria;

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(200),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    precio DECIMAL(10,2) NOT NULL,
    categoria VARCHAR(50),
    disponible BOOLEAN DEFAULT TRUE
);

CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado ENUM(
        'Pendiente',
        'En preparación',
        'Listo',
        'En camino',
        'Entregado',
        'Cancelado'
    ) DEFAULT 'Pendiente',
    total DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE detalle_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

INSERT INTO clientes (nombre, telefono, direccion)
VALUES
('Paula Román', '3001234567', 'Carrera 10 #15-20'),
('Carlos Pérez', '3019876543', 'Calle 20 #10-30'),
('María López', '3154567890', 'Carrera 25 #8-15');

INSERT INTO productos (nombre, descripcion, precio, categoria)
VALUES
('Pizza Pepperoni', 'Pizza con pepperoni y queso mozzarella', 28000, 'Pizza'),
('Pizza Hawaiana', 'Pizza con jamón, piña y queso mozzarella', 26000, 'Pizza'),
('Pizza Mexicana', 'Pizza con carne, jalapeño y queso', 30000, 'Pizza'),
('Pizza Vegetariana', 'Pizza con champiñones, pimentón y cebolla', 27000, 'Pizza'),
('Gaseosa', 'Gaseosa personal', 5000, 'Bebida'),
('Agua', 'Agua embotellada', 3000, 'Bebida');

INSERT INTO pedidos (cliente_id, estado, total)
VALUES
(1, 'En preparación', 28000);

INSERT INTO detalle_pedido 
(pedido_id, producto_id, cantidad, precio, subtotal)
VALUES
(1, 1, 1, 28000, 28000);