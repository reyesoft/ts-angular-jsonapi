import { IResource } from './resource';
import { IPage } from './page';

export interface ICollection extends Array<IResource> {
    $length: number;
    $toArray: Array<IResource>;
    $isloading: boolean;
    $source: string;
    $cache_last_update: number;
    data: Array<IDataResource>; // this need disapear is for datacollection
    page: IPage;
}
