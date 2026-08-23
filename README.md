# Sistema de Gestión de Pedidos - Pizzería

Proyecto realizado para el taller de Calidad de Software.

Es una aplicación web para gestionar los pedidos de una pizzería. Permite consultar productos, agregar productos al carrito, registrar clientes y crear y consultar pedidos.

## Tecnologías

- HTML5
- CSS3
- JavaScript
- Node.js
- Express
- MySQL

## Funcionalidades

- Consultar productos.
- Filtrar productos por categoría.
- Agregar productos al carrito.
- Registrar clientes.
- Crear pedidos.
- Consultar pedidos y sus detalles.
- Mostrar el estado de los pedidos.
- Conectar el sistema con una base de datos MySQL.

## Estructura

```text
pizzeria-calidad-software/
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── app.js
├── package.json
├── package-lock.json
├── pizzeria.sql
├── .env.example
└── .gitignore

## Instalación

1. Clonar el repositorio.

2. Instalar las dependencias:

```bash
npm install
```

3. Crear la base de datos ejecutando el archivo `pizzeria.sql` en MySQL.

4. Crear un archivo `.env` con los datos de conexión a MySQL.

5. Iniciar el servidor:

```bash
node app.js
```

El servidor estará disponible en:

```text
http://localhost:3000
```

## Integrantes

- Paula Román
- Heidy Asprilla
- Hayder Carreño
- Daniela Rodríguez


