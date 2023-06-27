import dotenv from 'dotenv';

dotenv.config();

export interface IConfig {
    readonly MONGO_URI: string;
    readonly REINDEX_PROGRESS_ID: string;
    readonly RESUME_TOKEN_ID: string;
    readonly COLLECTION_NAMES: {
        readonly SOURCE_COLLECTION: string;
        readonly OUTPUT_COLLECTION: string;
        readonly PROGRESS_SYNC_COLLECTION: string;
        readonly PROGRESS_REINDEX_COLLECTION: string;
    };
    readonly INSERTER_OPTIONS: {
        readonly HASH_LENGTH: number;
        readonly INSERT_TIMEOUT_MS: number;
        readonly BATCH_SZ: number;
    };
}

export const config: IConfig = {
    MONGO_URI: process.env.DB_URI!,
    REINDEX_PROGRESS_ID: 'REINDEX_PROGRESS',
    RESUME_TOKEN_ID: 'RESUME_TOKEN',
    COLLECTION_NAMES: {
        SOURCE_COLLECTION: 'customers',
        OUTPUT_COLLECTION: 'customers_anonymised',
        PROGRESS_SYNC_COLLECTION: 'customers_transfer_process',
        PROGRESS_REINDEX_COLLECTION: 'customers_full_reindex_transfer_process',
    },
    INSERTER_OPTIONS: {
        HASH_LENGTH: 8,
        INSERT_TIMEOUT_MS: 1000,
        BATCH_SZ: 1000,
    },
};
