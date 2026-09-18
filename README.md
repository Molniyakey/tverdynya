# Твердыня

Браузерная 2D-игра: славянское поселение + tower defense против **Орды**.  
Стек: **Phaser 3 + TypeScript + Vite**.  
Зависимости ставятся **только внутри Docker**, не в систему Windows.

Документы: [`PLAN.md`](./PLAN.md) · [`JOURNAL.md`](./JOURNAL.md) · [`BALANCE.md`](./BALANCE.md)

---

## Виртуальное окружение

На ПК **не нужен** установленный Node.js/npm.

| Что | Где живёт |
|-----|-----------|
| Node.js runtime | образ Docker `node:22` |
| `node_modules` | Docker volume `tverdynya_node_modules` |
| Исходники | эта папка (примонтирована в контейнер) |

Это аналог Python `venv`, но для JS-проекта через контейнер.

---

## Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (у вас уже есть)

---

## Запуск

В PowerShell из папки проекта:

```powershell
# Собрать образ и поднять dev-сервер
docker compose up --build
```

Откройте в браузере: [http://localhost:5173](http://localhost:5173)

Остановка: `Ctrl+C`, либо:

```powershell
docker compose down
```

### Полезные команды

```powershell
# Только установить/обновить зависимости в volume
docker compose run --rm game npm install

# Сборка production в dist/
docker compose run --rm game npm run build

# Проверка TypeScript
docker compose run --rm game npm run typecheck

# Удалить volume с зависимостями (полный сброс окружения)
docker compose down -v
```

Скрипты-обёртки (из корня проекта):

```powershell
.\scripts\dev.ps1      # docker compose up --build
.\scripts\install.ps1  # npm install в контейнере
.\scripts\build.ps1    # production build
```

---

## Структура

```
src/
  main.ts
  scenes/
    BootScene.ts
    MenuScene.ts
```

Дальше: конфиги из `BALANCE.md`, серый прототип поселения и волн Орды.

### Как играть (серый прототип)

1. Откройте http://localhost:5173 → **Играть**.
2. Выберите героя (Коловрат или Галицкий).
3. Карта (как внешние земли SFK):
   - **сверху Округа** — со стороны Орды, разведка от стены наружу;
   - **стена** — башни;
   - **снизу поселение** — экономика.
4. Без выбранного здания кликайте по Округе сверху:
   - от стены наружу → разведка (8 дерева);
   - точка активности → освоение.
5. Квесты слева — награды автоматически.
6. **Пробел** — волна Орды.
