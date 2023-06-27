import { ICustomer } from '../common/customer.interface';
import { createHash } from 'node:crypto';

export function anonymizeCustomer(
    customer: ICustomer,
    hashLenByte: number,
): ICustomer {
    const strToHash = (input: string) =>
        createHash('shake256', { outputLength: hashLenByte / 2 })
            .update(input)
            .digest('hex');

    const anonymizedCustomer = { ...customer };
    anonymizedCustomer.firstName = strToHash(customer.firstName);
    anonymizedCustomer.lastName = strToHash(customer.lastName);
    const emailParts = customer.email.split('@');
    anonymizedCustomer.email = `${strToHash(emailParts[0])}@${emailParts[1]}`;
    anonymizedCustomer.address.line1 = strToHash(customer.address.line1);
    anonymizedCustomer.address.line2 = strToHash(customer.address.line2);
    anonymizedCustomer.address.postcode = strToHash(customer.address.postcode);

    return anonymizedCustomer;
}
