# MCP Database Server

Un servidor MCP (Model Context Protocol) genérico para interactuar con bases de datos SQL Server, proporcionando análisis de esquemas, consultas seguras, generación de diagramas ER y gestión avanzada de tablas espejo/históricas.

## ⚡ Quick Start

### 1. Configuración Rápida
```bash
# Clonar y configurar
git clone <repo-url>
cd mcp-database
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus datos de conexión

# Compilar y ejecutar
npm run build
npm start
```

### 2. Primeras Pruebas
Una vez ejecutándose, puedes probar estas herramientas básicas:
- **Conectividad**: `test_database_connection`
- **Explorar tablas**: `get_database_schema`
- **Ver estructura**: `get_table_structure` con tu tabla favorita
- **Generar diagrama**: `generate_er_diagram` para visualizar tu BD

## 🚀 Características Principales

### 🔍 Exploración y Análisis de Datos
- ✅ **Conexión segura** a cualquier base de datos SQL Server
- ✅ **Análisis completo de esquemas** - Lista todas las tablas y sus metadatos
- ✅ **Estructura detallada de tablas** - Columnas, tipos, PKs, nullable, etc.
- ✅ **Consultas parametrizadas** en cualquier tabla con filtros WHERE
- ✅ **Muestreo seguro de datos** con límites configurables

### 📊 Visualización y Documentación
- 🆕 **Generación automática de diagramas ER** en formato texto
- 🆕 **Mapeo de relaciones FK** entre tablas
- 🆕 **Documentación automática** de esquemas de BD

### 🔄 Gestión Avanzada de Tablas Espejo
- 🆕 **Análisis de tablas espejo/históricas** - Compara estructuras automáticamente
- 🆕 **Inserción inteligente de datos de prueba** - Copia datos reales + genera campos adicionales
- 🆕 **Generación contextual de valores** - Basada en nombres de campos y tipos de datos

## 🛠️ Herramientas MCP Disponibles (8 total)

### Herramientas de Conectividad y Consultas
1. **`test_database_connection`** - Verifica la conectividad con la base de datos SQL Server
2. **`execute_select_query`** - Ejecuta consultas SELECT personalizadas con validaciones de seguridad
3. **`query_table_sample`** - Obtiene muestras de datos de cualquier tabla con filtros WHERE opcionales

### Herramientas de Análisis de Esquemas
4. **`get_database_schema`** - Obtiene lista completa de tablas y esquemas de la base de datos
5. **`get_table_structure`** - Analiza estructura detallada de una tabla específica (columnas, tipos, PKs, etc.)
6. **`generate_er_diagram`** - 🆕 Genera diagramas de entidad-relación visuales con relaciones FK

### Herramientas Avanzadas para Tablas Espejo
7. **`analyze_mirror_table_structure`** - Compara y analiza diferencias estructurales entre tabla origen y espejo
8. **`insert_mirror_table_test_data`** - Inserta datos de prueba inteligentes copiando datos reales + generando campos adicionales

## ⚙️ Configuración

### Variables de Entorno (.env)

```env
# Configuración de base de datos SQL Server
DB_HOST=tu_servidor_sql_server
DB_PORT=1433
DB_NAME=tu_base_de_datos
DB_USER=tu_usuario
DB_PASSWORD=tu_password
```

### Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Ejecutar servidor MCP
npm start

