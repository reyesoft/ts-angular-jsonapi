interface ICore {
    rootPath?: string;
    resources?: Array<IResource>;

    Me?: IResource;
    Services?: any;

    loadingsStart?: Function;
    loadingsDone?: Function;
    loadingsError?: Function;
    loadingsOffline?: Function;

    _register? (clase: any): boolean;
    getResource? (type: string): IResource;
    refreshLoadings?(factor: number): void;
}
