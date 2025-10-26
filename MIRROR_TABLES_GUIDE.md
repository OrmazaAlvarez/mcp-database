# Guía de Uso - Funcionalidad de Tablas Espejo para Bases de Datos Genéricas

## 📋 Descripción General

Esta funcionalidad permite trabajar con tablas espejo/históricas en cualquier base de datos SQL Server, proporcionando herramientas para análisis estructural e inserción inteligente de datos de prueba.

## 🎯 ¿Qué son las Tablas Espejo?

Las **tablas espejo** son tablas que replican la estructura de una tabla origen pero añaden campos adicionales para tracking de operaciones especiales:

### Casos Comunes:
- **Historial de cambios**: `Usuarios` → `HistorialUsuarios`
- **Auditoría de operaciones**: `Transacciones` → `AuditoriaTransacciones`  
- **Anulaciones**: `Pedidos` → `AnulacionPedidos`
- **Versioning**: `Productos` → `HistorialProductos`
- **Backups lógicos**: `Facturas` → `RespaldoFacturas`

### Campos Adicionales Típicos:
- `Fecha[Operacion]` - Cuándo ocurrió la operación
- `Usuario[Operacion]` - Quién ejecutó la operación  
- `Causal[Operacion]` - Por qué se realizó
- `TipoOperacion` - Qué tipo de operación
- `Observaciones` - Comentarios adicionales

## 🛠️ Herramientas Disponibles

### 1. 📊 `analyze_mirror_table_structure`

Analiza las diferencias estructurales entre una tabla origen y su tabla espejo.

**Parámetros:**
- `source_table`: Nombre de la tabla origen
- `mirror_table`: Nombre de la tabla espejo

**Ejemplo de Uso:**
```json
{
  "source_table": "Usuarios",
  "mirror_table": "HistorialUsuarios"
}
```

**Lo que hace:**
- ✅ Identifica campos comunes entre ambas tablas
- ✅ Lista campos adicionales solo en la tabla espejo
- ✅ Detecta diferencias de tipos de datos
- ✅ Proporciona recomendaciones de uso

**Output esperado:**
```
📊 Análisis de estructura entre tablas
🔗 Tabla origen: Usuarios (8 columnas)
🔗 Tabla espejo: HistorialUsuarios (11 columnas)

## 📈 Resumen de diferencias:
- Columnas comunes: 8
- Solo en origen: 0
- Solo en espejo: 3
- Tipos diferentes: 0

## ➕ Campos adicionales en tabla espejo:
- FechaModificacion (datetime) - NOT NULL
- UsuarioModificacion (varchar) - NOT NULL
- TipoOperacion (varchar) - NOT NULL
```

### 2. 🔄 `insert_mirror_table_test_data`

Inserta datos de prueba copiando registros reales y generando valores inteligentes para campos adicionales.

**Parámetros:**
- `source_table`: Tabla de donde copiar los datos
- `mirror_table`: Tabla espejo donde insertar
- `records_count`: Número de registros (1-50, por defecto 5)
- `where_condition`: Filtro opcional para la tabla origen

**Ejemplo Básico:**
```json
{
  "source_table": "Usuarios",
  "mirror_table": "HistorialUsuarios",
  "records_count": 10
}
```

**Ejemplo Avanzado con Filtros:**
```json
{
  "source_table": "Pedidos",
  "mirror_table": "AnulacionPedidos", 
  "records_count": 15,
  "where_condition": "fecha >= '2024-01-01' AND estado = 'COMPLETADO'"
}
```

**Lo que hace:**
- ✅ Copia automáticamente todos los campos comunes
- ✅ Genera valores inteligentes para campos adicionales
- ✅ Respeta tipos de datos y restricciones
- ✅ Aplica filtros personalizados a datos origen
- ✅ Valida existencia de tablas antes de proceder

## 🧠 Generación Inteligente de Valores

### Por Nombre del Campo:

#### Fechas:
- `*fecha*` → Fecha y hora actual
- `*timestamp*` → Timestamp actual  
- `*creado*`, `*modificado*` → Fecha actual

#### Usuarios:
- `*usuario*` → Usuarios aleatorios: ADMIN, SYSTEM, OPERADOR, TEST_USER
- `*creador*`, `*modificador*` → Usuarios del sistema

