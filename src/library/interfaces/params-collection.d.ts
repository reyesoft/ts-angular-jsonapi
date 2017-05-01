import { IParams } from './params.d';
import { IPage } from './page.d';

interface IParamsCollection extends IParams {
    localfilter?: object;
    remotefilter?: object;
    smartfilter?: object;
    page?: IPage;
    storage_ttl?: number;
}
