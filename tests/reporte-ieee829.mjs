// =====================================================================
//  Reporte personalizado de node:test
//  Genera el informe de ejecución de pruebas (IEEE 829 - Test Log /
//  Test Summary Report) en Markdown a partir de los casos CP-XX.
//  Formato del nombre de cada prueba:
//      "CP-01 | Característica ISO 25010 | Descripción del caso"
// =====================================================================
import os from 'node:os';

export default async function* reporteIEEE829(fuente) {
    const casos = new Map();
    const inicio = new Date();

    for await (const { type, data } of fuente) {
        if (type !== 'test:pass' && type !== 'test:fail') continue;
        const m = /^(CP-\d{2})\s*\|\s*([^|]+)\|\s*(.+)$/.exec(data.name);
        if (!m) continue;
        const [, id, caracteristica, descripcion] = m;
        const error = data.details?.error;
        casos.set(id, {
            id,
            caracteristica: caracteristica.trim(),
            descripcion: descripcion.trim(),
            paso: type === 'test:pass',
            duracion: data.details?.duration_ms ?? 0,
            archivo: (data.file || '').split(/[\\/]/).pop(),
            error: error ? String(error.cause?.message || error.message || error).split('\n').slice(0, 6).join('\n') : ''
        });
    }

    const lista = [...casos.values()].sort((a, b) => a.id.localeCompare(b.id));
    const pasaron = lista.filter((c) => c.paso).length;
    const fallaron = lista.length - pasaron;
    const pct = lista.length ? ((pasaron / lista.length) * 100).toFixed(1) : '0.0';
    const fecha = inicio.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });

    const porCaracteristica = {};
    lista.forEach((c) => {
        porCaracteristica[c.caracteristica] ??= { total: 0, ok: 0 };
        porCaracteristica[c.caracteristica].total += 1;
        if (c.paso) porCaracteristica[c.caracteristica].ok += 1;
    });

    let md = `# Informe de ejecución de pruebas (IEEE 829)

- **Proyecto:** Sistema de Gestión de Pedidos – Pizzería
- **Identificador del informe:** IEP-${inicio.toISOString().slice(0, 10)}
- **Fecha de ejecución:** ${fecha}
- **Entorno:** Node.js ${process.version} · ${os.type()} ${os.release()} · base de datos de pruebas \`${process.env.DB_NAME_TEST || 'pizzeria_test'}\`
- **Herramientas:** node:test (ejecutor nativo de Node.js) + supertest (peticiones HTTP a la API)
- **Comando:** \`npm test\`

## 1. Resumen

| Casos ejecutados | Pasaron | Fallaron | Porcentaje de éxito |
| --- | --- | --- | --- |
| ${lista.length} | ${pasaron} | ${fallaron} | ${pct} % |

${fallaron === 0
        ? '**Resultado global: APROBADO.** Todos los casos de prueba obtuvieron el resultado esperado.'
        : `**Resultado global: NO APROBADO.** ${fallaron} caso(s) no obtuvieron el resultado esperado (ver sección 4).`}

## 2. Resultados por característica de calidad (ISO/IEC 25010)

| Característica | Casos | Pasaron |
| --- | --- | --- |
${Object.entries(porCaracteristica).map(([k, v]) => `| ${k} | ${v.total} | ${v.ok} |`).join('\n')}

## 3. Registro de ejecución (Test Log)

| ID | Característica | Caso de prueba | Resultado | Duración |
| --- | --- | --- | --- | --- |
${lista.map((c) => `| ${c.id} | ${c.caracteristica} | ${c.descripcion} | ${c.paso ? '✅ Pasó' : '❌ Falló'} | ${c.duracion.toFixed(0)} ms |`).join('\n')}

## 4. Incidentes

${fallaron === 0
        ? 'No se registraron incidentes en esta ejecución.'
        : lista.filter((c) => !c.paso).map((c) => `### ${c.id} – ${c.descripcion}\n\nArchivo: \`${c.archivo}\`\n\n\`\`\`\n${c.error}\n\`\`\``).join('\n\n')}

---
*Informe generado automáticamente por \`tests/reporte-ieee829.mjs\`.*
`;
    yield md;
}