#### Operaciones:
- `*causal*`, `*motivo*` → ANULACION, CORRECCION, ERROR, SOLICITUD, REVISION
- `*tipo*` → Tipos de operación comunes
- `*operacion*` → CREACION, MODIFICACION, ELIMINACION

#### Comentarios:
- `*observacion*`, `*comentario*` → Textos como "Prueba automatizada", "Datos de testing"
- `*descripcion*` → Descripciones generadas automáticamente

### Por Tipo de Dato:

#### Textos:
- `varchar(n)`, `char(n)` → Cadenas alfanuméricas de longitud apropiada
- `text` → Textos descriptivos más largos

#### Números:
- `int`, `bigint` → Números enteros entre 1 y 1000
- `decimal`, `float`, `money` → Decimales con 2 posiciones
- `tinyint` → Números entre 0 y 255
- `smallint` → Números entre 0 y 32767

#### Fechas:
- `datetime`, `datetime2` → Fecha y hora actual
- `date` → Fecha actual (sin hora)
- `time` → Hora actual

#### Booleanos:
- `bit` → Valores aleatorios 0 o 1

## 📝 Ejemplos Prácticos por Dominio

### E-commerce: Productos → HistorialProductos

**Escenario**: Tracking de cambios en catálogo de productos

```json
{
  "source_table": "Productos",
  "mirror_table": "HistorialProductos",
  "records_count": 20,
  "where_condition": "precio > 100 AND categoria = 'ELECTRONICA'"
}
```

**Campos adicionales generados:**
- `FechaModificacion` → 2024-10-26 14:30:00
- `UsuarioModificacion` → ADMIN
- `TipoOperacion` → MODIFICACION
- `CampoModificado` → PRECIO

### Banking: Transacciones → AuditoriaTransacciones

**Escenario**: Auditoría de transacciones financieras

```json
{
  "source_table": "Transacciones", 
  "mirror_table": "AuditoriaTransacciones",
  "records_count": 10,
  "where_condition": "monto > 10000 AND tipo = 'TRANSFERENCIA'"
}
```

**Campos adicionales generados:**
- `FechaAuditoria` → 2024-10-26 14:30:00
- `UsuarioAuditor` → SYSTEM
- `CausalAuditoria` → REVISION
- `ObservacionesAuditoria` → Prueba automatizada

### Healthcare: Pacientes → HistorialPacientes

**Escenario**: Historial médico de pacientes

```json
{
  "source_table": "Pacientes",
  "mirror_table": "HistorialPacientes", 
  "records_count": 5,
  "where_condition": "fecha_ingreso >= '2024-01-01'"
}
```

## 🔒 Características de Seguridad

### Validaciones Implementadas:
- ✅ **Solo SELECT en origen**: No modifica datos existentes
- ✅ **Límite de registros**: Máximo 50 por operación  
- ✅ **Validación de existencia**: Verifica que ambas tablas existan
- ✅ **Sanitización de nombres**: Solo caracteres alfanuméricos y _
- ✅ **Escape de valores**: Previene inyección SQL básica
- ✅ **Logging completo**: Trazabilidad de todas las operaciones

### Límites de Seguridad:
- **Máximo 50 registros** por inserción
- **Solo tablas con nombres válidos** (a-z, 0-9, _)
- **Solo consultas SELECT** en tabla origen
- **Timeout de 30 segundos** por operación

## 🚀 Flujo de Trabajo Recomendado

### Paso 1: Análisis Previo
```json
{
  "source_table": "MiTabla",
  "mirror_table": "HistorialMiTabla"
}
```
Usa `analyze_mirror_table_structure` para entender las diferencias.

### Paso 2: Inserción de Datos
```json
{
  "source_table": "MiTabla",
  "mirror_table": "HistorialMiTabla",
  "records_count": 10,
  "where_condition": "fecha >= '2024-01-01'"
}
```
Usa `insert_mirror_table_test_data` con filtros apropiados.

### Paso 3: Verificación
```json
{
  "table_name": "HistorialMiTabla",
  "limit": 10
}
```
Usa `query_table_sample` para verificar los datos insertados.

