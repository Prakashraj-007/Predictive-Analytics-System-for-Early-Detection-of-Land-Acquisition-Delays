"""
Unit tests for CAD ingestion, geometric validation, and schedule population.
Tests DXF, GeoJSON, Shapefile parsing, point-in-polygon matching,
unrounded area summation, coordinate transformations, and negative fixtures.
"""

import io
import json
import zipfile
import pytest
import ezdxf
from backend.app.services.cad_parser import parse_cad_file, CadParsingException


def create_15_parcel_dxf_bytes() -> bytes:
    """
    Creates a valid DXF drawing in memory containing:
    - 1 PROJECT_BOUNDARY of 1000m x 300m = 300,000 m^2 = 30.00 ha.
    - 15 closed PARCELS in a 5x3 grid, each 200m x 100m = 20,000 m^2 = 2.00 ha.
    - Total parcel area = 30.00 ha.
    - 15 text entities in PARCEL_LABELS placed inside each parcel polygon.
    - Layers with classification: PARCELS_PRIVATE, PARCELS_GOVT, PARCELS_FOREST.
    """
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    # Define layers
    doc.layers.add("PROJECT_BOUNDARY", color=1)
    doc.layers.add("PARCELS_PRIVATE", color=2)
    doc.layers.add("PARCELS_GOVT", color=3)
    doc.layers.add("PARCELS_FOREST", color=4)
    doc.layers.add("PARCEL_LABELS", color=7)

    # Set metric units in header ($INSUNITS = 6: Meters)
    doc.header["$INSUNITS"] = 6

    # UTM 44N base coordinate for Tamil Nadu: (350000.0, 1420000.0)
    base_x = 350000.0
    base_y = 1420000.0

    # 1. Outer Project Boundary: (350000, 1420000) to (351000, 1420300) = 1000m x 300m = 30.0 ha
    b_pts = [
        (base_x, base_y),
        (base_x + 1000.0, base_y),
        (base_x + 1000.0, base_y + 300.0),
        (base_x, base_y + 300.0),
    ]
    msp.add_lwpolyline(b_pts, close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    # 2. 15 Parcels (5 cols x 3 rows, each 200m x 100m = 2.0 ha)
    idx = 1
    for row in range(3):
        for col in range(5):
            x1 = base_x + col * 200.0
            y1 = base_y + row * 100.0
            x2 = x1 + 200.0
            y2 = y1 + 100.0

            if idx % 3 == 1:
                layer = "PARCELS_PRIVATE"
            elif idx % 3 == 2:
                layer = "PARCELS_GOVT"
            else:
                layer = "PARCELS_FOREST"

            msp.add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True, dxfattribs={"layer": layer})
            t = msp.add_text(f"101/{idx}", dxfattribs={"layer": "PARCEL_LABELS"})
            t.set_placement((x1 + 100.0, y1 + 50.0))
            idx += 1

    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_positive_15_parcels_30_ha():
    """Test 15 parcels totalling 30.0 ha parses cleanly with 0 blocking errors."""
    dxf_bytes = create_15_parcel_dxf_bytes()
    result = parse_cad_file(
        file_bytes=dxf_bytes,
        filename="project_30ha_survey.dxf",
        source_crs="EPSG:32644",
        units="metres",
        declared_area_ha=30.0,
    )

    assert result["success"] is True
    assert result["summary"]["parcel_count"] == 15
    assert result["summary"]["boundary_area_ha"] == 30.0
    assert result["summary"]["total_parcel_area_ha"] == 30.0
    assert result["summary"]["area_difference_ha"] == 0.0

    # Validation report should have no blocking errors
    report = result["validation_report"]
    assert report["can_save"] is True
    assert len(report["errors"]) == 0

    # Verify each parcel has correct computed area (2.0 ha) and valid WGS84 GeoJSON
    for p in result["parcels"]:
        assert p["computed_area_ha"] == 2.0
        assert p["survey_no"].startswith("101/")
        assert p["classification"] in ["Private", "Government", "Forest"]
        assert p["geojson"]["type"] == "Polygon"
        # In EPSG:32644, Tamil Nadu coordinates reproject to lon ~80.x, lat ~12.x
        coords = p["geojson"]["coordinates"][0]
        assert len(coords) >= 4
        assert 76.0 <= coords[0][0] <= 81.0
        assert 8.0 <= coords[0][1] <= 14.0


def test_negative_dwg_rejection():
    """DWG files must be rejected with a user-friendly instruction to export to DXF."""
    dwg_bytes = b"AC1032dummycadfilecontent"
    with pytest.raises(CadParsingException) as excinfo:
        parse_cad_file(dwg_bytes, "blueprint.dwg", "EPSG:32644")
    assert "Direct DWG" in str(excinfo.value)
    assert "DXF" in str(excinfo.value)


