import {
    ChangeStream,
    ChangeStreamDocument,
    Collection,
    MongoClient,
} from 'mongodb';
import { ICustomer } from '../common/customer.interface';
import { IConfig } from './config';

export interface IResumeToken {
    _id: IConfig['RESUME_TOKEN_ID'];
    token: {
        _data: string;
    };
}

export class SyncCustomerStream {
    private resumeToken: IResumeToken | null;
    private changeStream: ChangeStream<ICustomer> | null;

    constructor(
        private readonly resumeTokenId: IResumeToken['_id'],
        private readonly client: MongoClient,
        private readonly collectionNames: IConfig['COLLECTION_NAMES'],
    ) {
        this.resumeToken = null;
        this.changeStream = null;
    }

    async *createOrContinue(): AsyncGenerator<ChangeStreamDocument<ICustomer>> {
        const syncProgressColl = this.client
            .db()
            .collection<IResumeToken>(
                this.collectionNames.PROGRESS_SYNC_COLLECTION,
            );
        const srcColl = this.client
            .db()
            .collection<ICustomer>(this.collectionNames.SOURCE_COLLECTION);
        const token = await syncProgressColl.findOne({
            _id: this.resumeTokenId,
        });
        this.changeStream = srcColl.watch([], {
            fullDocument: 'updateLookup',
            startAfter: token?.token,
        });
        for await (const change of this.changeStream) {
            this.resumeToken = this.buildResumeToken(change);
            yield change;
        }
    }

    async upsertWithProgress(customersToUpsert: Array<ICustomer>) {
        if (!customersToUpsert.length) {
            return;
        }
        const session = await this.client.startSession();
        const tsxOutCollection = await this.client
            .db()
            .collection<ICustomer>(this.collectionNames.OUTPUT_COLLECTION);
        const tsxProgressCollection = await this.client
            .db()
            .collection<IResumeToken>(
                this.collectionNames.PROGRESS_SYNC_COLLECTION,
            );
        session.startTransaction();

        try {
            await this.upsert(customersToUpsert, tsxOutCollection);
            await this.saveProgress(tsxProgressCollection);
            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            await session.endSession();
        }
    }

    async close() {
        await this.changeStream?.close?.();
    }

    private async upsert(
        customersToUpsert: Array<ICustomer>,
        outCollection: Collection<ICustomer>,
    ) {
        if (customersToUpsert.length) {
            const ops = customersToUpsert.map((c) => ({
                updateOne: {
                    filter: { _id: c._id },
                    update: { $set: { ...c } },
                    upsert: true,
                },
            }));
            await outCollection.bulkWrite(ops);
        }
    }

    private async saveProgress(syncProgressColl: Collection<IResumeToken>) {
        await syncProgressColl.updateOne(
            { _id: this.resumeTokenId },
            { $set: { token: this.resumeToken?.token, updatedAt: new Date() } },
            { upsert: true },
        );
    }

    private buildResumeToken(
        change: ChangeStreamDocument<ICustomer>,
    ): IResumeToken {
        return {
            _id: this.resumeTokenId,
            token: {
                _data: (change._id as IResumeToken['token'])._data,
            },
        };
    }
}
