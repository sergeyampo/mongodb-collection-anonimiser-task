# Technical task.

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
Система, как правило, должна поддерживать openssl shake256 hash алгоритм, однако убедитесь, что он установлен:
```
openssl list -digest-algorithms | grep -i shake
```
Если в выводе будет SHAKE256, то все исправно.

### 5. Environment variables
Скопируйте .env.dist файл как .env и заполните строку подключения к mongodb.

Используйте режим retryWrites=false.

Например:
```
DB_URI=mongodb://localhost:27017,localhost:27018,localhost:27019/customers?retryWrites=false&replicaSet=myReplicaSet
```

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
npm run:reindex
```