export interface INewUsers {
    id :  string;
    name : string;
    email : string;
}

export interface INewNewsLetterSubscribers {
    id :  string;
    email : string;
    isRegistered : boolean;
}

export interface IMoengageReqBody {
    customer_id: string
    attributes: IReqBodyAttributes
}

export interface IReqBodyAttributes{
    u_n: string;
    u_em: string;
    ma_custom_install: boolean
}