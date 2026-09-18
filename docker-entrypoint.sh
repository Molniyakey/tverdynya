#!/bin/sh
set -e

cd /app

if [ ! -f package.json ]; then
  echo "package.json не найден. Проверьте volume mount."
  exit 1
fi

# Ставим зависимости в volume tverdynya_node_modules, не в систему Windows
if [ ! -d node_modules/phaser ] || [ ! -d node_modules/vite ]; then
  echo "→ Установка npm-зависимостей внутри контейнера..."
  npm install
fi

exec "$@"
