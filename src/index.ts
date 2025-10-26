#!/usr/bin/env node

// Cargar variables de entorno desde archivo .env
import 'dotenv/config';

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sql from 'mssql';

// Configuración del servidor
const SERVER_NAME = "mcp-database";
const SERVER_VERSION = "1.0.0";

// Crear instancia del servidor MCP
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Tipos para la base de datos
interface DatabaseConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
    connectionTimeout: number;
    requestTimeout: number;
  };
}

const dbConfig: DatabaseConfig = {
  server: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false, // Cambiar a false para túneles locales
    trustServerCertificate: true,
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  }
};

// Pool de conexiones SQL Server
let connectionPool: sql.ConnectionPool | null = null;

// Función para obtener o crear pool de conexiones
async function getConnectionPool(): Promise<sql.ConnectionPool> {
  if (!connectionPool) {
    console.error(`[DEBUG] Intentando conectar a SQL Server:`);
    console.error(`[DEBUG] - Server: ${dbConfig.server}`);
    console.error(`[DEBUG] - Port: ${dbConfig.port}`);
    console.error(`[DEBUG] - Database: ${dbConfig.database}`);
    console.error(`[DEBUG] - User: ${dbConfig.user}`);
    console.error(`[DEBUG] - Encrypt: ${dbConfig.options.encrypt}`);

    connectionPool = new sql.ConnectionPool(dbConfig);

    // Agregar listeners para eventos de conexión
    connectionPool.on('connect', () => {
      console.error(`[INFO] 🟢 Pool conectado exitosamente`);
    });

    connectionPool.on('error', (err) => {
      console.error(`[ERROR] 🔴 Error en pool de conexiones: ${err}`);
    });

    await connectionPool.connect();
    console.error(`[INFO] Conectado a SQL Server: ${dbConfig.server}:${dbConfig.port}/${dbConfig.database}`);
  }
  return connectionPool;
}

// Función helper para ejecutar consultas SQL
async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
  try {
    const pool = await getConnectionPool();
    console.error(`[DEBUG] Ejecutando query: ${query}`);
    console.error(`[DEBUG] Parámetros: ${JSON.stringify(params)}`);

    const request = pool.request();

    // Agregar parámetros si existen
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });

    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error(`[ERROR] Error ejecutando query: ${error}`);
    throw error;
  }
}

// Función helper para validar conexión
async function testConnection(): Promise<boolean> {
  try {
    const pool = await getConnectionPool();
    const result = await pool.request().query('SELECT 1 as test');
    console.error(`[DEBUG] Test de conexión exitoso a ${dbConfig.server}/${dbConfig.database}`);
    return result.recordset.length > 0;
  } catch (error) {
    console.error(`[ERROR] Error de conexión: ${error}`);
    return false;
  }
}

// Función para obtener estructura de tabla específica
async function getTableStructure(tableName: string): Promise<any[]> {
  try {
    const query = `
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        c.ORDINAL_POSITION,
        CASE 
          WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES'
          ELSE 'NO'
        END as IS_PRIMARY_KEY
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
          ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_NAME = @param0
      ORDER BY c.ORDINAL_POSITION
    `;

    const pool = await getConnectionPool();
    const request = pool.request();
    request.input('param0', tableName);
    const result = await request.query(query);

    return result.recordset || [];
  } catch (error) {
    console.error(`[ERROR] Error obteniendo estructura de tabla ${tableName}: ${error}`);
    throw error;
  }
}