## 🎯 Casos de Uso Avanzados

### Testing de Integridad Referencial:
```json
{
  "source_table": "Pedidos",
  "mirror_table": "PedidosEliminados",
  "where_condition": "cliente_id IN (1,2,3,4,5)"
}
```

### Simulación de Rollbacks:
```json
{
  "source_table": "ConfiguracionActual",
  "mirror_table": "ConfiguracionAnterior", 
  "records_count": 1,
  "where_condition": "version = 'ACTUAL'"
}
```

### Datos para Capacitación:
```json
{
  "source_table": "UsuariosProduccion",
  "mirror_table": "UsuariosEntrenamiento",
  "records_count": 25,
  "where_condition": "activo = 1 AND rol != 'ADMIN'"
}
```

## 🔧 Personalización Avanzada

### Extender Generación de Valores:
Para dominios específicos, el código puede ser extendido:

```typescript
// Ejemplo para dominio médico
if (lowerName.includes('diagnostico')) {
  const diagnosticos = ['HIPERTENSION', 'DIABETES', 'ASMA', 'MIGRAÑA'];
  return diagnosticos[Math.floor(Math.random() * diagnosticos.length)];
}

// Ejemplo para e-commerce
if (lowerName.includes('categoria')) {
  const categorias = ['ELECTRONICA', 'ROPA', 'HOGAR', 'DEPORTES'];
  return categorias[Math.floor(Math.random() * categorias.length)];
}
```

## 📊 Monitoreo y Logging

### Información Logged:
- ✅ Tablas analizadas y estructuras encontradas
- ✅ Número de registros copiados e insertados  
- ✅ Campos adicionales generados y sus valores
- ✅ Filtros aplicados y resultados obtenidos
- ✅ Errores y excepciones con contexto completo

### Formato de Output:
```
✅ Inserción de datos de prueba completada exitosamente

📊 Resumen:
- Tabla origen: Usuarios
- Tabla espejo: HistorialUsuarios  
- Registros insertados: 10
- Campos comunes copiados: 8
- Campos adicionales generados: 3

🔧 Campos adicionales generados:
- FechaModificacion (datetime): Valor aleatorio generado
- UsuarioModificacion (varchar): Valor aleatorio generado
- TipoOperacion (varchar): Valor aleatorio generado
```

## 🤝 Mejores Prácticas

### Antes de Usar:
1. **Analiza primero** la estructura con `analyze_mirror_table_structure`
2. **Comienza con pocos registros** (5-10) para validar
3. **Usa filtros específicos** para datos relevantes
4. **Verifica permisos** de INSERT en tabla espejo

### Durante el Uso:
1. **Revisa los logs** para detectar problemas
2. **Valida los datos** insertados antes de proceder  
3. **Usa filtros temporales** para datos recientes
4. **Mantén límites razonables** (máximo 50 registros)

### Después del Uso:
1. **Documenta los casos de prueba** generados
2. **Limpia datos obsoletos** periódicamente
3. **Monitorea el crecimiento** de tablas espejo
4. **Actualiza filtros** según sea necesario

---

## 🎉 Beneficios de esta Funcionalidad

### Para Desarrollo:
- ⚡ **Velocidad**: Generación automática de datos de prueba
- 🎯 **Realismo**: Datos basados en información real de producción
- 🛡️ **Seguridad**: Sin riesgo de corromper datos productivos
- 🔧 **Flexibilidad**: Configuración por caso de uso

### Para Testing:
- 🧪 **Cobertura**: Datos diversos para diferentes escenarios
- 📈 **Escalabilidad**: Fácil generar volúmenes variables
- 🔄 **Repetibilidad**: Procesos documentados y automatizados
- ✅ **Validación**: Datos coherentes con estructura real

### Para el Negocio:
- 📚 **Capacitación**: Datos realistas sin exposición de información sensible
- 🔍 **Análisis**: Patrones de datos para entender comportamientos  
- 📊 **Reportes**: Datos de prueba para validar dashboards
- 🚀 **Innovación**: Experimentación segura con nuevas funcionalidades

Esta funcionalidad es **completamente genérica** y puede aplicarse a cualquier dominio o industria que use SQL Server como base de datos.