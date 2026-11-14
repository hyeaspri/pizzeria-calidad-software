// =====================================================================
//  Manejo centralizado de errores
// =====================================================================

/** Error con código HTTP que se puede mostrar al usuario. */
class HttpError extends Error {
    constructor(status, message, detalles) {
        super(message);
        this.status = status;
        this.detalles = detalles;
    }
}

const noEncontrado = (recurso) => new HttpError(404, `${recurso} no encontrado`);

/** Traduce errores de MySQL a respuestas HTTP comprensibles. */
function traducirErrorMySQL(error) {
    switch (error.code) {
        case 'ER_DUP_ENTRY': {
            const campo = (error.message.match(/for key '(?:[^.']*\.)?([^']+)'/) || [])[1] || '';
            const nombres = {
                uq_clientes_telefono: 'teléfono',
                uq_clientes_email: 'correo electrónico',
                uq_productos_nombre: 'nombre de producto',
                uq_categorias_nombre: 'nombre de categoría'
            };
            return new HttpError(409, `Ya existe un registro con ese ${nombres[campo] || 'valor'}`);
        }
        case 'ER_NO_REFERENCED_ROW_2':
            return new HttpError(400, 'Una de las referencias enviadas no existe');
        case 'ER_ROW_IS_REFERENCED_2':
            return new HttpError(409, 'El registro está siendo usado por otros datos y no se puede eliminar');
        case 'ER_CHECK_CONSTRAINT_VIOLATED':
        case 'ER_CONSTRAINT_FAILED':
            return new HttpError(400, 'Los datos no cumplen las reglas de la base de datos');
        default:
            return null;
    }
}

/** Middleware para rutas inexistentes. */
function rutaNoEncontrada(req, res) {
    res.status(404).json({
        status: 'Error',
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
}

/** Middleware final de errores (Express 5 captura también errores async). */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
    let error = err;

    if (err.type === 'entity.parse.failed') {
        error = new HttpError(400, 'El cuerpo de la petición no es un JSON válido');
    } else if (err.type === 'entity.too.large') {
        error = new HttpError(413, 'La petición es demasiado grande');
    } else if (!(err instanceof HttpError)) {
        error = traducirErrorMySQL(err) || err;
    }

    const status = error.status || 500;

    if (status >= 500) {
        // El detalle técnico solo se registra en el servidor, nunca se envía al cliente
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    }

    const cuerpo = {
        status: 'Error',
        message: status >= 500 ? 'Ocurrió un error interno. Intenta de nuevo más tarde.' : error.message
    };
    if (error.detalles) cuerpo.errores = error.detalles;

    res.status(status).json(cuerpo);
}

module.exports = { HttpError, noEncontrado, rutaNoEncontrada, manejadorErrores };
