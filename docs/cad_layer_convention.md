# CAD Demarcation & GIS Ingestion Guide

LandSentinel supports high-precision ingestion of Computer-Aided Design (CAD) and Geographic Information System (GIS) datasets to automate land acquisition boundaries, survey-number parcel schedules, and corridor alignment maps.

---

## 1. Supported File Formats

| Format | Extension | Notes |
| :--- | :--- | :--- |
| **Drawing Exchange Format** | `.dxf` | Standard exchange format from AutoCAD, Civil 3D, QGIS, MicroStation. Supported releases: R12 through 2018+. |
| **GeoJSON** | `.geojson`, `.json` | FeatureCollection containing Polygon/MultiPolygon geometries with parcel attributes. Assumes `EPSG:4326` (WGS 84) unless a CRS is explicitly declared in the file. |
| **Zipped Shapefile** | `.zip` | Archive containing `.shp`, `.shx`, `.dbf`, and optional `.prj`. File limit: 20 MB archive, 50 MB uncompressed, max 50 entries. |
| **AutoCAD Drawing** | `.dwg` | Direct binary DWG parsing is proprietary. Export or save your drawing as **DXF** in AutoCAD before uploading. |

---

## 2. DXF Layer Naming Convention

When preparing a DXF file for LandSentinel, organize geometry into the following standard CAD layers:

```
┌────────────────────────────────────────────────────────┐
│  PROJECT_BOUNDARY (Closed Polyline)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ PARCELS_PRIVATE (101/1)                          │  │
│  │ ┌────────────────┐                               │  │
│  │ │ PARCEL_LABELS  │ "101/1"                       │  │
│  │ └────────────────┘                               │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

1. **`PROJECT_BOUNDARY`**
   - **Requirement**: A single closed polyline (`LWPOLYLINE` or `POLYLINE`) representing the statutory outer corridor boundary.
   - If multiple boundary segments are uploaded, LandSentinel merges them using `unary_union`. If the result does not form a single contiguous polygon, an error is reported. (Convex hulls are never used).

2. **`PARCELS`** (or Classified Layers)
   - Closed polylines representing individual survey subdivisions.
   - Classification can be encoded directly in layer names:
     - `PARCELS_PRIVATE` &rarr; Private land (Blue in map preview)
     - `PARCELS_GOVT` &rarr; Government / Poramboke land (Amber in map preview)
     - `PARCELS_FOREST` &rarr; Reserved Forest land (Green in map preview)
     - Generic `PARCELS` &rarr; Defaults to Private; user can override per row in the UI table.

3. **`PARCEL_LABELS`**
   - `TEXT` or `MTEXT` entities placed inside each parcel polygon containing the statutory survey number (e.g. `104/1A`, `105/2B`).
   - LandSentinel uses **point-in-polygon** spatial indexing to assign each label to its enclosing parcel boundary.
   - If a polygon already contains an attribute or extended entity data (XData) with the survey number, that attribute takes precedence over text labels.

4. **Ignored Layers**
   - All other decorative layers (e.g., dimensions, title blocks, hatches, north arrows, grid lines) are automatically filtered out during ingestion.

---

## 3. Coordinate Reference System (CRS) Requirements

Engineering CAD drawings are produced in planar projected coordinate systems. LandSentinel reprojects all geometries to WGS 84 (`EPSG:4326`) for Leaflet display and spatial database storage.

### Recommended Tamil Nadu Projections:
- **`EPSG:32644` (WGS 84 / UTM Zone 44N)** &mdash; **Default**:
  Covers central, eastern, and southern Tamil Nadu:
  - Chennai, Kanchipuram, Tiruvallur, Chengalpattu, Cuddalore, Villupuram, Madurai, Tiruchirappalli, Salem, Thoothukudi, Tirunelveli.
- **`EPSG:32643` (WGS 84 / UTM Zone 43N)**:
  Covers western Tamil Nadu:
  - Coimbatore, Tiruppur, Nilgiris, Erode, Theni.
- **Custom EPSG**:
  Enter any valid EPSG authority code (e.g., `EPSG:7755`, `EPSG:7756`).

> [!IMPORTANT]
> Never guess the CRS silently. Verify your survey coordinate system prior to upload. For GeoJSON, `EPSG:4326` is assumed by default unless an internal CRS object is specified. For Shapefiles, the `.prj` file is read and compared against the selected CRS; discrepancies trigger a warning.

---

## 4. Units & Scale Factor

- **Metres** (Default): Coordinate values represent meters.
- **Feet** (International Foot: $1\text{ ft} = 0.3048\text{ m}$):
  When `feet` is selected, LandSentinel scales coordinates by $0.3048$ *before* area calculation and reprojection.
- **Header Check**:
  LandSentinel checks the DXF `$INSUNITS` header variable ($6 = \text{Meters}$, $2 = \text{Feet}$) and generates a warning if the file header disagrees with the selected units.

---

## 5. Geometric Validation & Quality Rules

Before any CAD file is committed to a project, LandSentinel generates a comprehensive validation report:

| Rule | Severity | Description |
| :--- | :--- | :--- |
| **Self-Intersection / Knot** | Warning | Evaluated via Shapely. Self-intersecting boundaries (e.g. bowtie polygons) are repaired using `make_valid`. The report details the survey number and exact area change in hectares. |
| **Duplicate Survey Numbers** | **Error (Blocking)** | More than one parcel sharing the same survey number is blocked until corrected. |
| **Disjoint Outer Boundary** | **Error (Blocking)** | Multiple `PROJECT_BOUNDARY` geometries that cannot be unioned into a single contiguous polygon. |
| **Outside Boundary Check** | **Error (Blocking)** | Any parcel falling outside the project boundary by more than a **0.5-meter tolerance** is flagged. |
| **Parcel Overlaps** | Warning | Pairs of parcels with overlapping polygons are reported with the overlapping area in hectares. |
| **Boundary Gaps & Area Discrepancy** | Warning | Compares the sum of all parcel areas against the outer boundary area. Discrepancies $>1\%$ are highlighted. |
| **Declared Area Discrepancy** | Warning | Compares CAD parcel total against the project's statutory declared land requirement. |
| **Orphan / Ambiguous Labels** | Warning | Text labels falling outside any parcel or polygons containing multiple text labels. |

---

## 6. Workflow Integration (Skipping Step 3)

1. **Step 2 (Land Requirement)**:
   - Click **`📐 Upload CAD Demarcation (DXF / GeoJSON / Shapefile)`**.
   - Select file, source CRS, and units.
   - Review interactive Leaflet map preview, validation report, and Demarcated Parcels Schedule.
   - Export CSV if needed (`Survey Number, Area (Hectares), Classification`).
   - Click **Confirm & Fill Schedule**.
2. **Auto-Complete Step 3**:
   - Ingesting a verified CAD file completes boundary demarcation automatically.
   - Click **`Skip to Step 4 (Affected People) →`** directly from Step 2.
   - In Step 3, the interactive map displays the true CAD boundary and survey subdivisions with color-coded classifications.

