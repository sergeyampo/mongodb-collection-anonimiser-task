import { MongoClient } from 'mongodb';
import { ICustomer } from '../common/customer.interface';
import { anonymizeCustomer } from './anonymizer';
import { setTimeout, clearTimeout } from 'node:timers';
import { ReindexCustomerStream } from './reindex-customer-stream';
import { SyncCustomerStream } from './sync-customer-stream';
import { IConfig } from './config';

async function upsertCustomersWithProgress(
    customerStream: ReindexCustomerStream | SyncCustomerStream,
    customers: Array<ICustomer>,
    timerWrapper: { timer: NodeJS.Timeout | null },
    batchSz: number,
    insertTimeoutMs: number,
) {
    if (customers.length >= batchSz) {
        if (timerWrapper.timer) clearTimeout(timerWrapper.timer);
        await customerStream.upsertWithProgress(customers);
        customers.length = 0;
    } else if (!timerWrapper.timer) {
        timerWrapper.timer = setTimeout(async () => {
            await customerStream.upsertWithProgress(customers);
            customers.length = 0;
            timerWrapper.timer = null;
        }, insertTimeoutMs);
    }
}

export async function runInFullReindexMode(
    mongoClient: MongoClient,
    config: IConfig,
) {
    const customersToUpsert: Array<ICustomer> = [];
    const timerWrapper = { timer: null as NodeJS.Timeout | null };
    const customerStream = new ReindexCustomerStream(
        config.REINDEX_PROGRESS_ID,
        mongoClient,
        config.COLLECTION_NAMES,
    );

    try {
        for await (const customer of await customerStream.createOrContinue()) {
            const anonymizedCustomer = anonymizeCustomer(
                customer,
                config.INSERTER_OPTIONS.HASH_LENGTH,
            );
            customersToUpsert.push(anonymizedCustomer);

            await upsertCustomersWithProgress(
                customerStream,
                customersToUpsert,
                timerWrapper,
                config.INSERTER_OPTIONS.BATCH_SZ,
                config.INSERTER_OPTIONS.INSERT_TIMEOUT_MS,
            );
        }
        if (timerWrapper.timer) clearTimeout(timerWrapper.timer);
        await customerStream.upsertWithProgress(customersToUpsert);
        customersToUpsert.length = 0;
    } catch (err) {
        throw new Error(`Error while working in full-reindex mode`, {
            cause: err,
        });
    } finally {
        await customerStream.close();
    }
    return;
}

export async function runInSyncMode(mongoClient: MongoClient, config: IConfig) {
    const customersToUpsert: Array<ICustomer> = [];
    const timerWrapper = { timer: null as NodeJS.Timeout | null };
    const customerStream = new SyncCustomerStream(
        config.RESUME_TOKEN_ID,
        mongoClient,
        config.COLLECTION_NAMES,
    );

    try {
        for await (const change of await customerStream.createOrContinue()) {
            if (
                change.operationType !== 'insert' &&
                change.operationType !== 'update'
            ) {
                continue;
            }
            const customer = change.fullDocument!;
            const anonymizedCustomer = anonymizeCustomer(
                customer,
                config.INSERTER_OPTIONS.HASH_LENGTH,
            );
            customersToUpsert.push(anonymizedCustomer);
            await upsertCustomersWithProgress(
                customerStream,
                customersToUpsert,
                timerWrapper,
                config.INSERTER_OPTIONS.BATCH_SZ,
                config.INSERTER_OPTIONS.INSERT_TIMEOUT_MS,
            );
        }
        if (timerWrapper.timer) clearTimeout(timerWrapper.timer);
        await customerStream.upsertWithProgress(customersToUpsert);
        customersToUpsert.length = 0;
    } catch (err) {
        throw new Error(`Error while working in sync mode`, {
            cause: err,
        });
    } finally {
        await customerStream.close();
    }
}
