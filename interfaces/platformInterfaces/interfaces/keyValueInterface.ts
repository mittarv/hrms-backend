// Interface for category key value
export interface CategoryKeyValueAttributes {
    id: number;
    category: string;
    key: string;
    value: string;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for key value
export interface KeyValuePairsAttributes {
    id: number;
    category: string;
    value: string;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
