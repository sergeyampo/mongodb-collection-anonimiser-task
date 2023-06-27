import { MongoClient } from 'mongodb';
import { ICustomer } from '../common/customer.interface';
import { anonymizeCustomer } from './anonymizer';
import { clearTimeout } from 'node:timers';
import { ReindexCustomerStream } from './reindex-customer-stream';
import { SyncCustomerStream } from './sync-customer-stream';
import { IConfig } from './config';

async function upsertCustomersWithProgress(
    customerStream: ReindexCustomerStream | SyncCustomerStream,
    customers: Array<ICustomer>,
    timer: NodeJS.Timeout | null,
    batchSz: number,
    insertTimeoutMs: number,
) {
    if (customers.length >= batchSz) {
        if (timer) clearTimeout(timer);
        await customerStream.upsertWithProgress(customers);
        customers.length = 0;
    } else if (!timer) {
        timer = setTimeout(() => {
            handleTimer(customerStream, customers).then(() => {
                timer = null;
            });
        }, insertTimeoutMs);
    }
    return timer;
}

async function handleTimer(
    customerStream: ReindexCustomerStream | SyncCustomerStream,
    customers: Array<ICustomer>,
) {
    await customerStream.upsertWithProgress(customers);
    customers.length = 0;
}

export async function runInFullReindexMode(
    mongoClient: MongoClient,
    config: IConfig,
) {
    const customersToUpsert: Array<ICustomer> = [];
    let timer: NodeJS.Timeout | null = null;
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

            timer = await upsertCustomersWithProgress(
                customerStream,
                customersToUpsert,
                timer,
                config.INSERTER_OPTIONS.BATCH_SZ,
                config.INSERTER_OPTIONS.INSERT_TIMEOUT_MS,
            );
        }
        if (timer) clearTimeout(timer);
    } catch (err) {
        throw new Error(`Error while working in full-reindex mode`, {
            cause: err,
        });
    } finally {
        await customerStream.close();
    }
}

export async function runInSyncMode(mongoClient: MongoClient, config: IConfig) {
    const customersToUpsert: Array<ICustomer> = [];
    let timer: NodeJS.Timer | null = null;
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
            timer = await upsertCustomersWithProgress(
                customerStream,
                customersToUpsert,
                timer,
                config.INSERTER_OPTIONS.BATCH_SZ,
                config.INSERTER_OPTIONS.INSERT_TIMEOUT_MS,
            );
        }
    } catch (err) {
        throw new Error('Error while working in sync mode', {
            cause: err,
        });
    } finally {
        await customerStream.close();
    }
}