// Función para obtener lista de todas las tablas
async function getAllTables(): Promise<any[]> {
  try {
    const query = `
      SELECT 
        TABLE_NAME,
        TABLE_TYPE,
        TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    return await executeQuery(query);
  } catch (error) {
    console.error(`[ERROR] Error obteniendo lista de tablas: ${error}`);
    throw error;
  }
}

// Herramienta para ejecutar consultas SQL SELECT
server.tool(
  "execute_select_query",
  "Ejecuta una consulta SELECT en la base de datos SQL Server",
  {
    query: z.string().describe("La consulta SQL SELECT a ejecutar"),
  },
  async ({ query }) => {
    try {
      // Validar que sea una consulta SELECT
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Solo se permiten consultas SELECT por seguridad.",
            },
          ],
        };
      }

      const results = await executeQuery(query);

      return {
        content: [
          {
            type: "text",
            text: `Consulta ejecutada exitosamente. Resultados (${results.length} filas):\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error ejecutando consulta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Herramienta para obtener información del esquema de la base de datos
server.tool(
  "get_database_schema",
  "Obtiene información del esquema de la base de datos (tablas, columnas, tipos)",
  {
    table_name: z.string().optional().describe("Nombre específico de tabla (opcional, si no se especifica retorna todas las tablas)"),
  },
  async ({ table_name }) => {
    try {
      if (table_name) {
        const tableStructure = await getTableStructure(table_name);
        if (tableStructure.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Tabla '${table_name}' no encontrada.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Estructura de la tabla '${table_name}':\n\`\`\`json\n${JSON.stringify(tableStructure, null, 2)}\n\`\`\``,
            },
          ],
        };
      }

      const allTables = await getAllTables();
      return {
        content: [
          {
            type: "text",
            text: `Tablas en la base de datos (${allTables.length} tablas):\n\`\`\`json\n${JSON.stringify(allTables, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error obteniendo esquema: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Herramienta específica para obtener estructura de tabla
server.tool(
  "get_table_structure",
  "Obtiene la estructura detallada de una tabla específica incluyendo columnas, tipos, claves primarias y foráneas",
  {
    table_name: z.string().describe("Nombre de la tabla de la cual obtener la estructura"),
  },
  async ({ table_name }) => {
    try {
      const tableStructure = await getTableStructure(table_name);
      if (tableStructure.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Tabla '${table_name}' no encontrada en la base de datos.`,
            },
          ],
        };
      }

      // Formatear la información de manera más legible
      const formattedStructure = tableStructure.map(col => ({
        column: col.COLUMN_NAME,
        type: col.DATA_TYPE +
          (col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH})` : '') +
          (col.NUMERIC_PRECISION ? `(${col.NUMERIC_PRECISION}${col.NUMERIC_SCALE ? `,${col.NUMERIC_SCALE}` : ''})` : ''),
        nullable: col.IS_NULLABLE === 'YES',
        primaryKey: col.IS_PRIMARY_KEY === 'YES',
        default: col.COLUMN_DEFAULT
      }));

      return {
        content: [
          {
            type: "text",
            text: `📋 Estructura de la tabla '${table_name}':\n\n\`\`\`json\n${JSON.stringify(formattedStructure, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error obteniendo estructura de tabla: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Herramienta para consultar cualquier tabla como ejemplo
server.tool(
  "query_table_sample",
  "Ejecuta una consulta de ejemplo en cualquier tabla especificada (limitado a 50 registros)",
  {
    table_name: z.string().describe("Nombre de la tabla a consultar"),
    limit: z.number().optional().default(10).describe("Número máximo de registros a retornar (máximo 50)"),
    where_condition: z.string().optional().describe("Condición WHERE opcional para filtrar registros (ej: ID > 100)")
  },
  async ({ table_name, limit = 10, where_condition }) => {
    try {
      // Limitar a máximo 50 registros por seguridad
      const safeLimit = Math.min(Math.max(1, limit), 50);

      // Validar que el nombre de tabla no contenga caracteres peligrosos
      if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: Nombre de tabla inválido. Solo se permiten letras, números y guiones bajos.`,
            },
          ],
        };
      }

      // Construir query con sanitización
      const whereClause = where_condition ? ` WHERE ${where_condition}` : '';
      const query = `SELECT TOP ${safeLimit} * FROM [${table_name}]${whereClause} ORDER BY 1`;

      const results = await executeQuery(query);

      return {
        content: [
          {
            type: "text",
            text: `📄 Muestra de la tabla '${table_name}' (${results.length} registros):\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error consultando tabla '${table_name}': ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Herramienta para probar la conexión a la base de datos
server.tool(
  "test_database_connection",
  "Prueba la conexión a la base de datos SQL Server",
  {},
  async () => {
    try {
      const isConnected = await testConnection();

      return {
        content: [
          {
            type: "text",
            text: isConnected
              ? `✅ Conexión exitosa a SQL Server: ${dbConfig.server}/${dbConfig.database}`
              : `❌ Error de conexión a la base de datos`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error probando conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Función para generar valores aleatorios según el tipo de dato
function generateRandomValue(columnType: string, columnName: string): any {
  const lowerType = columnType.toLowerCase();
  const lowerName = columnName.toLowerCase();

  // Generar valores específicos según el nombre del campo
  if (lowerName.includes('fecha')) {
    return new Date();
  }

  if (lowerName.includes('usuario')) {
    const usuarios = ['ADMIN', 'SYSTEM', 'TEST_USER', 'PRUEBA', 'OPERADOR'];
    return usuarios[Math.floor(Math.random() * usuarios.length)];
  }

  if (lowerName.includes('causal') || lowerName.includes('motivo')) {
    const causales = ['ANULACION', 'CORRECION', 'ERROR', 'SOLICITUD', 'REVISION'];
    return causales[Math.floor(Math.random() * causales.length)];
  }

  if (lowerName.includes('observacion') || lowerName.includes('comentario')) {
    const observaciones = ['Prueba automatizada', 'Datos de testing', 'Generado automáticamente', 'Test MCP'];
    return observaciones[Math.floor(Math.random() * observaciones.length)];
  }

  // Generar valores según el tipo de dato
  if (lowerType.includes('varchar') || lowerType.includes('char')) {
    const length = extractLength(columnType) || 10;
    return generateRandomString(Math.min(length, 10));
  }

  if (lowerType.includes('int') || lowerType.includes('bigint')) {
    return Math.floor(Math.random() * 1000) + 1;
  }

  if (lowerType.includes('decimal') || lowerType.includes('float') || lowerType.includes('money')) {
    return (Math.random() * 1000).toFixed(2);
  }

  if (lowerType.includes('bit')) {
    return Math.random() > 0.5 ? 1 : 0;
  }

  if (lowerType.includes('datetime')) {
    return new Date();
  }

  if (lowerType.includes('tinyint')) {
    return Math.floor(Math.random() * 255);
  }

  if (lowerType.includes('smallint')) {
    return Math.floor(Math.random() * 32767);
  }

  // Valor por defecto
  return 'TEST_VALUE';
}

function extractLength(columnType: string): number | null {
  const match = columnType.match(/\((\d+)\)/);
  return match ? parseInt(match[1]) : null;
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Herramienta para insertar datos de prueba en tablas espejo
server.tool(
  "insert_mirror_table_test_data",
  "Inserta datos de prueba en una tabla espejo/histórica tomando registros de la tabla origen y generando valores aleatorios para campos adicionales",
  {
    source_table: z.string().describe("Nombre de la tabla origen (ej: Preavisos)"),
    mirror_table: z.string().describe("Nombre de la tabla espejo/histórica (ej: AnulacionPreavisos)"),
    records_count: z.number().optional().default(5).describe("Número de registros a copiar desde la tabla origen (máximo 50)"),
    where_condition: z.string().optional().describe("Condición WHERE opcional para filtrar registros de la tabla origen (ej: FECHA >= '2024-01-01')")
  },
  async ({ source_table, mirror_table, records_count = 5, where_condition }) => {
    try {
      // Validar y limitar número de registros
      const safeRecordsCount = Math.min(Math.max(1, records_count), 50);

      console.error(`[INFO] 🔄 Iniciando inserción de datos de prueba:`);
      console.error(`[INFO] - Tabla origen: ${source_table}`);
      console.error(`[INFO] - Tabla espejo: ${mirror_table}`);
      console.error(`[INFO] - Registros: ${safeRecordsCount}`);

      // 1. Obtener estructura de ambas tablas
      const sourceStructure = await getTableStructure(source_table);
      const mirrorStructure = await getTableStructure(mirror_table);

      if (sourceStructure.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: La tabla origen '${source_table}' no existe o no tiene columnas.`,
            },
          ],
        };
      }

      if (mirrorStructure.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: La tabla espejo '${mirror_table}' no existe o no tiene columnas.`,
            },
          ],
        };
      }

      // 2. Identificar campos comunes y campos adicionales
      const sourceColumns = sourceStructure.map(col => col.COLUMN_NAME.toLowerCase());
      const mirrorColumns = mirrorStructure.map(col => col.COLUMN_NAME.toLowerCase());

      const commonColumns = sourceStructure.filter(col =>
        mirrorColumns.includes(col.COLUMN_NAME.toLowerCase()) &&
        col.IS_PRIMARY_KEY !== 'YES' // Excluir PKs auto-generadas
      );

      const additionalColumns = mirrorStructure.filter(col =>
        !sourceColumns.includes(col.COLUMN_NAME.toLowerCase()) &&
        col.IS_PRIMARY_KEY !== 'YES' // Excluir PKs auto-generadas
      );

      console.error(`[DEBUG] Campos comunes encontrados: ${commonColumns.length}`);
      console.error(`[DEBUG] Campos adicionales encontrados: ${additionalColumns.length}`);

      if (additionalColumns.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ Advertencia: La tabla '${mirror_table}' no tiene campos adicionales respecto a '${source_table}'. No es una tabla espejo típica.`,
            },
          ],
        };
      }

      // 3. Obtener datos de la tabla origen
      const whereClause = where_condition ? ` WHERE ${where_condition}` : '';
      const sourceQuery = `SELECT TOP ${safeRecordsCount} ${commonColumns.map(col => `[${col.COLUMN_NAME}]`).join(', ')} FROM [${source_table}]${whereClause} ORDER BY NEWID()`;

      console.error(`[DEBUG] Query origen: ${sourceQuery}`);

      const sourceData = await executeQuery(sourceQuery);

      if (sourceData.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ No se encontraron registros en la tabla origen '${source_table}' con los criterios especificados.`,
            },
          ],
        };
      }

      // 4. Preparar consulta de inserción
      const allInsertColumns = [
        ...commonColumns.map(col => col.COLUMN_NAME),
        ...additionalColumns.map(col => col.COLUMN_NAME)
      ];

      const insertQuery = `INSERT INTO [${mirror_table}] (${allInsertColumns.map(col => `[${col}]`).join(', ')}) VALUES `;

      // 5. Generar valores para insertar
      const insertValues: string[] = [];

      for (const sourceRow of sourceData) {
        const values: string[] = [];

        // Agregar valores de campos comunes
        for (const col of commonColumns) {
          const value = sourceRow[col.COLUMN_NAME];
          if (value === null || value === undefined) {
            values.push('NULL');
          } else if (typeof value === 'string') {
            values.push(`'${value.replace(/'/g, "''")}'`);
          } else if (value instanceof Date) {
            values.push(`'${value.toISOString()}'`);
          } else {
            values.push(`'${value}'`);
          }
        }

        // Agregar valores generados para campos adicionales
        for (const col of additionalColumns) {
          const randomValue = generateRandomValue(col.DATA_TYPE, col.COLUMN_NAME);

          if (randomValue === null || randomValue === undefined) {
            values.push('NULL');
          } else if (typeof randomValue === 'string') {
            values.push(`'${randomValue.replace(/'/g, "''")}'`);
          } else if (randomValue instanceof Date) {
            values.push(`'${randomValue.toISOString()}'`);
          } else {
            values.push(`'${randomValue}'`);
          }
        }

        insertValues.push(`(${values.join(', ')})`);
      }

      const finalInsertQuery = insertQuery + insertValues.join(', ');

      console.error(`[DEBUG] Query inserción: ${finalInsertQuery.substring(0, 200)}...`);

      // 6. Ejecutar inserción
      await executeQuery(finalInsertQuery);

      return {
        content: [
          {
            type: "text",
            text: `✅ **Inserción de datos de prueba completada exitosamente**
            
📊 **Resumen:**
- **Tabla origen:** ${source_table}
- **Tabla espejo:** ${mirror_table}
- **Registros insertados:** ${sourceData.length}
- **Campos comunes copiados:** ${commonColumns.length}
- **Campos adicionales generados:** ${additionalColumns.length}

🔧 **Campos adicionales generados:**
${additionalColumns.map(col => `- **${col.COLUMN_NAME}** (${col.DATA_TYPE}): Valor aleatorio generado`).join('\n')}

${where_condition ? `🔍 **Filtro aplicado:** ${where_condition}` : ''}

Los datos se han insertado con valores realistas para los campos adicionales según el tipo de dato y nombre del campo.`,
          },
        ],
      };

    } catch (error) {
      console.error(`[ERROR] Error en inserción de datos espejo: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error insertando datos de prueba: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Herramienta para analizar diferencias entre tabla origen y tabla espejo
server.tool(
  "analyze_mirror_table_structure",
  "Analiza las diferencias estructurales entre una tabla origen y su tabla espejo/histórica",
  {
    source_table: z.string().describe("Nombre de la tabla origen"),
    mirror_table: z.string().describe("Nombre de la tabla espejo/histórica")
  },
  async ({ source_table, mirror_table }) => {
    try {
      // Obtener estructura de ambas tablas
      const sourceStructure = await getTableStructure(source_table);
      const mirrorStructure = await getTableStructure(mirror_table);

      if (sourceStructure.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: La tabla origen '${source_table}' no existe.`,
            },
          ],
        };
      }

      if (mirrorStructure.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: La tabla espejo '${mirror_table}' no existe.`,
            },
          ],
        };
      }

      // Crear mapas para comparación
      const sourceColumnsMap = new Map(sourceStructure.map(col => [col.COLUMN_NAME.toLowerCase(), col]));
      const mirrorColumnsMap = new Map(mirrorStructure.map(col => [col.COLUMN_NAME.toLowerCase(), col]));

      // Identificar diferencias
      const commonColumns: any[] = [];
      const onlyInSource: any[] = [];
      const onlyInMirror: any[] = [];
      const differentTypes: any[] = [];

      // Analizar columnas de la tabla origen
      for (const sourceCol of sourceStructure) {
        const colNameLower = sourceCol.COLUMN_NAME.toLowerCase();
        const mirrorCol = mirrorColumnsMap.get(colNameLower);

        if (mirrorCol) {
          if (sourceCol.DATA_TYPE !== mirrorCol.DATA_TYPE) {
            differentTypes.push({
              column: sourceCol.COLUMN_NAME,
              sourceType: sourceCol.DATA_TYPE,
              mirrorType: mirrorCol.DATA_TYPE
            });
          } else {
            commonColumns.push(sourceCol);
          }
        } else {
          onlyInSource.push(sourceCol);
        }
      }

      // Analizar columnas solo en la tabla espejo
      for (const mirrorCol of mirrorStructure) {
        const colNameLower = mirrorCol.COLUMN_NAME.toLowerCase();
        if (!sourceColumnsMap.has(colNameLower)) {
          onlyInMirror.push(mirrorCol);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `📊 **Análisis de estructura entre tablas**

🔗 **Tabla origen:** \`${source_table}\` (${sourceStructure.length} columnas)
🔗 **Tabla espejo:** \`${mirror_table}\` (${mirrorStructure.length} columnas)

## 📈 **Resumen de diferencias:**
- **Columnas comunes:** ${commonColumns.length}
- **Solo en origen:** ${onlyInSource.length}
- **Solo en espejo:** ${onlyInMirror.length}
- **Tipos diferentes:** ${differentTypes.length}

${onlyInMirror.length > 0 ? `
## ➕ **Campos adicionales en tabla espejo:**
${onlyInMirror.map(col => `- **${col.COLUMN_NAME}** (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'NO' ? '- NOT NULL' : ''} ${col.IS_PRIMARY_KEY === 'YES' ? '- PK' : ''}`).join('\n')}
` : ''}

${onlyInSource.length > 0 ? `
## ➖ **Campos solo en tabla origen:**
${onlyInSource.map(col => `- **${col.COLUMN_NAME}** (${col.DATA_TYPE})`).join('\n')}
` : ''}

${differentTypes.length > 0 ? `
## ⚠️ **Campos con tipos diferentes:**
${differentTypes.map(diff => `- **${diff.column}**: ${diff.sourceType} → ${diff.mirrorType}`).join('\n')}
` : ''}

## 💡 **Recomendaciones:**
${onlyInMirror.length > 0 ?
                `✅ Esta configuración es típica de una tabla espejo. Los ${onlyInMirror.length} campos adicionales se pueden generar automáticamente con datos de prueba.` :
                `⚠️ No se detectaron campos adicionales. Verificar si es realmente una tabla espejo.`}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error analizando estructuras: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Herramienta para generar diagrama ER básico
server.tool(
  "generate_er_diagram",
  "Genera un diagrama de entidad-relación básico en formato texto basado en las tablas y sus relaciones",
  {
    include_tables: z.array(z.string()).optional().describe("Lista específica de tablas a incluir (opcional, si no se especifica incluye todas)"),
    show_columns: z.boolean().optional().default(false).describe("Si incluir columnas en el diagrama (por defecto solo nombres de tablas)")
  },
  async ({ include_tables, show_columns = false }) => {
    try {
      // Obtener todas las tablas o las especificadas
      let tables;
      if (include_tables && include_tables.length > 0) {
        // Validar nombres de tablas
        const invalidTables = include_tables.filter(table => !/^[a-zA-Z0-9_]+$/.test(table));
        if (invalidTables.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Error: Nombres de tabla inválidos: ${invalidTables.join(', ')}. Solo se permiten letras, números y guiones bajos.`,
              },
            ],
          };
        }

        // Obtener estructura de tablas específicas
        tables = [];
        for (const tableName of include_tables) {
          const structure = await getTableStructure(tableName);
          if (structure.length > 0) {
            tables.push({ TABLE_NAME: tableName, structure });
          }
        }
      } else {
        // Obtener todas las tablas
        const allTables = await getAllTables();
        tables = allTables.slice(0, 20); // Limitar a 20 tablas para evitar diagramas muy grandes
      }

      if (tables.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ No se encontraron tablas para generar el diagrama.`,
            },
          ],
        };
      }

      // Obtener relaciones FK
      const fkQuery = `
        SELECT 
          fk.name AS FK_NAME,
          tp.name AS PARENT_TABLE,
          cp.name AS PARENT_COLUMN,
          tr.name AS REFERENCED_TABLE,
          cr.name AS REFERENCED_COLUMN
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        ORDER BY tp.name, tr.name
      `;

      let foreignKeys = [];
      try {
        foreignKeys = await executeQuery(fkQuery);
      } catch (fkError) {
        console.error(`[WARNING] No se pudieron obtener claves foráneas: ${fkError}`);
      }

      // Generar diagrama en formato texto
      let diagram = "# Diagrama de Entidad-Relación\n\n";
      diagram += "```\n";

      // Mostrar tablas
      if (show_columns) {
        for (const table of tables) {
          const tableName = table.TABLE_NAME || table.name;
          diagram += `┌─ ${tableName} ─┐\n`;

          if (table.structure) {
            const structure = table.structure;
            for (const col of structure.slice(0, 10)) { // Máximo 10 columnas
              const pk = col.IS_PRIMARY_KEY === 'YES' ? ' 🔑' : '';
              const nullable = col.IS_NULLABLE === 'NO' ? ' *' : '';
              diagram += `│ ${col.COLUMN_NAME} (${col.DATA_TYPE})${pk}${nullable}\n`;
            }
            if (structure.length > 10) {
              diagram += `│ ... y ${structure.length - 10} columnas más\n`;
            }
          } else {
            // Si no tenemos estructura, obtenerla
            try {
              const structure = await getTableStructure(tableName);
              for (const col of structure.slice(0, 10)) {
                const pk = col.IS_PRIMARY_KEY === 'YES' ? ' 🔑' : '';
                const nullable = col.IS_NULLABLE === 'NO' ? ' *' : '';
                diagram += `│ ${col.COLUMN_NAME} (${col.DATA_TYPE})${pk}${nullable}\n`;
              }
              if (structure.length > 10) {
                diagram += `│ ... y ${structure.length - 10} columnas más\n`;
              }
            } catch (error) {
              diagram += `│ [Error obteniendo estructura]\n`;
            }
          }

          diagram += `└─────────────┘\n\n`;
        }
      } else {
        // Solo nombres de tablas
        for (const table of tables) {
          const tableName = table.TABLE_NAME || table.name;
          diagram += `[${tableName}]\n`;
        }
        diagram += "\n";
      }

      // Mostrar relaciones
      if (foreignKeys.length > 0) {
        diagram += "# Relaciones (Claves Foráneas)\n\n";
        for (const fk of foreignKeys) {
          diagram += `${fk.PARENT_TABLE}.${fk.PARENT_COLUMN} ──────► ${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN}\n`;
        }
      }

      diagram += "```\n\n";
      diagram += "**Leyenda:**\n";
      diagram += "- 🔑 = Clave Primaria\n";
      diagram += "- * = Campo obligatorio (NOT NULL)\n";
      diagram += "- ──────► = Relación de clave foránea\n";

      return {
        content: [
          {
            type: "text",
            text: `📊 **Diagrama ER de la base de datos** (${tables.length} tablas):\n\n${diagram}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error generando diagrama ER: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
);

// Función principal para ejecutar el servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP Server v${SERVER_VERSION} ejecutándose en stdio`);
  console.error(`Configurado para SQL Server: ${dbConfig.server}/${dbConfig.database}`);
}

// Manejo de señales para cerrar conexiones correctamente
process.on('SIGINT', async () => {
  console.error('Cerrando servidor MCP...');
  if (connectionPool) {
    await connectionPool.close();
    console.error('Pool de conexiones cerrado.');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Cerrando servidor MCP...');
  if (connectionPool) {
    await connectionPool.close();
    console.error('Pool de conexiones cerrado.');
  }
  process.exit(0);
});

// Manejo de errores y ejecución
main().catch((error) => {
  console.error("Error fatal en main():", error);
  if (connectionPool) {
    connectionPool.close().then(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});
