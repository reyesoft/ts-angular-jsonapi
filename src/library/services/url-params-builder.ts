export class UrlParamsBuilder {

    private toparamsarray(params, add = ''): string {
        let ret = '';
        if (angular.isArray(params) || angular.isObject(params)) {
            angular.forEach(params, (value, key) => {
                ret += this.toparamsarray(value, add + '[' + key + ']');
            });
        } else {
            ret += add + '=' + params;
        }
        return ret;
    }

    public toparams(params): string {
        let ret = '';
        angular.forEach(params, (value, key) => {
            ret += this.toparamsarray(value, '&' + key);
        });
        return ret.slice(1);
    }
}
