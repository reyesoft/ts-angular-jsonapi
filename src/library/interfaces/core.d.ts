import { IService } from './index';

export interface ICore {
    // jsonapiServices: Object;

    loadingsCounter: number;
    loadingsStart: Function;
    loadingsDone: Function;
    loadingsError: Function;
    loadingsOffline: Function;

    _register(clase: IService): boolean;
    getResourceService(type: string): IService;
    refreshLoadings(factor: number): void;
    clearCache(): void;

    // static
    me?: IService;
    injectedServices?: any;
}
