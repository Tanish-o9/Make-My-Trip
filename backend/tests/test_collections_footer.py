import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.routes import showcase

client = TestClient(app)

def test_collections_retrieval():
    # Test valid editorial collection
    response = client.get("/api/v1/showcase/collections/lesser-known-wonders")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "lesser-known-wonders"
    assert len(data["items"]) >= 2
    assert data["items"][0]["ref_type"] == "destination"

    # Test personalized collection with different users
    r1 = client.get("/api/v1/showcase/collections/handpicked-collections?user_id=1")
    r2 = client.get("/api/v1/showcase/collections/handpicked-collections?user_id=2")
    assert r1.status_code == 200
    assert r2.status_code == 200
    d1 = r1.json()["items"]
    d2 = r2.json()["items"]
    # Check ML personalization (odd vs even reversing order)
    assert d1[0]["ref_id"] != d2[0]["ref_id"]

    # Test invalid slug
    response = client.get("/api/v1/showcase/collections/invalid-slug-here")
    assert response.status_code == 404


def test_info_highlights():
    response = client.get("/api/v1/showcase/highlights")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    titles = [h["title"] for h in data]
    assert "Introducing OneCircle Membership" in titles


def test_promo_banners():
    response = client.get("/api/v1/showcase/banners/homepage_mid")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["placement"] == "homepage_mid"


def test_footer_mega_directory_and_cache():
    # Mock Redis client to verify cache write/read behavior
    mock_redis = MagicMock()
    original_redis = showcase.redis_client
    showcase.redis_client = mock_redis

    # First lookup: cache miss (mock_redis.get returns None)
    mock_redis.get.return_value = None
    response = client.get("/api/v1/showcase/footer")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    # Verify it attempted to cache it
    mock_redis.setex.assert_called_once()

    # Second lookup: cache hit
    import json
    mock_redis.get.return_value = json.dumps([{"title": "Cached Top Routes", "links": []}])
    response = client.get("/api/v1/showcase/footer")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["title"] == "Cached Top Routes"

    # Restore redis client
    showcase.redis_client = original_redis


def test_admin_crud_endpoints():
    # Create Promo Banner
    payload = {
        "background_color": "#000000",
        "headline": "Special Ad Banner Headline",
        "cta_text": "Sign Up",
        "cta_url": "/signup",
        "placement": "homepage_bottom"
    }
    response = client.post("/api/v1/showcase/banners", json=payload)
    assert response.status_code == 200
    banner = response.json()
    assert banner["headline"] == "Special Ad Banner Headline"
    banner_id = banner["id"]

    # Update Promo Banner
    update_payload = {"headline": "Updated Ad Banner Headline"}
    response = client.put(f"/api/v1/showcase/banners/{banner_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["headline"] == "Updated Ad Banner Headline"

    # Delete Promo Banner
    response = client.delete(f"/api/v1/showcase/banners/{banner_id}")
    assert response.status_code == 200
    assert "deleted" in response.json()["message"]

    # Create Footer section & link
    response = client.post("/api/v1/showcase/footer/sections?title=NewlyAddedSection")
    assert response.status_code == 200
    sec = response.json()
    assert sec["title"] == "NewlyAddedSection"
    sec_id = sec["id"]

    response = client.post(f"/api/v1/showcase/footer/links?section_id={sec_id}&label=NewlyLinkLabel&url=/newlink")
    assert response.status_code == 200
    link = response.json()
    assert link["label"] == "NewlyLinkLabel"
