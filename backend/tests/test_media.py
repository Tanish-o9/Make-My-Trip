import pytest
from io import BytesIO
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.media import Media
from app.models.core import User
from app.auth.jwt import create_access_token, hash_password

client = TestClient(app)

@pytest.fixture
def auth_headers():
    """Ensures a test admin user exists and returns standard auth headers"""
    db = SessionLocal()
    user = db.query(User).filter(User.email == "admin_media@travelos.com").first()
    if not user:
        user = User(
            email="admin_media@travelos.com",
            password_hash=hash_password("securepassword"),
            role="admin"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    token = create_access_token(data={"sub": "admin_media@travelos.com"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def dummy_image():
    """Generates 1x1 green GIF dummy image bytes to simulate multi-part uploads"""
    gif_bytes = (
        b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\xff\x00\xff\xff\xff\x21\xf9\x04"
        b"\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02"
        b"\x4c\x01\x00\x3b"
    )
    return gif_bytes


def test_upload_media_webp_and_blur_hash(dummy_image, auth_headers):
    # Upload photo
    files = {"file": ("test_pic.gif", BytesIO(dummy_image), "image/gif")}
    data = {
        "owner_type": "hotel",
        "owner_id": "MOCK_HT_1",
        "alt_text": "Mock Taj Exterior",
        "display_order": 0,
        "is_primary": False
    }
    
    response = client.post("/api/v1/media", data=data, files=files, headers=auth_headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["owner_type"] == "hotel"
    assert res_data["owner_id"] == "MOCK_HT_1"
    assert res_data["url"].endswith(".webp")
    assert "data:image/" in res_data["blur_hash_base64"]
    assert res_data["is_primary"] is True # Auto-promoted as it's the first photo


def test_primary_photo_constraints(dummy_image, auth_headers):
    # Upload Photo 1 (will be auto-primary)
    files1 = {"file": ("pic1.gif", BytesIO(dummy_image), "image/gif")}
    data1 = {"owner_type": "hotel", "owner_id": "MOCK_HT_2", "alt_text": "Photo 1"}
    resp1 = client.post("/api/v1/media", data=data1, files=files1, headers=auth_headers)
    id1 = resp1.json()["id"]
    assert resp1.json()["is_primary"] is True

    # Upload Photo 2 (is_primary = False by default)
    files2 = {"file": ("pic2.gif", BytesIO(dummy_image), "image/gif")}
    data2 = {"owner_type": "hotel", "owner_id": "MOCK_HT_2", "alt_text": "Photo 2", "is_primary": False}
    resp2 = client.post("/api/v1/media", data=data2, files=files2, headers=auth_headers)
    id2 = resp2.json()["id"]
    assert resp2.json()["is_primary"] is False

    # Promote Photo 2 to primary
    promote_resp = client.put(f"/api/v1/media/{id2}/primary", headers=auth_headers)
    assert promote_resp.status_code == 200
    
    # Sibling Photo 1 should now be demoted (is_primary = False)
    db = SessionLocal()
    photo1 = db.query(Media).filter(Media.id == id1).first()
    photo2 = db.query(Media).filter(Media.id == id2).first()
    assert photo1.is_primary is False
    assert photo2.is_primary is True
    db.close()


def test_auto_reassign_primary_on_deletion(dummy_image, auth_headers):
    # Set up entity with two photos, Photo 1 is primary
    db = SessionLocal()
    # Clean any old mock entries
    db.query(Media).filter(Media.owner_id == "MOCK_HT_3").delete()
    db.commit()
    db.close()

    files1 = {"file": ("p1.gif", BytesIO(dummy_image), "image/gif")}
    resp1 = client.post("/api/v1/media", data={"owner_type": "hotel", "owner_id": "MOCK_HT_3", "alt_text": "P1"}, files=files1, headers=auth_headers)
    id1 = resp1.json()["id"]

    files2 = {"file": ("p2.gif", BytesIO(dummy_image), "image/gif")}
    resp2 = client.post("/api/v1/media", data={"owner_type": "hotel", "owner_id": "MOCK_HT_3", "alt_text": "P2"}, files=files2, headers=auth_headers)
    id2 = resp2.json()["id"]

    # Delete primary Photo 1
    del_resp = client.delete(f"/api/v1/media/{id1}", headers=auth_headers)
    assert del_resp.status_code == 200

    # Sibling Photo 2 should be automatically promoted to primary!
    db = SessionLocal()
    photo2 = db.query(Media).filter(Media.id == id2).first()
    assert photo2.is_primary is True
    
    # Clean up
    db.delete(photo2)
    db.commit()
    db.close()
