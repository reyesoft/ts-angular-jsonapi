# ts-angular-jsonapi

First of all, you need read, read and read [Jsonapi specification](http://jsonapi.org/).

## Supported features

- Get resource and collection of resources

## Examples

Based on [official examples](http://jsonapi.org/examples/).

### Defining a resource

`article.service.ts`

```javascript
var a = 0;
```

### Get a collection of resources

### Get a single resource

### Add a new resource

### Update a resource

### Update a resource with relationships

### Handling errors

### More examples

- Pagination
- Include anothers resources -

## Demo local

For demo purposes you can run local server and test this library:

### Run jsonapi endpoints example server

- `git clone git@github.com:endpoints/endpoints-example.git`
- `cd endpoints-example`
- `npm install`
- `npm start`

More information in <https://github.com/endpoints/endpoints-example>.

Now, you have jsonapi endpoints like `http://localhost:8080/v1/authors`.

asdfasdf

IJsonapiDocument (top level/abstract) | IJsonapiDataResource (one resource) | IJsonapiDataCollection (various resources) | IJsonapiErrors (errores)
