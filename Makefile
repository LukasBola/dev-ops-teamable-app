# Teamable — lokalne uruchomienie i zadania dev.
# `make` lub `make help` wypisuje dostępne komendy.
#
# Wymaga: Node 20.6+ (flaga --env-file-if-exists), Docker (MongoDB + testy).
# MONGODB_URI itp. czytane są z backend/.env (tworzony z .env.example przez `make env`).

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose -f backend/docker-compose.yml

.PHONY: help install env up down clean migrate seed dev e2e test

help: ## Pokaż tę listę komend
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Zainstaluj zależności (backend + frontend)
	npm --prefix backend install
	npm --prefix frontend install

env: ## Utwórz backend/.env z .env.example (jeśli nie istnieje)
	@test -f backend/.env || { cp backend/.env.example backend/.env && echo "Utworzono backend/.env"; }

up: env ## Start MongoDB w tle (czeka, aż baza będzie gotowa)
	$(COMPOSE) up -d --wait

down: ## Zatrzymaj MongoDB (dane w wolumenie zostają)
	$(COMPOSE) down

clean: ## Zatrzymaj MongoDB i usuń dane (wolumen)
	$(COMPOSE) down -v

migrate: up ## Zastosuj migracje bazy
	npm --prefix backend run migrate:up

seed: up ## Wstaw profil demo (idempotentnie)
	npm --prefix backend run seed

dev: up migrate seed ## Pełny start: Mongo + migracje + seed + backend (:3001) i frontend (:5173)
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
