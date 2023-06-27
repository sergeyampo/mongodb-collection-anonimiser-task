import { Db, MongoClient } from 'mongodb';
import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';
import { setInterval } from 'node:timers/promises';
import { ICustomerCreate } from '../common/customer.interface';
import { setTimeout as setTimeoutPromise } from 'timers/promises';

dotenv.config();

const config = {
    MONGO_URI: process.env.DB_URI!,
    CREATE_DELAY_MS: 200,
    CUSTOMER_RNG_PER_INSERT: [1, 10],
    COLLECTION: 'customers',
} as const;

let mongoClient: MongoClient;

async function initMongoConn(dbURI: string): Promise<Db> {
    mongoClient = new MongoClient(dbURI);
    await mongoClient.connect();

    return mongoClient.db();
}

function generateFakeCustomers(
    customersNumber: number,
): Array<ICustomerCreate> {
    return Array.from({ length: customersNumber }, () => ({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        address: {
            line1: faker.location.streetAddress(),
            line2: faker.location.secondaryAddress(),
            postcode: faker.location.zipCode(),
            city: faker.location.city(),
            state: faker.location.state(),
            country: faker.location.country(),
        },
        createdAt: new Date(),
    }));
}

const getCustomerNumToIns = (): number => {
    const [min, max] = config.CUSTOMER_RNG_PER_INSERT;
    return (
        Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min
    );
};

async function main(): Promise<void> {
    const mongoClient = await initMongoConn(config.MONGO_URI);
    const collection = mongoClient.collection(config.COLLECTION);

    for await (const _ of setInterval(config.CREATE_DELAY_MS)) {
        const customers = generateFakeCustomers(getCustomerNumToIns());
        await collection.insertMany(customers).catch((err) => {
            throw new Error(`Failed to insert customers`, {
                cause: err,
            });
        });
    }
}

void main()
    .catch((err) => {
        console.error(err);
    })
    .finally(async () => {
        await mongoClient.close();
    });

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
