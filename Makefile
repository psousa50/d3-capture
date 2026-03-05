.PHONY: dev dev-debug dev-log build start lint install db db-stop db-migrate db-deploy db-studio db-reset clean

dev:
	npm run dev

dev-debug:
	npm run dev:debug

dev-log:
	npm run dev:debug:log

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

install:
	npm install

# Database
db:
	docker compose up -d

db-stop:
	docker compose down

db-migrate:
	npx prisma migrate dev

db-deploy:
	npx prisma migrate deploy

db-studio:
	npx prisma studio

db-reset:
	npx prisma migrate reset

# Housekeeping
clean:
	rm -rf .next node_modules

help:
	@echo "Development:"
	@echo "  make dev          Start dev server"
	@echo "  make dev-debug    Start dev server with debug logging (pretty-printed)"
	@echo "  make dev-log      Start dev server with debug logging to file"
	@echo "  make build        Build for production"
	@echo "  make start        Start production server (runs migrations first)"
	@echo "  make lint         Run ESLint"
	@echo "  make install      Install dependencies"
	@echo ""
	@echo "Database:"
	@echo "  make db           Start PostgreSQL container"
	@echo "  make db-stop      Stop PostgreSQL container"
	@echo "  make db-migrate   Create and apply a new migration"
	@echo "  make db-deploy    Apply pending migrations"
	@echo "  make db-studio    Open Prisma Studio"
	@echo "  make db-reset     Reset database (destructive)"
	@echo ""
	@echo "Housekeeping:"
	@echo "  make clean        Remove .next and node_modules"
