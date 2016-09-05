export class PathMaker {
    public paths: Array<String> = [];
    public includes: Array<String> = [];

    public prependPath(value: String) {
        this.paths.unshift(value);
    }

    public appendPath(value: String) {
        this.paths.push(value);
    }

    public setInclude(strings_array: Array<String>) {
        this.includes = strings_array;
    }

    public get(): String {
        let get_params: Array<String> = [];

        if (this.includes.length > 0) {
            get_params.push('include=' + this.includes.join(','));
        }

        return this.paths.join('/') +
            (get_params.length > 0 ? '?' + get_params.join('&') : '');
    }
}