# Desarrollo con watch mode
npm run dev
```

## 📊 Ejemplos de Uso de Herramientas

### 🔌 Conectividad y Consultas Básicas

#### 1. Probar Conexión
```json
// test_database_connection - Sin parámetros
{}
```

#### 2. Ejecutar Consulta Personalizada
```json
// execute_select_query
{
  "query": "SELECT TOP 10 * FROM usuarios WHERE activo = 1"
}
```

#### 3. Consultar Tabla con Filtros
```json
// query_table_sample
{
  "table_name": "pedidos",
  "limit": 25,
  "where_condition": "fecha >= '2024-01-01' AND estado = 'COMPLETADO'"
}
```

### 📋 Análisis de Esquemas

#### 4. Obtener Lista de Tablas
```json
// get_database_schema - Sin parámetros
{}
```

#### 5. Analizar Estructura de Tabla
```json
// get_table_structure
{
  "table_name": "usuarios"
}
```

#### 6. Generar Diagrama ER
```json
// generate_er_diagram
{
  "include_tables": ["usuarios", "pedidos", "productos"],
  "show_columns": true
}
```

### 🔄 Tablas Espejo Avanzadas

#### 7. Analizar Diferencias Estructurales
```json
// analyze_mirror_table_structure
{
  "source_table": "Facturas",
  "mirror_table": "HistorialFacturas"
}
```

#### 8. Insertar Datos de Prueba
```json
// insert_mirror_table_test_data
{
  "source_table": "Usuarios",
  "mirror_table": "HistorialUsuarios",
  "records_count": 15,
  "where_condition": "fecha_registro >= '2024-01-01'"
}
```

## 📊 Casos de Uso

### 1. Análisis de Esquemas
- Explorar estructura de base de datos desconocida
- Documentar esquemas existentes
- Identificar tablas y sus relaciones

### 2. Generación de Diagramas ER
```json
{
  "include_tables": ["usuarios", "pedidos", "productos"],
  "show_columns": true
}
```

### 3. Consultas Exploratorias
```json
{
  "table_name": "usuarios",
  "limit": 20,
  "where_condition": "fecha_registro >= '2024-01-01'"
}
```

### 4. Trabajo con Tablas Espejo

#### ¿Qué son las tablas espejo?
Las tablas espejo replican la estructura de una tabla origen pero añaden campos adicionales para tracking de operaciones especiales:

- **Historial de cambios**: `HistorialUsuarios`, `HistorialProductos`
- **Auditoría**: `AuditoriaTransacciones`, `AuditoriaAccesos`
- **Versioning**: `VersionesDatos`, `HistorialCambios`

#### Ejemplo Práctico
**Tabla origen:** `Facturas` (facturas activas)
**Tabla espejo:** `HistorialFacturas` (facturas con historial de cambios)

Campos adicionales en `HistorialFacturas`:
- `FechaModificacion` - Cuándo se modificó
- `TipoOperacion` - Qué operación se realizó
- `UsuarioModificacion` - Quién la modificó
- `MotivoModificacion` - Por qué se modificó

### 5. Flujo de Trabajo con Tablas Espejo

#### Paso 1: Analizar estructura
```json
{
  "source_table": "Facturas",
  "mirror_table": "HistorialFacturas"
}
```

#### Paso 2: Insertar datos de prueba
```json
{
  "source_table": "Facturas", 
  "mirror_table": "HistorialFacturas",
  "records_count": 15,
  "where_condition": "fecha >= '2024-01-01' AND estado = 'ACTIVA'"
}
```

## 🧠 Generación Inteligente de Valores

### Por Nombre de Campo
- `*fecha*` → Fecha actual
- `*usuario*` → Usuarios aleatorios (ADMIN, SYSTEM, OPERADOR)
- `*tipo*`, `*causal*` → Tipos/causales típicas
- `*observacion*`, `*comentario*` → Textos descriptivos
- `*estado*` → Estados comunes (ACTIVO, INACTIVO, PENDIENTE)

### Por Tipo de Dato
- `varchar/char` → Cadenas alfanuméricas
- `int/bigint` → Números 1-1000
- `decimal/float/money` → Decimales con 2 posiciones
- `datetime/date` → Fechas actuales
- `bit` → Valores booleanos (0/1)

## 🔒 Características de Seguridad Robustas

### Protecciones de Acceso a Datos
- ✅ **Solo consultas SELECT**: Todas las herramientas de consulta están limitadas a operaciones de lectura únicamente
- ✅ **Límites de registros**: Máximo 50 registros por consulta para prevenir sobrecarga
- ✅ **Timeout de operaciones**: 30 segundos máximo por consulta para evitar bloqueos

### Validaciones de Entrada
- ✅ **Validación de nombres de tabla**: Solo caracteres alfanuméricos y guiones bajos (`/^[a-zA-Z0-9_]+$/`)
- ✅ **Sanitización de queries**: Escape de caracteres especiales para prevenir inyección SQL básica
- ✅ **Validación de existencia**: Verifica que las tablas existan antes de realizar operaciones

### Monitoreo y Trazabilidad
- ✅ **Logging completo**: Todas las operaciones son registradas con timestamps y detalles
- ✅ **Manejo de errores**: Gestión robusta de excepciones con mensajes informativos
- ✅ **Información de debugging**: Logs detallados para troubleshooting

## 📈 Generación de Diagramas ER

### Capacidades del Generador ER
- **📊 Visualización de tablas**: Muestra nombres y estructuras de tablas
- **🔑 Identificación de PKs**: Marca claves primarias con símbolo 🔑
- **🔗 Mapeo de relaciones**: Detecta y visualiza claves foráneas automáticamente
- **📝 Información de columnas**: Tipos de datos, restricciones NOT NULL
- **🎛️ Control de detalle**: Opción para mostrar/ocultar columnas

### Ejemplo de Diagrama Generado
```
┌─ usuarios ─┐
│ id (int) 🔑
│ nombre (varchar) *
│ email (varchar) *
│ fecha_registro (datetime)
│ activo (bit)
└─────────────┘

