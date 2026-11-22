# Встановлення та запуск

## Що потрібно

| Інструмент | Версія | Навіщо |
|---|---|---|
| Python | 3.11 або новіший | бекенд |
| Node.js | 20 LTS або новіший (разом з npm) | фронтенд |
| Docker Desktop | будь-яка свіжа | лише для запуску через Docker (необов'язково) |

Перевірити: `python --version`, `node --version`, `npm --version`.

## Запуск через Docker

```bash
cp .env.example .env      # Windows: copy .env.example .env
# відкрий .env і задай JWT_SECRET (будь-який довгий випадковий рядок)
docker compose up --build
```

Що відбувається:
1. `backend` — образ `python:3.12-slim`, ставить залежності, запускає uvicorn на порту 8000 усередині мережі Docker. База лежить у томі `pixelforge-data` (`/data/pixelforge.db`), тож переживає перезапуск.
2. `frontend` — двоетапна збірка: `node:20` збирає бандл (`npm run build`), `nginx` віддає статику й проксіює `/api/*` на `backend:8000`.

Відкрити http://localhost:8080. Swagger — http://localhost:8080/api/docs.

Зупинити: `Ctrl+C` або `docker compose down`. Стерти базу: `docker compose down -v`.

## Локальний запуск (розробка)

### Бекенд

```bash
cd backend
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

- API: http://localhost:8000/api/health
- Swagger з кнопкою **Authorize**: http://localhost:8000/api/docs
- файл бази створиться сам: `backend/data/pixelforge.db`

### Фронтенд

```bash
cd frontend
npm install
npm run dev
```

Відкрити http://localhost:5173. Запити на `/api` Vite перенаправляє на `localhost:8000`
(див. `server.proxy` у `vite.config.ts`), тому обидва сервери мають працювати одночасно.

Фронтенд працює й без бекенду: малювати, експортувати й імпортувати PNG можна; збереження,
галерея та акаунти покажуть повідомлення, що сервер недоступний.

### Інші команди

| Команда | Що робить |
|---|---|
| `npm run build` | перевірка типів + продакшн-збірка в `frontend/dist` |
| `npm run preview` | локально відкрити зібраний `dist` |
| `npm run typecheck` | лише перевірка TypeScript |
| `npm test` | юніт-тести алгоритмів (Vitest) |
| `pytest -v` (у `backend/`) | тести API |
| `ruff check .` (у `backend/`) | лінтер Python (якщо встановлено ruff) |

## PyCharm

### Відкрити проєкт

`File → Open` → вибрати **корінь** `pixelforge/` (не `backend/` і не `frontend/`).

### Python-інтерпретатор

1. `Settings → Project → Python Interpreter → Add Interpreter → Local → Virtualenv`.
2. Location: `pixelforge/backend/.venv` (або вибрати вже створений).
3. Відкрити `backend/requirements-dev.txt` — PyCharm запропонує встановити пакети, погодитись.
4. Правий клік на папці `backend` → `Mark Directory as → Sources Root`,
   щоб імпорти `from app...` не підсвічувались червоним.

### Готові конфігурації запуску

У папці `.run/` лежать конфігурації, PyCharm підхопить їх автоматично (випадний список біля ▶):

| Назва | Що запускає |
|---|---|
| **Backend (uvicorn)** | `uvicorn app.main:app --reload` з папки `backend` |
| **Backend tests (pytest)** | `pytest -v` |
| **Frontend (npm run dev)** | `npm run dev` (лише PyCharm Professional) |

Якщо PyCharm скаже, що модуль `pixelforge` не знайдено, — відкрий конфігурацію
(`Edit Configurations…`) і вибери свій інтерпретатор у полі *Python interpreter*.

### PyCharm Community vs Professional

- **Professional** повністю підтримує TypeScript/React: автодоповнення, перехід до визначень, запуск npm-скриптів.
- **Community** не має підтримки JavaScript. Код фронтенду відкриється як текст, а запускати його
  треба з терміналу (`Alt+F12` у PyCharm → `cd frontend && npm run dev`).
  Для зручного редагування фронтенду можна паралельно відкрити папку `frontend/` у VS Code.

Студентська ліцензія JetBrains (безкоштовна для студентів) дає Professional.

## Змінні оточення бекенду

| Змінна | За замовчуванням | Опис |
|---|---|---|
| `DATABASE_URL` | `sqlite:///backend/data/pixelforge.db` | шлях до бази |
| `JWT_SECRET` | `dev-secret-change-me` | секрет підпису токенів — **обов'язково змінити** поза розробкою |
| `JWT_EXPIRE_MINUTES` | `10080` (7 днів) | час життя токена |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | звідки дозволені запити з браузера |
| `MAX_UPLOAD_BYTES` | `2097152` (2 МБ) | максимальний PNG |
| `MAX_IMAGE_SIDE` | `2048` | максимальна сторона завантаженого PNG |
| `MAX_DOC_BYTES` | `3145728` (3 МБ) | максимальний JSON документа редактора |

Фронтенд має одну необов'язкову змінну: `VITE_API_URL` — адреса бекенду, якщо він на
іншому домені (наприклад, `VITE_API_URL=https://api.example.com npm run build`).

## Типові проблеми

**«Сервер недоступний» у фронтенді.** Бекенд не запущений або запущений не на 8000.
Перевір http://localhost:8000/api/health.

**`ModuleNotFoundError: No module named 'app'`.** uvicorn запущено не з папки `backend/`.
Перейди в неї (`cd backend`) або постав *Working directory* у конфігурації PyCharm.

**`npm install` падає на Windows з помилкою прав.** Закрий PyCharm/VS Code, що тримають
`node_modules`, і повтори; або запусти термінал від імені адміністратора.

**Порт 8080 або 5173 зайнятий.** У `docker-compose.yml` зміни `"8080:80"` на `"8081:80"`;
для Vite — `npm run dev -- --port 5174`.

**Після зміни `JWT_SECRET` усі вийшли з акаунтів.** Так і має бути: старі токени підписані
старим ключем і більше не дійсні. Достатньо увійти знову.

**Хочу почати з чистої бази.** Локально — видали `backend/data/pixelforge.db`.
У Docker — `docker compose down -v`.
