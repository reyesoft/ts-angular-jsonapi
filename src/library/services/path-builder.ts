export class PathBuilder {
    public paths: Array<String> = [];
    public includes: Array<String> = [];
    private get_params: Array<String> = [];

    public prependPath(value: String) {
        this.paths.unshift(value);
    }

    public appendPath(value: String) {
        if (value !== '') {
            this.paths.push(value);
        }
    }

    public addParam(param: string): void {
        this.get_params.push(param);
    }

    public setInclude(strings_array: Array<String>) {
        this.includes = strings_array;
    }

    public getForCache(): String {
        return this.paths.join('/') + this.get_params.join('/');
    }

    public get(): String {
        var params = [];
        angular.copy(this.get_params, params);

        if (this.includes.length > 0) {
            params.push('include=' + this.includes.join(','));
        }

        return this.paths.join('/') +
            (params.length > 0 ? '?' + params.join('&') : '');
    }
}
