# Твердыня

Steam-first 2D pixel-art roguelite city-builder о мифической Руси. Игрок развивает живой град днём и вместе с дружиной отражает силы Нави ночью.

Стек: **Phaser 3 + TypeScript + Vite + Vitest + Electron**. Node.js и npm работают внутри Docker.

Документы: [`PLAN.md`](./PLAN.md) · [`docs/GDD.md`](./docs/GDD.md) · [`docs/TECH_DESIGN.md`](./docs/TECH_DESIGN.md) · [`docs/ROADMAP.md`](./docs/ROADMAP.md)

## Запуск

```powershell
docker compose up --build
```

Игра: http://localhost:5173

## Проверки

```powershell
docker compose run --rm game npm run typecheck
docker compose run --rm game npm test
docker compose run --rm game npm run build
```

## Desktop

```powershell
# Требует доступ к загрузкам Electron/electron-builder
docker compose run --rm game npm run desktop:package
```

Portable Windows build создаётся в `release/`. Steamworks подключается после плейтестов vertical slice.

## Управление

- ЛКМ по кнопке здания, затем по участку — строительство.
- ЛКМ по работающему зданию — смена приоритета работников.
- ЛКМ по точке Округи — исследование за еду.
- ПКМ по полю — точка сбора дружины.
- `Q` — Клич рати.
- `Space`, `1`, `2` — пауза и скорость времени.