def test_register_and_me(client, register):
    headers = register("ivan")
    res = client.get("/api/users/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["username"] == "ivan"


def test_username_is_unique_case_insensitive(client, register):
    register("Іван")
    res = client.post("/api/auth/register", json={"username": "іВАН", "password": "secret123"})
    assert res.status_code == 409


def test_reserved_username(client):
    res = client.post("/api/auth/register", json={"username": "me", "password": "secret123"})
    assert res.status_code in (409, 422)


def test_check_username(client, register):
    register("taken_name")
    assert client.get("/api/auth/check-username?username=taken_name").json()["available"] is False
    assert client.get("/api/auth/check-username?username=free_name").json()["available"] is True


def test_login(client, register):
    register("ivan", "secret123")
    ok = client.post("/api/auth/login", json={"username": "IVAN", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = client.post("/api/auth/login", json={"username": "ivan", "password": "wrong-pass"})
    assert bad.status_code == 401

    missing = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
    assert missing.status_code == 401


def test_invalid_token(client):
    res = client.get("/api/users/me", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401


def test_swagger_token_form(client, register):
    register("ivan", "secret123")
    res = client.post("/api/auth/token", data={"username": "ivan", "password": "secret123"})
    assert res.status_code == 200
    assert res.json()["token_type"] == "bearer"


def test_short_password_rejected(client):
    res = client.post("/api/auth/register", json={"username": "ivan", "password": "123"})
    assert res.status_code == 422
