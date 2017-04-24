export class PathBuilder {
    public paths: Array<string> = [];
    public includes: Array<string> = [];
    private get_params: Array<string> = [];

    public prependPath(value: string) {
        this.paths.unshift(value);
    }

    public appendPath(value: string) {
        if (value !== '') {
            this.paths.push(value);
        }
    }

    public addParam(param: string): void {
        this.get_params.push(param);
    }

    public setInclude(strings_array: Array<string>) {
        this.includes = strings_array;
    }

    public getForCache(): string {
        return this.paths.join('/') + this.get_params.join('/');
    }

    public get(): string {
        var params = [];
        angular.copy(this.get_params, params);

        if (this.includes.length > 0) {
            params.push('include=' + this.includes.join(','));
        }

        return this.paths.join('/') +
            (params.length > 0 ? '?' + params.join('&') : '');
    }
}
