import { Collection, MongoClient, ObjectId } from 'mongodb';
import { ICustomer } from '../common/customer.interface';
import { IConfig } from './config';

export interface IReindexProgress {
    _id: IConfig['REINDEX_PROGRESS_ID'];
    lastProcessedId: ObjectId;
}

export class ReindexCustomerStream {
    constructor(
        private readonly reindexProgressId: IReindexProgress['_id'],
        private readonly client: MongoClient,
        private readonly collectionNames: IConfig['COLLECTION_NAMES'],
    ) {}

    async createOrContinue() {
        const reindexProgressColl = this.client
            .db()
            .collection<IReindexProgress>(
                this.collectionNames.PROGRESS_REINDEX_COLLECTION,
            );
        const srcColl = this.client
            .db()
            .collection<ICustomer>(this.collectionNames.SOURCE_COLLECTION);
        const progress = await reindexProgressColl.findOne({
            _id: this.reindexProgressId,
        });
        return progress
            ? srcColl
                  .find({ _id: { $gt: progress.lastProcessedId } })
                  .sort({ _id: 1 })
            : srcColl.find().sort({ _id: 1 });
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
            .collection<IReindexProgress>(
                this.collectionNames.PROGRESS_REINDEX_COLLECTION,
            );
        const lastProcessedId = customersToUpsert.at(-1)!._id;

        session.startTransaction();

        try {
            await this.upsert(customersToUpsert, tsxOutCollection);
            await this.saveProgress(tsxProgressCollection, lastProcessedId);
            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            await session.endSession();
        }
    }

    async close() {}

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

    private async saveProgress(
        reindexProgressColl: Collection<IReindexProgress>,
        lastProcessedId: ICustomer['_id'],
    ) {
        await reindexProgressColl.updateOne(
            { _id: this.reindexProgressId },
            { $set: { lastProcessedId, updatedAt: new Date() } },
            { upsert: true },
        );
    }
}
