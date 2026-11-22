# Бекенд

**Стек:** FastAPI, SQLAlchemy 2.0 (ORM), SQLite, PyJWT, bcrypt, Uvicorn, pytest.

Інтерактивна документація генерується автоматично: **`/api/docs`** (Swagger UI).
Кнопка **Authorize** приймає нік і пароль — далі всі запити з Swagger йдуть від імені цього користувача.

## Структура

```
backend/app/
├─ main.py          FastAPI(), CORS, підключення роутерів, /api/health
├─ config.py        Settings зі змінних оточення
├─ database.py      engine, SessionLocal, get_db(), init_db(); PRAGMA foreign_keys і WAL для SQLite
├─ models.py        User, Artwork, Like
├─ schemas.py       Pydantic-схеми (валідація входу, форма відповідей)
├─ security.py      hash_password / verify_password (bcrypt), create/decode JWT
├─ deps.py          DbSession, CurrentUser, OptionalUser — типізовані залежності
├─ routers/
│  ├─ auth.py       реєстрація, вхід, перевірка ніку
│  ├─ users.py      мій профіль, видалення акаунта, публічні профілі
│  ├─ artworks.py   CRUD робіт, завантаження PNG, прев'ю, лайки
│  └─ gallery.py    публічна стрічка
└─ services/
   ├─ artworks.py   спільні запити: список з лайками, перевірка прав доступу
   └─ png.py        перевірка PNG і читання розміру з заголовка IHDR (без Pillow)
```

## База даних

```
users                          artworks                              likes
─────────────────────          ───────────────────────────────       ─────────────────────
id            PK               id            PK                      user_id    PK, FK → users.id    ON DELETE CASCADE
username      «як ввели»       owner_id      FK → users.id CASCADE   artwork_id PK, FK → artworks.id ON DELETE CASCADE
username_key  UNIQUE           title         ≤ 80                    created_at
password_hash bcrypt           kind          'pixel' | 'image'
created_at                     width, height
                               frame_count
                               data          TEXT (JSON документа) — NULL для 'image'
                               preview_png   BLOB (PNG)
                               is_public     INDEX
                               created_at    INDEX
                               updated_at
```

- `username_key = username.casefold()` — по ньому перевіряється унікальність. Так «Ivan», «IVAN»
  та «іван»/«ІВАН» — це один нік. (Функція `lower()` у SQLite не розуміє кирилиці, тому нормалізуємо в Python.)
- Лайк — пара `(user_id, artwork_id)` з складеним первинним ключем: двічі лайкнути неможливо фізично.
- Каскадне видалення: видалили користувача → зникли його роботи й лайки; видалили роботу → зникли її лайки.
- Великі поля `data` і `preview_png` позначені `deferred` — у списках вони не читаються з диска.
- Таблиці створюються при старті (`Base.metadata.create_all`). Для продакшну варто додати Alembic.

## Авторизація

- **Реєстрація** — нік (3–24 символи: літери будь-якої мови, цифри, `_`, `-`) і пароль (6–72 байти).
  Відразу повертається токен.
- **Пароль** зберігається лише як bcrypt-хеш із сіллю. Ліміт 72 байти — обмеження самого bcrypt
  (кирилична літера займає 2 байти).
- **JWT** (HS256): `{"sub": "<user_id>", "iat": …, "exp": …}`, живе 7 днів (`JWT_EXPIRE_MINUTES`).
- Запити з токеном: заголовок `Authorization: Bearer <token>`.
- **Захист від перебору ніків:** при вході з неіснуючим ніком однаково виконується перевірка bcrypt
  з фіктивним хешем, тож час відповіді не видає, чи існує акаунт.
- Зарезервовані ніки (`me`, `admin`, `api`…) заборонені, щоб не конфліктувати з адресами.

## API

Усі шляхи починаються з `/api`. 🔒 — потрібен токен, 🔓 — токен необов'язковий (якщо є, у відповіді
з'явиться `liked_by_me` і доступ до власних приватних робіт).

### Auth

| Метод | Шлях | Опис | Відповідь |
|---|---|---|---|
| POST | `/auth/register` | `{username, password}` | `201` `TokenOut` · `409` нік зайнятий · `422` невалідні дані |
| POST | `/auth/login` | `{username, password}` | `200` `TokenOut` · `401` |
| POST | `/auth/token` | те саме, але `form-data` (для Swagger) | `{access_token, token_type}` |
| GET | `/auth/check-username?username=` | жива перевірка в формі | `{username, available}` |

```json
// TokenOut
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": { "id": 1, "username": "Іван", "created_at": "2026-11-22T10:00:00Z" }
}
```

### Users

