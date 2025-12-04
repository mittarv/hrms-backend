import { approvalStatusEnum } from "../enums/enums";

// Interface for news article
export interface NewsArticleAttributes {
    id?: number;
    title: string;
    newsPaperName: string;
    newsLink: string;
    releaseDate: Date;
    excerpts: string;
    beginDate: Date;
    endDate: Date;
    image?: string | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for uam request attributes
export interface UamRequestAttributes {
    id?: number;
    toolId?: number | null;
    requestedBy?: number | null;
    requestedOn?: Date | null;
    requestedAccess?: number | null;
    currentAccess?: number | null;
    remark?: string | null;
    status?: approvalStatusEnum | null;
    resolvedOn?: Date | null;
    resolvedBy?: number | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for uam tools
export interface UamToolsAttributes {
    toolId?: number;
    name: string;
    description: string;
    remark?: string | null;
    link?: string | null;
    adminId?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    updatedBy?: number | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for uam tools users
export interface UamToolsUserAttributes {
    id?: number;
    toolId?: number | null;
    userId?: string | null;
    userGroupId?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    updatedBy?: number | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for uam user groups
export interface UamUserGroupsAttributes {
    id?: number;
    role: string;
    value?: number | null;
    view?: boolean | null;
    modify?: boolean | null;
    approver?: boolean | null;
    addmembers?: boolean | null;
    updatedBy?: number | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for tms users
export interface TmsUsersAttributes {
    userId?: number;
    name: string;
    email?: string | null;
    profilePic?: string | null;
    userType?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    updatedBy?: number | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}





