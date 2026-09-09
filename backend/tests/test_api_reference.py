"""Integration tests for reference-data endpoints (ports, origins, vessels, routes, search, status)."""


def test_list_ports_returns_seven_seeded_ports(client):
    resp = client.get("/api/ports")
    assert resp.status_code == 200
    ports = resp.json()
    assert len(ports) == 7
    codes = {p["code"] for p in ports}
    assert "INPAR" in codes  # Paradip must be present - primary demo destination


def test_get_single_port(client):
    resp = client.get("/api/ports/INPAR")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Paradip"


def test_get_unknown_port_404(client):
    resp = client.get("/api/ports/NOPE")
    assert resp.status_code == 404


def test_list_vessel_classes_returns_four(client):
    resp = client.get("/api/vessel-classes")
    assert resp.status_code == 200
    assert len(resp.json()) == 4


def test_list_routes_filterable_by_cargo(client):
    resp = client.get("/api/routes?cargo_type=Coal")
    assert resp.status_code == 200
    routes = resp.json()
    assert len(routes) > 0
    assert all(r["cargo_type"] == "Coal" for r in routes)


def test_freight_rate_history_returns_points(client):
    resp = client.get("/api/freight-rate-history?origin_code=AUNTL&cargo_type=Coal&weeks=26")
    assert resp.status_code == 200
    points = resp.json()
    assert len(points) == 26


def test_search_finds_port_by_name(client):
    resp = client.get("/api/search?q=Paradip")
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert any(r["type"] == "port" and r["code"] == "INPAR" for r in results)


def test_system_status_reports_all_components(client):
    resp = client.get("/api/status")
    assert resp.status_code == 200
    body = resp.json()
    names = {item["name"] for item in body["items"]}
    assert {"Database", "Port Data", "ML Model", "AIS Vessel Tracking"}.issubset(names)
    # AIS must be explicitly disclosed as not connected, never faked as available
    ais = next(i for i in body["items"] if i["name"] == "AIS Vessel Tracking")
    assert ais["state"] == "not_connected"