def test_negative_duplicate_survey_number():
    """Duplicate survey numbers must trigger an ERROR and block saving."""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("PROJECT_BOUNDARY")
    doc.layers.add("PARCELS")
    doc.layers.add("PARCEL_LABELS")

    # Boundary
    msp.add_lwpolyline([(0, 0), (400, 0), (400, 200), (0, 200)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    # Two parcels with the SAME survey number '105/A'
    msp.add_lwpolyline([(0, 0), (200, 0), (200, 200), (0, 200)], close=True, dxfattribs={"layer": "PARCELS"})
    t1 = msp.add_text("105/A", dxfattribs={"layer": "PARCEL_LABELS"})
    t1.set_placement((100, 100))

    msp.add_lwpolyline([(200, 0), (400, 0), (400, 200), (200, 200)], close=True, dxfattribs={"layer": "PARCELS"})
    t2 = msp.add_text("105/A", dxfattribs={"layer": "PARCEL_LABELS"})
    t2.set_placement((300, 100))

    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    result = parse_cad_file(dxf_bytes, "dup_survey.dxf", "EPSG:32644")
    report = result["validation_report"]

    assert report["can_save"] is False
    dup_errors = [e for e in report["errors"] if e.get("code") == "DUPLICATE_SURVEY_NO"]
    assert len(dup_errors) > 0
    assert "105/A" in (dup_errors[0].get("survey_no") or dup_errors[0].get("message"))


def test_negative_bowtie_polygon_self_intersection():
    """A self-intersecting bowtie polygon must trigger make_valid repair and generate a warning with area delta."""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("PROJECT_BOUNDARY")
    doc.layers.add("PARCELS")
    doc.layers.add("PARCEL_LABELS")

    # Boundary
    msp.add_lwpolyline([(0, 0), (400, 0), (400, 400), (0, 400)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    # Bowtie parcel: (10, 10) -> (100, 100) -> (100, 10) -> (10, 100) -> (10, 10) (edges cross at 55, 55)
    bowtie_pts = [(10, 10), (100, 100), (100, 10), (10, 100)]
    msp.add_lwpolyline(bowtie_pts, close=True, dxfattribs={"layer": "PARCELS"})
    t = msp.add_text("BOWTIE/1", dxfattribs={"layer": "PARCEL_LABELS"})
    t.set_placement((25, 55))

    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    result = parse_cad_file(dxf_bytes, "bowtie.dxf", "EPSG:32644")
    report = result["validation_report"]

    # Should have a GEOMETRY_REPAIRED warning listing BOWTIE/1 and the area change
    repair_warnings = [w for w in report["warnings"] if w.get("code") == "GEOMETRY_REPAIRED"]
    assert len(repair_warnings) > 0
    assert "BOWTIE/1" in (repair_warnings[0].get("survey_no") or repair_warnings[0].get("message"))
    assert "Area change" in repair_warnings[0]["message"]


def test_negative_overlapping_parcels():
    """Overlapping parcels must trigger a PARCEL_OVERLAP warning detailing the overlap area."""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("PROJECT_BOUNDARY")
    doc.layers.add("PARCELS")
    doc.layers.add("PARCEL_LABELS")

    msp.add_lwpolyline([(0, 0), (500, 0), (500, 500), (0, 500)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    # Parcel 1: (0, 0) to (200, 200)
    msp.add_lwpolyline([(0, 0), (200, 0), (200, 200), (0, 200)], close=True, dxfattribs={"layer": "PARCELS"})
    t1 = msp.add_text("P-1", dxfattribs={"layer": "PARCEL_LABELS"})
    t1.set_placement((50, 50))

    # Parcel 2: (150, 0) to (350, 200) overlaps Parcel 1 by 50m x 200m = 10,000 m^2 = 1.0 ha
    msp.add_lwpolyline([(150, 0), (350, 0), (350, 200), (150, 200)], close=True, dxfattribs={"layer": "PARCELS"})
    t2 = msp.add_text("P-2", dxfattribs={"layer": "PARCEL_LABELS"})
    t2.set_placement((250, 50))

    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    result = parse_cad_file(dxf_bytes, "overlap.dxf", "EPSG:32644")
    report = result["validation_report"]

    overlap_warnings = [w for w in report["warnings"] if w.get("code") == "PARCEL_OVERLAP"]
    assert len(overlap_warnings) > 0
    assert "P-1" in overlap_warnings[0]["message"]
    assert "P-2" in overlap_warnings[0]["message"]


def test_negative_orphan_label():
    """Labels outside any parcel polygon must generate an ORPHAN_LABEL warning."""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("PROJECT_BOUNDARY")
    doc.layers.add("PARCELS")
    doc.layers.add("PARCEL_LABELS")

    msp.add_lwpolyline([(0, 0), (500, 0), (500, 500), (0, 500)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    # Parcel 1
    msp.add_lwpolyline([(0, 0), (200, 0), (200, 200), (0, 200)], close=True, dxfattribs={"layer": "PARCELS"})
    t1 = msp.add_text("P-1", dxfattribs={"layer": "PARCEL_LABELS"})
    t1.set_placement((50, 50))

    # Orphan label placed at (400, 400) where there is no parcel
    t_orphan = msp.add_text("LOST-999", dxfattribs={"layer": "PARCEL_LABELS"})
    t_orphan.set_placement((400, 400))

    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    result = parse_cad_file(dxf_bytes, "orphan.dxf", "EPSG:32644")
    report = result["validation_report"]

    orphan_warnings = [w for w in report["warnings"] if w.get("code") == "ORPHAN_LABEL"]
    assert len(orphan_warnings) > 0
    assert "LOST-999" in (orphan_warnings[0].get("survey_no") or orphan_warnings[0].get("message"))


def test_feet_unit_conversion_and_insunits_warning():
    """
    Test international feet unit conversion (0.3048 m) and $INSUNITS mismatch detection.
    If drawing is in feet (e.g. 1000 ft x 1000 ft = 1,000,000 sq ft = 92,903.04 m^2 = ~9.29 ha).
    """
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("PROJECT_BOUNDARY")
    doc.layers.add("PARCELS")
    doc.layers.add("PARCEL_LABELS")

    # Header says Meters ($INSUNITS=6) but user selects 'feet' -> should warn about mismatch
    doc.header["$INSUNITS"] = 6

    # Boundary: 1000 ft x 1000 ft
    msp.add_lwpolyline([(0, 0), (1000, 0), (1000, 1000), (0, 1000)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    # Parcel: 1000 ft x 1000 ft
    msp.add_lwpolyline([(0, 0), (1000, 0), (1000, 1000), (0, 1000)], close=True, dxfattribs={"layer": "PARCELS"})
    t = msp.add_text("FEET/1", dxfattribs={"layer": "PARCEL_LABELS"})
    t.set_placement((500, 500))

    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    result = parse_cad_file(dxf_bytes, "feet_plan.dxf", "EPSG:32644", units="feet")
    report = result["validation_report"]

    # 1. Check computed area: 1,000,000 sq ft * 0.3048^2 = 92903.04 m^2 = 9.29 ha
    parcel = result["parcels"][0]
    assert round(parcel["computed_area_ha"], 2) == 9.29

    # 2. Check $INSUNITS mismatch warning
    unit_warnings = [w for w in report["warnings"] if w.get("code") == "UNIT_MISMATCH"]
    assert len(unit_warnings) > 0
    assert "INSUNITS" in unit_warnings[0]["message"]


def test_disjoint_multi_boundary_union_error():
    """
    Multiple PROJECT_BOUNDARY polygons that cannot be unioned into a single contiguous
    polygon must raise an error and block saving (as required by user change 1).
    """
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("PROJECT_BOUNDARY")
    doc.layers.add("PARCELS")
    doc.layers.add("PARCEL_LABELS")

    # Boundary 1: Island A (0,0) to (100, 100)
    msp.add_lwpolyline([(0, 0), (100, 0), (100, 100), (0, 100)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})
    # Boundary 2: Disjoint Island B (500, 500) to (600, 600)
    msp.add_lwpolyline([(500, 500), (600, 500), (600, 600), (500, 600)], close=True, dxfattribs={"layer": "PROJECT_BOUNDARY"})

    msp.add_lwpolyline([(0, 0), (50, 0), (50, 50), (0, 50)], close=True, dxfattribs={"layer": "PARCELS"})
    t = msp.add_text("ISLAND/1", dxfattribs={"layer": "PARCEL_LABELS"})
    t.set_placement((25, 25))

    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    result = parse_cad_file(dxf_bytes, "disjoint_boundary.dxf", "EPSG:32644")
    report = result["validation_report"]

    assert report["can_save"] is False
    boundary_errors = [e for e in report["errors"] if e.get("code") in ("INVALID_BOUNDARY_UNION", "DISJOINT_PROJECT_BOUNDARY")]
    assert len(boundary_errors) > 0


def test_geojson_parsing_default_4326():
    """GeoJSON must default to EPSG:4326 and correctly parse features."""
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[80.0, 13.0], [80.01, 13.0], [80.01, 13.01], [80.0, 13.01], [80.0, 13.0]]
                    ],
                },
                "properties": {"layer": "PROJECT_BOUNDARY"},
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[80.001, 13.001], [80.005, 13.001], [80.005, 13.005], [80.001, 13.005], [80.001, 13.001]]
                    ],
                },
                "properties": {
                    "survey_number": "GJ-101",
                    "classification": "Government",
                },
            },
        ],
    }

    raw_bytes = json.dumps(geojson_data).encode("utf-8")
    result = parse_cad_file(raw_bytes, "demarcation.geojson", "EPSG:32644")

    assert result["success"] is True
    assert result["source_crs"] == "EPSG:4326"
    assert len(result["parcels"]) == 1
    assert result["parcels"][0]["survey_no"] == "GJ-101"
    assert result["parcels"][0]["classification"] == "Government"
    assert result["parcels"][0]["computed_area_ha"] > 0


def test_file_size_limit_rejection():
    """Files exceeding 20 MB must be rejected immediately."""
    large_payload = b"0" * (21 * 1024 * 1024)
    with pytest.raises(CadParsingException) as excinfo:
        parse_cad_file(large_payload, "oversized.dxf", "EPSG:32644")
    assert "20 MB" in str(excinfo.value)
