import { IPage } from './page.d';

interface IParams {
    id?: string;
    beforepath?: string;
    include?: Array<string>;
    localfilter?: any;
    remotefilter?: any;
    page?: IPage;
}
