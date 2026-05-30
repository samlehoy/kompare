from fastapi.testclient import TestClient

from backend.app import app


client = TestClient(app)


def test_health_reports_pc_builder_runtime_counts_only():
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "components_loaded" in body
    assert "products_loaded" not in body


def test_legacy_generic_product_api_surface_is_not_exposed():
    checks = [
        ("GET", "/products"),
        ("GET", "/products/example-sku"),
        ("POST", "/products"),
        ("POST", "/products/identify"),
        ("POST", "/products/example-sku/enrich"),
        ("POST", "/chat"),
        ("GET", "/recommend/use-cases"),
        ("POST", "/recommend/best-value"),
        ("GET", "/compare/criteria"),
        ("POST", "/compare"),
    ]

    for method, path in checks:
        response = client.request(method, path, json={})
        assert response.status_code == 404, f"{method} {path} should not be part of the PC Builder API"


def test_pc_builder_api_surface_remains_available():
    expected_routes = {
        ("GET", "/health"),
        ("GET", "/components"),
        ("GET", "/build/use-cases"),
        ("GET", "/build/allocation-presets"),
        ("GET", "/build/budget-tiers"),
        ("POST", "/build/recommend"),
        ("POST", "/build/ai-recommend"),
        ("POST", "/build/upgrade"),
        ("POST", "/build/swap-candidates"),
        ("POST", "/build/swap"),
        ("POST", "/build/advisor"),
        ("POST", "/build/audit"),
    }
    actual_routes = {
        (method, route.path)
        for route in app.routes
        for method in getattr(route, "methods", set())
    }

    assert expected_routes.issubset(actual_routes)


def test_allocation_presets_endpoint_exposes_strategy_metadata():
    response = client.get("/build/allocation-presets")

    assert response.status_code == 200
    body = response.json()
    assert body["slots"] == [
        "cpu",
        "gpu",
        "ram",
        "motherboard",
        "ssd",
        "psu",
        "case",
        "cpu_cooler",
        "fan_cooler",
    ]
    assert body["profiles"]["gaming"]["gpu"] == 33
    assert body["priority_shifts"]["gaming"]["gpu"] == 4
    assert body["priority_shifts"]["productivity"]["cpu"] == 5
    assert body["strategy_shifts"]["maximize"]["gpu"] == 3
    assert body["strategy_shifts"]["value"]["ssd"] == 2


def test_recommend_build_forwards_budget_strategy_fields(monkeypatch):
    by_cat = {"cpu": [{"id": "cpu-1"}]}

    def fake_components_by_category():
        return by_cat

    def fake_compose_build(
        components_by_category,
        budget_idr,
        use_case,
        *,
        cpu_brand=None,
        gpu_vendor=None,
        include_optional_addons=False,
        optional_addon_slots=None,
        budget_strategy=None,
        performance_priority=None,
        allocation_overrides=None,
    ):
        assert components_by_category is by_cat
        assert budget_idr == 22_000_000
        assert use_case == "gaming"
        assert cpu_brand == "AMD"
        assert gpu_vendor == "Nvidia"
        assert include_optional_addons is False
        assert optional_addon_slots == []
        assert budget_strategy == "maximize"
        assert performance_priority == "gaming"
        assert allocation_overrides == {"cpu": 20, "gpu": 35, "ram": 10, "motherboard": 10, "ssd": 10, "psu": 8, "case": 4, "cpu_cooler": 2, "fan_cooler": 1}
        return {
            "budget_idr": budget_idr,
            "use_case": use_case,
            "budget_strategy": budget_strategy,
            "performance_priority": performance_priority,
            "components": {"cpu": {"id": "cpu-1"}},
        }

    monkeypatch.setattr("backend.app.services.components_by_category", fake_components_by_category)
    monkeypatch.setattr("backend.app.compose_build", fake_compose_build)

    response = client.post(
        "/build/recommend",
        json={
            "budget_idr": 22_000_000,
            "use_case": "gaming",
            "cpu_brand": "AMD",
            "gpu_vendor": "Nvidia",
            "selected_optional_addons": [],
            "budget_strategy": "maximize",
            "performance_priority": "gaming",
            "allocation_overrides": {
                "cpu": 20,
                "gpu": 35,
                "ram": 10,
                "motherboard": 10,
                "ssd": 10,
                "psu": 8,
                "case": 4,
                "cpu_cooler": 2,
                "fan_cooler": 1,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["budget_strategy"] == "maximize"


def test_ai_recommend_uses_experimental_composer(monkeypatch):
    by_cat = {"cpu": [{"id": "cpu-1"}]}

    def fake_components_by_category():
        return by_cat

    def fake_compose_ai_build(
        components_by_category,
        budget_idr,
        use_case,
        *,
        cpu_brand=None,
        gpu_vendor=None,
        include_optional_addons=False,
        optional_addon_slots=None,
        profile_name=None,
        budget_strategy=None,
        performance_priority=None,
        allocation_overrides=None,
    ):
        assert components_by_category is by_cat
        assert budget_idr == 15_000_000
        assert use_case == "gaming"
        assert cpu_brand == "AMD"
        assert gpu_vendor == "Nvidia"
        assert include_optional_addons is True
        assert optional_addon_slots == ["hdd", "ups"]
        assert profile_name == "local_qwen"
        assert budget_strategy == "maximize"
        assert performance_priority == "gaming"
        assert allocation_overrides is None
        return {
            "budget_idr": budget_idr,
            "use_case": use_case,
            "fallback": True,
            "retrieval": {"profile": profile_name},
            "validation_source": "deterministic",
            "components": {"cpu": {"id": "cpu-1"}},
        }

    monkeypatch.setattr("backend.app.services.components_by_category", fake_components_by_category)
    monkeypatch.setattr("backend.app.compose_ai_build", fake_compose_ai_build)

    response = client.post(
        "/build/ai-recommend",
        json={
            "budget_idr": 15_000_000,
            "use_case": "gaming",
            "cpu_brand": "AMD",
            "gpu_vendor": "Nvidia",
            "include_optional_addons": True,
            "selected_optional_addons": ["hdd", "ups"],
            "ai_profile": "local_qwen",
            "budget_strategy": "maximize",
            "performance_priority": "gaming",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["fallback"] is True
    assert body["retrieval"]["profile"] == "local_qwen"
    assert body["validation_source"] == "deterministic"
    assert body["components"]["cpu"]["id"] == "cpu-1"


def test_ai_recommend_rejects_unknown_use_case():
    response = client.post(
        "/build/ai-recommend",
        json={"budget_idr": 15_000_000, "use_case": "unknown"},
    )

    assert response.status_code == 400
    assert "Unknown use_case" in response.json()["detail"]
