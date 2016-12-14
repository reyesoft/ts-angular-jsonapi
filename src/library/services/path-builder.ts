export class PathBuilder {
    public paths: Array<String> = [];
    public includes: Array<String> = [];
    public get_params: Array<String> = [];

    public prependPath(value: String) {
        this.paths.unshift(value);
    }

    public appendPath(value: String) {
        if (value !== '') {
            this.paths.push(value);
        }
    }

    public setInclude(strings_array: Array<String>) {
        this.includes = strings_array;
    }

    public getForCache(): String {
        return this.paths.join('/');
    }

    public get(): String {
        if (this.includes.length > 0) {
            this.get_params.push('include=' + this.includes.join(','));
        }

        return this.paths.join('/') +
            (this.get_params.length > 0 ? '?' + this.get_params.join('&') : '');
    }
}
