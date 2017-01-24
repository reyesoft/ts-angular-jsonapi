export interface IPage {
    number: number;

    // http://jsonapi.org/format/#fetching-pagination
    size?: number;
    limit?: number;
    offset?: number;

    // multinexo
    total_resources?: number;
    resources_per_page?: number;
}
