from conftest import make_png, pixel_payload


def test_create_and_get_own_artwork(client, register):
    headers = register()
    res = client.post("/api/artworks", json=pixel_payload(), headers=headers)
    assert res.status_code == 201, res.text
    art = res.json()
    assert art["kind"] == "pixel"
    assert art["data"]["version"] == 1

    mine = client.get("/api/artworks/mine", headers=headers).json()
    assert mine["total"] == 1


def test_private_artwork_hidden_from_others(client, register):
    owner = register("owner")
    other = register("other")
    art_id = client.post("/api/artworks", json=pixel_payload(), headers=owner).json()["id"]

    assert client.get(f"/api/artworks/{art_id}", headers=other).status_code == 404
    assert client.get(f"/api/artworks/{art_id}").status_code == 404
    assert client.get(f"/api/artworks/{art_id}/preview.png").status_code == 404
    assert client.get("/api/gallery").json()["total"] == 0


def test_public_gallery_and_likes(client, register):
    owner = register("owner")
    fan = register("fan")
    art_id = client.post("/api/artworks", json=pixel_payload(is_public=True), headers=owner).json()[
        "id"
    ]

    gallery = client.get("/api/gallery", headers=fan).json()
    assert gallery["total"] == 1
    assert gallery["items"][0]["liked_by_me"] is False

    liked = client.post(f"/api/artworks/{art_id}/like", headers=fan).json()
    assert liked == {"like_count": 1, "liked_by_me": True}
    # повторний лайк нічого не змінює
    again = client.post(f"/api/artworks/{art_id}/like", headers=fan).json()
    assert again["like_count"] == 1

    popular = client.get("/api/gallery?sort=popular", headers=fan).json()
    assert popular["items"][0]["like_count"] == 1
    assert popular["items"][0]["liked_by_me"] is True

    unliked = client.delete(f"/api/artworks/{art_id}/like", headers=fan).json()
    assert unliked == {"like_count": 0, "liked_by_me": False}

    preview = client.get(f"/api/artworks/{art_id}/preview.png")
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/png"


def test_update_and_delete_owner_only(client, register):
    owner = register("owner")
    other = register("other")
    art_id = client.post("/api/artworks", json=pixel_payload(is_public=True), headers=owner).json()[
        "id"
    ]

    assert (
        client.patch(f"/api/artworks/{art_id}", json={"title": "Нове"}, headers=other).status_code
        == 403
    )
    res = client.patch(f"/api/artworks/{art_id}", json={"title": "Нове"}, headers=owner)
    assert res.json()["title"] == "Нове"

    assert client.delete(f"/api/artworks/{art_id}", headers=other).status_code == 403
    assert client.delete(f"/api/artworks/{art_id}", headers=owner).status_code == 204
    assert client.get(f"/api/artworks/{art_id}", headers=owner).status_code == 404


def test_upload_png(client, register):
    headers = register()
    res = client.post(
        "/api/artworks/upload",
        headers=headers,
        files={"file": ("cat.png", make_png(5, 3), "image/png")},
        data={"title": "Фото", "is_public": "true"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert (body["kind"], body["width"], body["height"], body["is_public"]) == ("image", 5, 3, True)


def test_upload_rejects_non_png(client, register):
    headers = register()
    res = client.post(
        "/api/artworks/upload",
        headers=headers,
        files={"file": ("x.png", b"definitely not a png", "image/png")},
        data={"title": "Fake"},
    )
    assert res.status_code == 415


def test_remix_public_artwork(client, register):
    owner = register("owner")
    fan = register("fan")
    art_id = client.post("/api/artworks", json=pixel_payload(is_public=True), headers=owner).json()[
        "id"
    ]
    copy = client.post(f"/api/artworks/{art_id}/duplicate", headers=fan)
    assert copy.status_code == 201
    assert copy.json()["owner"] == "fan"
    assert copy.json()["is_public"] is False


def test_profile(client, register):
    owner = register("Artist")
    client.post("/api/artworks", json=pixel_payload(is_public=True), headers=owner)
    client.post("/api/artworks", json=pixel_payload(is_public=False), headers=owner)
    profile = client.get("/api/users/artist").json()
    assert profile["username"] == "Artist"
    assert profile["public_artworks"] == 1
    assert client.get("/api/users/artist/artworks").json()["total"] == 1


def test_delete_account_cascades(client, register):
    owner = register("owner")
    client.post("/api/artworks", json=pixel_payload(is_public=True), headers=owner)
    assert client.delete("/api/users/me", headers=owner).status_code == 204
    assert client.get("/api/gallery").json()["total"] == 0