| Метод | Шлях | Опис |
|---|---|---|
| GET 🔒 | `/users/me` | поточний користувач |
| DELETE 🔒 | `/users/me` | видалити акаунт (каскадом роботи й лайки) → `204` |
| GET | `/users/{username}` | `{username, created_at, public_artworks, total_likes}` |
| GET 🔓 | `/users/{username}/artworks?sort=&limit=&offset=` | публічні роботи автора |

### Artworks

| Метод | Шлях | Опис |
|---|---|---|
| GET 🔒 | `/artworks/mine?sort=updated&q=&limit=24&offset=0` | мої роботи (і приватні) |
| POST 🔒 | `/artworks` | зберегти піксель-арт (JSON нижче) → `201 ArtworkDetail` |
| POST 🔒 | `/artworks/upload` | `multipart/form-data`: `file` (PNG ≤ 2 МБ), `title`, `is_public` → `201` |
| GET 🔓 | `/artworks/{id}` | робота з документом; чужа приватна → `404` |
| PATCH 🔒 | `/artworks/{id}` | часткове оновлення будь-яких полів; не своя → `403` |
| DELETE 🔒 | `/artworks/{id}` | `204` |
| POST 🔒 | `/artworks/{id}/duplicate` | копія своєї або «ремікс» чужої публічної; копія завжди приватна |
| GET 🔓 | `/artworks/{id}/preview.png` | PNG-прев'ю з `ETag` і кешуванням для публічних |
| POST 🔒 | `/artworks/{id}/like` | поставити лайк (ідемпотентно) → `{like_count, liked_by_me}` |
| DELETE 🔒 | `/artworks/{id}/like` | прибрати лайк |

```json
// POST /api/artworks
{
  "title": "Зілля",
  "width": 16, "height": 16, "frame_count": 2,
  "is_public": true,
  "preview_png": "data:image/png;base64,iVBORw0KGgo...",
  "data": {
    "format": "pixelforge", "version": 1,
    "width": 16, "height": 16, "fps": 8,
    "layers": [{ "id": "layer_a1", "name": "Шар 1", "visible": true, "opacity": 1 }],
    "frames": [
      { "id": "frame_x", "cels": { "layer_a1": [20, 0, 4, 437918463, 232, 0] } }
    ]
  }
}
```

Пікселі в `cels` закодовані RLE: пари `[кількість, колір]`, де колір — `0xRRGGBBAA` як число.

```json
// ArtworkOut (елемент списків)
{
  "id": 7, "title": "Зілля", "kind": "pixel",
  "width": 16, "height": 16, "frame_count": 2, "is_public": true,
  "owner": "Іван", "like_count": 3, "liked_by_me": false,
  "preview_url": "/api/artworks/7/preview.png?v=1763805600",
  "created_at": "…", "updated_at": "…"
}
```

`?v=` у `preview_url` змінюється після кожного оновлення роботи — браузер не покаже застаріле прев'ю.

### Gallery

| Метод | Шлях | Опис |
|---|---|---|
| GET 🔓 | `/gallery?sort=new\|popular&q=&limit=24&offset=0` | усі публічні роботи → `{items, total, limit, offset}` |

### Службове

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/health` | `{"status": "ok", "version": "1.0.0"}` |

### Помилки

FastAPI повертає `{"detail": "текст"}` або для помилок валідації `{"detail": [{"loc": …, "msg": …}]}`.
Фронтенд (`shared/api/client.ts`) вміє показати обидва варіанти.

| Код | Коли |
|---|---|
| 401 | немає токена, токен прострочений або підроблений, неправильний пароль |
| 403 | спроба змінити чужу роботу |
| 404 | робота не існує **або** вона чужа приватна |
| 409 | нік зайнятий |
| 413 | файл або документ завеликий |
| 415 | завантажений файл — не PNG |
| 422 | невалідні дані (короткий пароль, порожня назва, розмір полотна > 128 …) |

## Тести

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

`tests/conftest.py` перед кожним тестом перестворює таблиці у тимчасовому файлі SQLite
і генерує справжній PNG без Pillow (`make_png`). Що покрито:

- реєстрація, вхід, унікальність ніку без урахування регістру (у т.ч. кирилиця), зарезервовані ніки;
- невалідний токен, короткий пароль, форма для Swagger;
- приватні роботи не видно іншим ні в API, ні в галереї, ні через прев'ю;
- лайки ідемпотентні, сортування «популярні», `liked_by_me`;
- лише власник може змінювати й видаляти;
- завантаження PNG, відхилення не-PNG;
- ремікс чужої публічної роботи;
- профіль рахує лише публічні роботи;
- видалення акаунта прибирає його роботи з галереї.
