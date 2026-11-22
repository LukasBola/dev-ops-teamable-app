# Teamable — lokalne uruchomienie i zadania dev.
# `make` lub `make help` wypisuje dostępne komendy.
#
# Wymaga: Node 20.6+ (flaga --env-file-if-exists), Docker (MongoDB + testy).
# MONGODB_URI, BETTER_AUTH_* itp. czytane są z backend/.env, a docker compose czyta .env —
# oba tworzy `make env` z plików *.example, z wygenerowanym sekretem.

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose -f backend/docker-compose.yml

.PHONY: help install env up down clean migrate seed user dev e2e test

help: ## Pokaż tę listę komend
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Zainstaluj zależności (backend + frontend)
	npm --prefix backend install
	npm --prefix frontend install

env: ## Utwórz backend/.env i .env (compose) z przykładów, z nowym BETTER_AUTH_SECRET (istniejących nie rusza)
	@for f in backend/.env .env; do \
		test -f $$f && continue; \
		sed "s|^BETTER_AUTH_SECRET=$$|BETTER_AUTH_SECRET=$$(openssl rand -base64 32)|" $$f.example > $$f; \
		echo "Utworzono $$f (z wygenerowanym BETTER_AUTH_SECRET)"; \
	done

up: env ## Start MongoDB w tle (czeka, aż baza będzie gotowa)
	$(COMPOSE) up -d --wait

down: ## Zatrzymaj MongoDB (dane w wolumenie zostają)
	$(COMPOSE) down

clean: ## Zatrzymaj MongoDB i usuń dane (wolumen)
	$(COMPOSE) down -v

migrate: up ## Zastosuj migracje bazy
	npm --prefix backend run migrate:up

seed: migrate ## Konto demo z DEMO_USER_EMAIL/DEMO_USER_PASSWORD (backend/.env); ponowny seed resetuje mu hasło i profil
	npm --prefix backend run seed

user: migrate ## Konta: make user ARGS="create|delete|set-password --email a@x.pl [--password ...]"
	npm --prefix backend run user -- $(ARGS)

dev: up migrate ## Start: Mongo + migracje + backend (:3001) i frontend (:5173). Dane z bazy zostają.
	@echo ">> backend http://localhost:3001  |  frontend http://localhost:5173   (Ctrl+C zatrzymuje oba)"
	@trap 'kill 0' INT TERM EXIT; \
		npm --prefix backend run dev & \
		npm --prefix frontend run dev & \
		wait

e2e: ## Pełne testy E2E (kontener Mongo + migrate + Playwright)
	npm --prefix backend run test:e2e

test: ## Testy jednostkowe/integracyjne (backend wymaga Dockera)
	npm --prefix backend test
	npm --prefix frontend run test:unit -- --run
