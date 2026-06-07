# Importadores OSINT - Consultora Diagonales

Este modulo permite alimentar la base propia OSINT con datasets abiertos o autorizados. La idea es que cada busqueda consulte primero la base acumulada y, si falta informacion, recurra a fuentes abiertas con evidencia.

## Fuentes candidatas

### IGJ / Datos Justicia Argentina

Repositorio: https://github.com/datos-justicia-argentina/Entidades-constituidas-en-la-Inspeccion-General-de-Justicia

Uso esperado:

- Sociedades y personas juridicas.
- CUIT de entidades cuando esta informado.
- Autoridades, socios, representantes y documentos.
- Domicilios y asambleas.

Comando:

```powershell
npm.cmd run osint:import -- --type igj --file "C:\ruta\igj-entidades.csv"
```

Prueba sin subir:

```powershell
npm.cmd run osint:import -- --type igj --file "C:\ruta\igj-entidades.csv" --dry-run --limit 20
```

### Padron AFIP/ARCA local o autorizado

Referencia tecnica: https://github.com/reingart/pyafipws

El proyecto `pyafipws` documenta campos del padron como CUIT, denominacion, IVA, monotributo, empleador, tipo de documento, domicilio, localidad y provincia. Si se obtiene un archivo padron autorizado o una salida CSV compatible, puede importarse asi:

```powershell
npm.cmd run osint:import -- --type afip_padron --file "C:\ruta\padron.csv"
```

### Dataset generico

Para CSV/JSON con columnas comunes (`cuit`, `dni`, `denominacion`, `razon_social`, `apellido_nombre`, `provincia`, `domicilio`):

```powershell
npm.cmd run osint:import -- --type generic --file "C:\ruta\dataset.csv"
```

## Columnas detectadas

El importador intenta detectar automaticamente:

- Identificadores: `cuit`, `cuil`, `cuit_cuil`, `nro_doc`, `numero_documento`, `dni`, `documento`.
- Nombre: `razon_social`, `denominacion`, `apellido_nombre`, `nombre`, `apellido_y_nombre`.
- Ubicacion: `provincia`, `jurisdiccion`, `calle`, `direccion`, `domicilio`, `numero`, `localidad`.

## Salida

Cada fila valida se transforma en:

- `osint_subjects`
- `osint_identifiers`
- `osint_source_runs`
- `osint_observations`
- `osint_evidence`
- `osint_reports`

La carga se hace mediante la RPC `store_osint_run`, reutilizando el mismo circuito que el rastreador OSINT.
