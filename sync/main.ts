import { MongoClient } from 'mongodb';
import { runInFullReindexMode, runInSyncMode } from './customer-extractor';
import { config } from './config';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';

let mongoClient: MongoClient;

async function initMongoConn(dbURI: string): Promise<MongoClient> {
    mongoClient = new MongoClient(dbURI);
    await mongoClient.connect();

    return mongoClient;
}

enum EApplicationMode {
    FULL_REINDEX,
    REAL_TIME_SYNC,
}

const determineApplicationMode = (args: Array<string>): EApplicationMode => {
    return args.at(2) === '--full-reindex'
        ? EApplicationMode.FULL_REINDEX
        : EApplicationMode.REAL_TIME_SYNC;
};

(async () => {
    const appMode = determineApplicationMode(process.argv);
    mongoClient = await initMongoConn(config.MONGO_URI);

    switch (appMode) {
        case EApplicationMode.REAL_TIME_SYNC:
            await runInSyncMode(mongoClient, config).catch(console.error);
            break;
        case EApplicationMode.FULL_REINDEX:
            await runInFullReindexMode(mongoClient, config).catch(
                console.error,
            );
            break;
    }
    process.exit(0);
})();

process.on('unhandledRejection', async (reason, promise) => {
    console.error(
        `We've got an internal system error, graceful shutdown is started`,
        reason,
        promise,
    );
    await setTimeoutPromise(1000);
    await mongoClient.close(true).catch();
});

process.on('uncaughtException', async (err, origin) => {
    console.error(
        `We've got an internal system error, graceful shutdown is started`,
        err,
        origin,
    );
    await setTimeoutPromise(1000);
    await mongoClient.close(true).catch();
});

process.on('SIGINT', async () => {
    console.log('Gracefully shutting down the system');
    await setTimeoutPromise(1000);
    await mongoClient.close(true).catch();
});
