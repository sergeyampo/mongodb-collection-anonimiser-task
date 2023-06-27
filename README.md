# Technical task. Fundraise up

## Установка зависимостей
### 1. Node
```
fnm use
```
или
```
nvm use
```

### 2. Dependencies
```
npm ci
```

### 3. MongoDb
База данных должна называться не local, admin или config, а mongodb должен быть реплицирован.

### 4. Openssl
Система, как правило, должна поддерживать openssl shake128 hash алгоритм, однако убедитесь, что он установлен:
```
openssl list -digest-algorithms | grep -i shake
```
Если в выводе будет SHAKE256, то все исправно.

## Запуск
### app
```
npm run:app
```

### sync
#### Режим синхронизации
```
npm run:sync
```
#### Режим реиндексации
```
npm run:sync --full-reindex
```

# Что нужно сделать, но уже перебор для бесплатного тестового задания
1. Graceful shutdown.
2. 