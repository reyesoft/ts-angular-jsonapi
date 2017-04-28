import { IAttributes } from '../interfaces';

interface IDataResource {
    type: string;
    id: string;
    attributes?: IAttributes;
    relationships?: any;
    links?: ILinks;
    meta?: any;
}
