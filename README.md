# ts-angular-jsonapi

First of all, you need read, read and read [Jsonapi specification](http://jsonapi.org/).

## Supported features

- Get resource and collection of resources

## Installation

```
bower install ts-angular-jsonapi --save
```

Or throw npm

```
npm install ts-angular-jsonapi --save
```

### Customization

```javascript
/// <reference path="../../bower_components/ts-angular-jsonapi/dist/ts-angular-jsonapi.d.ts"/>

var app = angular.module('yourAppName', ['Jsonapi']);

app.config(['JsonapiConfig', (JsonapiConfig) => {
    angular.extend(JsonapiConfig, {
        url: 'http://localhost:8080/v1/'
    });
}]);
```

## Examples

Based on [endpoints example library](https://github.com/endpoints/endpoints-example/).

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

```bash
git clone git@github.com:endpoints/endpoints-example.git
cd endpoints-example
npm install
npm start
```

More information in <https://github.com/endpoints/endpoints-example>.

Now, you have jsonapi endpoints like `http://localhost:8080/v1/authors`.

### Run TS Angular Jsonapi Demo App

```bash
git clone git@github.com:reyesoft/ts-angular-jsonapi.git
cd ts-angular-jsonapi
npm install
gulp serve
```

IJsonapiDocument (top level/abstract) | IJsonapiDataResource (one resource) | IJsonapiDataCollection (various resources) | IJsonapiErrors (errores)
