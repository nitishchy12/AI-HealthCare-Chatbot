# HealthBot — Makefile
# Usage: make <target>
# Requires: Docker, Node 20, Python 3.11

.PHONY: dev infra stop test lint migrate seed seed-qdrant ai logs clean help

## ── Dev workflow ──────────────────────────────────────────────────

dev: infra          ## Start full dev stack (infra in Docker, services local)
	@echo "\n\033[32m✓ Infra running. Starting services...\033[0m"
	@$(MAKE) -j3 _backend _frontend _aiservice

infra:              ## Start databases only (Postgres, Mongo, Redis, Qdrant)
	docker compose up -d postgres mongodb redis qdrant
	@echo "\033[32m✓ Waiting for health checks...\033[0m"
	@sleep 10

_backend:
	cd backend && npm run dev

_frontend:
	cd frontend && npm run dev

_aiservice:
	cd ai-service && uvicorn main:app --reload --port 8000

stop:               ## Stop all Docker containers
	docker compose down

## ── Full Docker stack ─────────────────────────────────────────────

docker-up:          ## Start all services via Docker Compose
	docker compose --profile app up --build

docker-down:        ## Stop and remove all containers
	docker compose --profile app down

## ── Database ──────────────────────────────────────────────────────

migrate:            ## Run SQL migrations
	cd backend && npm run migrate

seed:               ## Seed hospitals, diseases, health tips
	cd backend && npm run seed

seed-qdrant:        ## Seed Qdrant vector DB with medical knowledge
	cd ai-service && python scripts/seed_knowledge.py

migrate-mongo:      ## Migrate old chats collection to conversations+messages
	cd backend && node scripts/migrate-mongo-chats.js

## ── Testing ───────────────────────────────────────────────────────

test:               ## Run all tests (backend Jest + AI service pytest)
	@echo "\033[36mRunning backend tests...\033[0m"
	cd backend && npm test -- --forceExit
	@echo "\033[36mRunning AI service tests...\033[0m"
	cd ai-service && python -m pytest tests/ -v --tb=short

test-backend:       ## Backend tests only
	cd backend && npm test -- --forceExit

test-ai:            ## AI service tests only
	cd ai-service && python -m pytest tests/ -v --tb=short

eval:               ## Run agent evaluation (golden dataset)
	cd ai-service && python eval/evaluate.py

## ── Linting ───────────────────────────────────────────────────────

lint:               ## Lint all services
	cd backend && npx eslint src/ --ext .js 2>/dev/null || true
	cd frontend && npx eslint src/ --ext .jsx,.js 2>/dev/null || true
	cd ai-service && python -m flake8 . --max-line-length=120 2>/dev/null || true

## ── Logs ──────────────────────────────────────────────────────────

logs:               ## Tail all Docker container logs
	docker compose logs -f

logs-backend:       ## Tail backend logs only
	docker compose logs -f backend

logs-ai:            ## Tail ai-service logs only
	docker compose logs -f ai-service

## ── Cleanup ───────────────────────────────────────────────────────

clean:              ## Remove all Docker volumes and containers (DESTRUCTIVE)
	@echo "\033[31mThis will delete all data volumes. Press Ctrl+C to cancel, Enter to continue.\033[0m"
	@read _
	docker compose down -v --remove-orphans
	@echo "\033[32m✓ Clean complete.\033[0m"

## ── Help ──────────────────────────────────────────────────────────

help:               ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'
