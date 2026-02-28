export declare const AccountType: {
    readonly CHECKING: "CHECKING";
    readonly SAVINGS: "SAVINGS";
    readonly CREDIT_CARD: "CREDIT_CARD";
    readonly INVESTMENT: "INVESTMENT";
    readonly CASH: "CASH";
    readonly OTHER: "OTHER";
};
export type AccountType = (typeof AccountType)[keyof typeof AccountType];
export declare const CategoryType: {
    readonly INCOME: "INCOME";
    readonly EXPENSE: "EXPENSE";
};
export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];
export declare const TransactionType: {
    readonly INCOME: "INCOME";
    readonly EXPENSE: "EXPENSE";
};
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];
