import { IParams } from './params.d';
import { IPage } from './page.d';

interface IParamsCollection extends IParams {
    localfilter?: any;
    remotefilter?: any;
    smartfilter?: any;
    page?: IPage;
    storage_ttl?: number;
}
