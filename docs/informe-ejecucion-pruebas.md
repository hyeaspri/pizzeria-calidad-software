# Informe de ejecución de pruebas (IEEE 829)

- **Proyecto:** Sistema de Gestión de Pedidos – Pizzería
- **Identificador del informe:** IEP-2026-11-14
- **Fecha de ejecución:** 14 de noviembre de 2026 a las 2:07 p. m.
- **Entorno:** Node.js v24.15.0 · Windows_NT 10.0.26300 · base de datos de pruebas `pizzeria_test`
- **Herramientas:** node:test (ejecutor nativo de Node.js) + supertest (peticiones HTTP a la API)
- **Comando:** `npm test`

## 1. Resumen

| Casos ejecutados | Pasaron | Fallaron | Porcentaje de éxito |
| --- | --- | --- | --- |
| 40 | 40 | 0 | 100.0 % |

**Resultado global: APROBADO.** Todos los casos de prueba obtuvieron el resultado esperado.

## 2. Resultados por característica de calidad (ISO/IEC 25010)

| Característica | Casos | Pasaron |
| --- | --- | --- |
| Adecuación funcional | 20 | 20 |
| Fiabilidad | 12 | 12 |
| Usabilidad | 2 | 2 |
| Adecuación funcional – corrección | 4 | 4 |
| Seguridad – integridad | 1 | 1 |
| Seguridad | 1 | 1 |

## 3. Registro de ejecución (Test Log)

| ID | Característica | Caso de prueba | Resultado | Duración |
| --- | --- | --- | --- | --- |
| CP-01 | Adecuación funcional | Consultar las categorías con su número de productos | ✅ Pasó | 850 ms |
| CP-02 | Adecuación funcional | Listar todos los productos con su categoría | ✅ Pasó | 10 ms |
| CP-03 | Adecuación funcional | Filtrar productos por categoría y buscar por texto | ✅ Pasó | 19 ms |
| CP-04 | Fiabilidad | Consultar un producto inexistente responde 404 | ✅ Pasó | 12 ms |
| CP-05 | Fiabilidad | Un id no numérico en la URL responde 400 | ✅ Pasó | 11 ms |
| CP-06 | Adecuación funcional | Crear un producto válido | ✅ Pasó | 26 ms |
| CP-07 | Adecuación funcional | Rechazar producto con precio negativo, cero o sin nombre | ✅ Pasó | 35 ms |
| CP-08 | Adecuación funcional | Rechazar producto con categoría inexistente | ✅ Pasó | 8 ms |
| CP-09 | Fiabilidad | Rechazar producto con nombre duplicado (409) | ✅ Pasó | 12 ms |
| CP-10 | Adecuación funcional | Actualizar precio y disponibilidad de un producto | ✅ Pasó | 20 ms |
| CP-11 | Fiabilidad | No eliminar productos usados en pedidos; sí eliminar los que no tienen ventas | ✅ Pasó | 39 ms |
| CP-12 | Adecuación funcional | Registrar un cliente válido (normaliza el teléfono) | ✅ Pasó | 1116 ms |
| CP-13 | Adecuación funcional | Rechazar cliente sin nombre o con nombre de menos de 3 letras | ✅ Pasó | 21 ms |
| CP-14 | Adecuación funcional | Rechazar teléfono con letras o longitud incorrecta | ✅ Pasó | 33 ms |
| CP-15 | Adecuación funcional | Rechazar correo electrónico inválido | ✅ Pasó | 13 ms |
| CP-16 | Fiabilidad | Rechazar teléfono ya registrado (409) | ✅ Pasó | 21 ms |
| CP-17 | Usabilidad | Buscar clientes por nombre, teléfono o correo | ✅ Pasó | 39 ms |
| CP-18 | Adecuación funcional | Consultar un cliente con su historial y total comprado | ✅ Pasó | 22 ms |
| CP-19 | Adecuación funcional | Actualizar parcialmente los datos de un cliente | ✅ Pasó | 51 ms |
| CP-20 | Fiabilidad | No eliminar clientes con pedidos; sí eliminar los que no tienen | ✅ Pasó | 36 ms |
| CP-21 | Adecuación funcional – corrección | Pedido a domicilio: subtotal + domicilio correctos y iguales al cálculo del frontend | ✅ Pasó | 908 ms |
| CP-22 | Adecuación funcional – corrección | Pedido para recoger en tienda no cobra domicilio | ✅ Pasó | 18 ms |
| CP-23 | Adecuación funcional – corrección | Productos repetidos en la solicitud se unen en una sola línea | ✅ Pasó | 21 ms |
| CP-24 | Adecuación funcional | Rechazar cantidades no válidas (0, negativa, decimal, texto, mayor a 50) | ✅ Pasó | 126 ms |
| CP-25 | Fiabilidad | Pedido con cliente inexistente responde 404 y no se guarda | ✅ Pasó | 44 ms |
| CP-26 | Fiabilidad | Producto inexistente: la transacción hace rollback completo | ✅ Pasó | 31 ms |
| CP-27 | Fiabilidad | Producto no disponible: responde 409 y no crea el pedido | ✅ Pasó | 43 ms |
| CP-28 | Adecuación funcional | Rechazar pedido sin productos o sin cliente | ✅ Pasó | 23 ms |
| CP-29 | Seguridad – integridad | El precio enviado por el navegador se ignora; se usa el de la BD | ✅ Pasó | 15 ms |
| CP-30 | Adecuación funcional | Pedido a domicilio sin dirección disponible responde 400 | ✅ Pasó | 42 ms |
| CP-31 | Adecuación funcional | Consultar un pedido con detalle e historial de estados | ✅ Pasó | 29 ms |
| CP-32 | Adecuación funcional | Flujo completo a domicilio: Pendiente → En preparación → Listo → En camino → Entregado | ✅ Pasó | 99 ms |
| CP-33 | Adecuación funcional | Pedido para recoger: de "Listo" pasa a "Entregado" sin "En camino" | ✅ Pasó | 58 ms |
| CP-34 | Fiabilidad | Transición de estado no permitida responde 409 y no cambia el pedido | ✅ Pasó | 13 ms |
| CP-35 | Adecuación funcional | Estado inexistente o vacío responde 400 | ✅ Pasó | 26 ms |
| CP-36 | Fiabilidad | Un pedido Cancelado o Entregado no admite más cambios | ✅ Pasó | 15 ms |
| CP-37 | Usabilidad | Filtrar pedidos por estado, cliente y fecha | ✅ Pasó | 35 ms |
| CP-38 | Adecuación funcional – corrección | Las estadísticas del panel coinciden con los datos (sin cancelados) | ✅ Pasó | 955 ms |
| CP-39 | Seguridad | Resistencia a inyección SQL y a inyección de HTML (XSS) | ✅ Pasó | 96 ms |
| CP-40 | Fiabilidad | Errores controlados: JSON mal formado, rutas inexistentes, sin detalles internos y cabeceras seguras | ✅ Pasó | 53 ms |

## 4. Incidentes

No se registraron incidentes en esta ejecución.

---
*Informe generado automáticamente por `tests/reporte-ieee829.mjs`.*
