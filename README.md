# Room Booking API

[![CI](https://github.com/bg366/ztpai5/actions/workflows/ci.yml/badge.svg)](https://github.com/bg366/ztpai5/actions/workflows/ci.yml)

Laboratorium 5 z ZTPAI: testy rezerwacji sal, Docker Compose, eventy i audit log.
Express, PostgreSQL 16, Knex, JWT, Jest 30 i Supertest 7. Repo zawiera wyłącznie
samodzielne rozwiązanie tego laboratorium.

## Uruchomienie od zera

Wymagane: Git i Docker z Compose v2. Porty 3005 i 54335 muszą być wolne.

```sh
git clone https://github.com/bg366/ztpai5.git
cd ztpai5
cp .env.example .env
docker compose up --build
```

API uruchamia migracje przed startem serwera. Swagger UI:
http://localhost:3005/api/docs/ . Specyfikacja: http://localhost:3005/api/docs/openapi.json .
OpenAPI używa względnego adresu serwera, więc działa również po zmianie portu.

W drugim terminalu uruchom seed:

```sh
docker compose exec api npx knex seed:run
```

Seed dodaje budynek, salę i dwa konta. Można go powtórzyć, nie usuwa rezerwacji
ani historii. Hasła pochodzą z `.env`:

| Konto | Rola | Zmienna |
|---|---|---|
| admin@example.com | ADMIN | SEED_ADMIN_PASSWORD |
| jan@example.com | USER | SEED_USER_PASSWORD |

`.env.example` zawiera jawne dane demonstracyjne do lokalnych zajęć.
Przed użyciem poza lokalnym komputerem zmień hasła i JWT_SECRET.
Nie commituj `.env`. Compose pobiera hasła ze zmiennych, obraz ich nie zawiera.

W Swaggerze wykonaj POST `/api/auth/login`, skopiuj `accessToken` do **Authorize**,
a potem korzystaj z **Try it out → Execute**. USER zarządza swoimi rezerwacjami,
ADMIN dodatkowo budynkami i salami, może też anulować cudzą rezerwację.
Obca rezerwacja jest dla USERa niewidoczna (404).

```sh
docker compose ps
docker compose logs api
docker compose down
```

Przy SIGTERM aplikacja zamyka serwer HTTP, czeka na listenery i zamyka pulę bazy.
Named volume zachowuje dane po `down`. `down -v` usuwa również dane.

## Testy

Do lokalnych testów potrzebny jest Node.js 22. PostgreSQL może działać w Compose.

```sh
npm ci
npm run test:unit
# Jednorazowo, po uruchomieniu db:
docker compose exec db createdb -U lab_user room_booking_lab5_test
npm run test:integration
npm test
```

Unit testy używają repozytoriów w pamięci i wstrzykniętego zegara, działają bez
PostgreSQL. Każdy test tworzy własny stan; przypadki graniczne są w `test.each`.
Integracja korzysta z Supertest i `createApp()` bez uruchamiania `server.js`.
Migracje wykonuje `beforeAll`, tabele czyści `beforeEach`, pulę zamyka `afterAll`.

`TEST_DATABASE_URL` musi wskazywać osobną bazę z końcówką `_test`, inną niż
`DATABASE_URL`. Testy usuwają dane tylko z niej. Nie uruchamiaj dwóch zestawów
integracyjnych jednocześnie na tej samej bazie. Świeża baza nie wymaga ręcznych migracji.

## Eventy i audit log

Service publikuje `reservation.created` i `reservation.cancelled` po COMMIT.
Kolizja i ponowne anulowanie nie publikują eventów. Blokady wierszy chronią też
równoległe tworzenie i anulowanie. EventEmitter uruchamia listenery z osobną
obsługą błędów synchronicznych i asynchronicznych.

Pierwszy listener zapisuje event i payload JSONB w `audit_log`. Drugi wypisuje
`[notification] to: <email> ...`, gdy ADMIN anuluje cudzą rezerwację.
GET `/api/admin/audit-log` jest dostępny tylko dla ADMIN, obsługuje `page`, `limit`
i `eventType`, sortuje malejąco po czasie i ID.

Przykład: utworzenie → kolizja 409 → anulowanie przez ADMIN → ponowne anulowanie.
W audit logu pozostają dwa wpisy. Test integracyjny sprawdza ten scenariusz,
filtrowanie, uprawnienia i awarię zapisu audit logu przy zachowanym 201.

Event bus działa w pamięci procesu. Awaria procesu po COMMIT może zgubić event;
nie ma tu mechanizmu ponawiania ani trwałej kolejki.

## CI

GitHub Actions uruchamia `npm ci`, `npm test` i `docker build .` przy push do main
oraz przy każdym PR. PostgreSQL działa jako jednorazowy service z healthcheckiem;
tryb trust jest używany tylko na runnerze. Klucz JWT testów jest generowany przy starcie.

Test ochrony CI polega na zmianie `<` na `<=` w regule nakładania, a następnie
przywróceniu poprawnego porównania w tym samym PR.