┌─ pedidos ─┐
│ id (int) 🔑
│ usuario_id (int) *
│ total (decimal)
│ fecha (datetime) *
└────────────┘

# Relaciones (FK)
pedidos.usuario_id ──────► usuarios.id

📋 Leyenda:
🔑 = Clave Primaria
* = Campo obligatorio (NOT NULL)
──────► = Relación de clave foránea
```

### Configuración de Diagramas
- **Máximo 20 tablas** por diagrama (configurable)
- **Máximo 10 columnas** mostradas por tabla
- **Detección automática** de relaciones FK
- **Formato optimizado** para lectura en texto plano

## 🎯 Casos de Uso Principales

### Para Desarrolladores
- **Exploración de BD**: Entender estructuras de datos existentes
- **Testing**: Generar datos de prueba realistas
- **Debugging**: Investigar problemas con datos específicos
- **Documentación**: Crear diagramas ER automáticamente

### Para Analistas de Datos
- **Análisis exploratorio**: Examinar datasets desconocidos
- **Validación de datos**: Verificar integridad y calidad
- **Mapeo de esquemas**: Documentar arquitecturas de datos

### Para DBAs
- **Auditoría**: Revisar estructuras y relaciones
- **Migración**: Entender esquemas antes de cambios
- **Monitoreo**: Validar configuraciones de tablas

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│   MCP Server     │───▶│   SQL Server    │
│   (VS Code)     │    │  (Node.js/TS)   │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │  Análisis Automático │
                    │  • Esquemas          │
                    │  • Relaciones        │
                    │  • Diagramas ER      │
                    │  • Datos de prueba   │
                    └──────────────────────┘
```

## 🔧 Configuración Avanzada

### Personalización de Generación de Datos
El sistema puede ser extendido para reconocer patrones específicos de tu dominio:

```typescript
// Ejemplo: Personalizar generación para tu dominio
if (lowerName.includes('codigo_cliente')) {
  return `CLI${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
}
```

### Límites Configurables
- **Máximo de registros por consulta**: 50 (configurable)
- **Máximo de tablas en diagrama ER**: 20 (configurable)
- **Timeout de conexión**: 30 segundos
- **Timeout de consulta**: 30 segundos

## 📝 Logs y Monitoreo

El servidor proporciona logging detallado para:
- ✅ Conexiones a base de datos
- ✅ Consultas ejecutadas
- ✅ Errores y excepciones
- ✅ Operaciones de inserción
- ✅ Análisis de estructuras

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License

---

**Nota**: Este servidor MCP es completamente genérico y puede ser usado con cualquier base de datos SQL Server. No contiene lógica específica de ningún dominio o empresa particular.