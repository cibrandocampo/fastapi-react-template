# Every project command runs in Docker (CLAUDE.md §9).
DC      := docker compose --env-file .env -f dev/docker-compose.yml
BACKEND := $(DC) exec -T backend
FRONTEND := $(DC) exec -T frontend
PY_IMG  := python:3.14-slim
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

.PHONY: help init dev-up dev-down dev-logs dev-ps lock db-migrate db-revision \
        test-backend coverage-backend lint-backend format-backend \
        test-frontend lint-frontend format-frontend build-frontend test lint

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

init: ## First setup: create .env from the example and start the dev stack
	@test -f .env || cp .env.example .env
	$(MAKE) dev-up

dev-up: ## Start the dev stack (builds images if needed) and wait until healthy
	$(DC) up -d --build --wait

dev-down: ## Stop the dev stack
	$(DC) down

dev-logs: ## Follow the dev stack logs
	$(DC) logs -f

dev-ps: ## Show the dev services
	$(DC) ps

lock: ## Recompile backend requirements with hashes
	docker run --rm -v "$(CURDIR)/backend:/app" -w /app $(PY_IMG) sh -c "\
	  pip install -q --root-user-action=ignore pip-tools && \
	  pip-compile -q --generate-hashes --strip-extras --allow-unsafe -o requirements.txt requirements.in && \
	  pip-compile -q --generate-hashes --strip-extras --allow-unsafe -o requirements-dev.txt requirements-dev.in && \
	  chown $(HOST_UID):$(HOST_GID) requirements.txt requirements-dev.txt"

db-migrate: ## Apply migrations to the dev database
	$(BACKEND) alembic upgrade head

db-revision: ## Create a migration from the models: make db-revision m="add users"
	$(BACKEND) alembic revision --autogenerate -m "$(m)"

test-backend: ## Backend tests
	$(BACKEND) pytest -q

coverage-backend: ## Backend tests with coverage (fails under the threshold)
	$(BACKEND) sh -c "coverage run -m pytest -q && coverage report"

lint-backend: ## Backend lint and format check
	$(BACKEND) sh -c "ruff check . && ruff format --check ."

format-backend: ## Format the backend and apply safe lint fixes
	$(BACKEND) sh -c "ruff format . && ruff check --fix ."

test-frontend: ## Frontend tests with coverage (fails under the thresholds)
	$(FRONTEND) npm run test:coverage

lint-frontend: ## Frontend lint and format check
	$(FRONTEND) sh -c "npm run lint && npm run format:check"

format-frontend: ## Format the frontend
	$(FRONTEND) npm run format

build-frontend: ## Production build of the frontend (checks it compiles)
	$(FRONTEND) npm run build

test: coverage-backend test-frontend ## All unit tests

lint: lint-backend lint-frontend ## All linters
