export interface ICollection extends Object {
    $length: number;
    $isloading: boolean;
    $source: string;
    $cache_last_update: number;
    data: Array<IDataResource>;
}
