# TaskFlow — Team Task Manager

A full-stack team task management web app with role-based access control, built with **FastAPI** (Python) and a premium dark glassmorphism frontend.

## 🚀 Live Demo

> **Railway URL**: *(add your Railway URL here after deployment)*

---

## ✨ Features

- **JWT Authentication** — Secure signup & login
- **Project Management** — Create projects, invite team members
- **Role-Based Access Control** — Admin vs Member roles per project
- **Task Tracking** — Create tasks with priority, due date & assignee
- **Kanban Board** — Visual TODO / In Progress / Done columns
- **Dashboard** — Stats: total, in-progress, done, overdue tasks
- **REST API** — Full OpenAPI docs at `/docs`

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Python 3.11 + FastAPI               |
| ORM        | SQLAlchemy 2.0                      |
| Auth       | JWT (`python-jose`) + bcrypt        |
| Database   | SQLite (dev) → MySQL (Railway)      |
| Frontend   | Vanilla HTML / CSS / JavaScript     |
| Deployment | Railway                             |

---

## 📦 Local Setup

### Prerequisites
- Python 3.10+
- pip

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/task-management.git
cd task-management
```

### 2. Create virtual environment
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment
```bash
copy .env.example .env   # Windows
cp .env.example .env      # Mac/Linux
# Edit .env and set JWT_SECRET to a strong random value
```

### 5. Run the server
```bash
uvicorn app.main:app --reload
```

Visit **http://localhost:8000** in your browser.

API docs available at **http://localhost:8000/docs**

---

## 🌐 Deploy to Railway

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/task-management.git
git push -u origin main
```

### 2. Create Railway project
1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select your repo
3. Add a **PostgreSQL** plugin (Railway → Add Plugin → PostgreSQL)

### 3. Add MySQL and set environment variables
1. In your Railway project → **+ New** → **Database** → **MySQL**
2. Link the MySQL service to your web service (Variables tab → reference MySQL vars)
3. Set these on the **web** service:

| Variable             | Value                                      |
|----------------------|--------------------------------------------|
| `MYSQLHOST`          | *(from MySQL plugin — or use `DATABASE_URL`)* |
| `MYSQLUSER`          | *(from MySQL plugin)*                      |
| `MYSQLPASSWORD`      | *(from MySQL plugin)*                      |
| `MYSQLPORT`          | `3306`                                     |
| `MYSQLDATABASE`      | *(from MySQL plugin)*                      |
| `JWT_SECRET`         | strong random string (required)            |
| `JWT_ALGORITHM`      | `HS256`                                    |
| `JWT_EXPIRE_MINUTES` | `10080`                                    |

Alternatively set a single URL:
`DATABASE_URL=mysql+pymysql://user:pass@host:3306/dbname`

> PostgreSQL also works if you set `DATABASE_URL` with a `postgresql://` URL.

### 4. Deploy
Railway auto-detects Python and runs:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

---

## 📡 API Reference

### Auth
| Method | Endpoint          | Description        |
|--------|-------------------|--------------------|
| POST   | `/api/auth/signup`| Register new user  |
| POST   | `/api/auth/login` | Login, get JWT     |
| GET    | `/api/auth/me`    | Current user info  |

### Projects
| Method | Endpoint                          | Access      |
|--------|-----------------------------------|-------------|
| GET    | `/api/projects/`                  | Auth        |
| POST   | `/api/projects/`                  | Auth        |
| GET    | `/api/projects/{id}`              | Member+     |
| PUT    | `/api/projects/{id}`              | Admin only  |
| DELETE | `/api/projects/{id}`              | Admin only  |
| POST   | `/api/projects/{id}/members`      | Admin only  |
| DELETE | `/api/projects/{id}/members/{uid}`| Admin only  |

### Tasks
| Method | Endpoint                       | Access              |
|--------|--------------------------------|---------------------|
| GET    | `/api/tasks/dashboard`         | Auth                |
| GET    | `/api/tasks/project/{id}`      | Member+             |
| POST   | `/api/tasks/project/{id}`      | Admin only          |
| PUT    | `/api/tasks/{id}`              | Admin / Assignee    |
| PATCH  | `/api/tasks/{id}/status`       | Admin / Assignee    |
| DELETE | `/api/tasks/{id}`              | Admin only          |

### Users
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | `/api/users/search`   | Search by email     |

---

## 🏗️ Project Structure

```
task-management/
├── app/
│   ├── main.py          # FastAPI app entry point
│   ├── database.py      # DB connection (SQLite/MySQL/PostgreSQL)
│   ├── models.py        # SQLAlchemy ORM models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── security.py      # JWT + bcrypt utilities
│   ├── dependencies.py  # Auth + RBAC dependencies
│   └── routers/
│       ├── auth.py
│       ├── projects.py
│       ├── tasks.py
│       └── users.py
├── frontend/
│   ├── index.html       # Login page
│   ├── signup.html      # Register page
│   ├── dashboard.html   # Main dashboard
│   ├── project.html     # Project Kanban board
│   ├── css/style.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       ├── dashboard.js
│       └── project.js
├── requirements.txt
├── Procfile
├── railway.json
└── README.md
```

---

## 🔐 Role-Based Access Control

| Action                  | Admin | Member |
|-------------------------|-------|--------|
| Create project          | ✅    | ✅     |
| Add/remove members      | ✅    | ❌     |
| Create tasks            | ✅    | ❌     |
| Update any task         | ✅    | ❌     |
| Update own task status  | ✅    | ✅     |
| Delete tasks/projects   | ✅    | ❌     |
| View project            | ✅    | ✅     |

---

## 📄 License

MIT License — free to use and modify.
