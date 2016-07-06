declare module Jsonapi {
    interface ICollection extends Object {
        $length: number;
        $isloading: boolean;
        $source: string;
    }
}
