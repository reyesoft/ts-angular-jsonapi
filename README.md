# ts-angular-jsonapi

Jsonapi client library developed for AngularJS based on typescript.

## Supported features

- [x] TS Definitions for strong typing and autocomplete ([See example image](https://github.com/reyesoft/ts-angular-jsonapi/wiki/Autocomplete))
- [x] Get resource and collection of resources
- [x] Include support (also, when you save)
- [ ] Iqual requests, return a same ResourceObject
- [ ] Declaration file published on [DefinitelyTyped repository](https://github.com/borisyankov/DefinitelyTyped).
- [ ] Caché
- [ ] Pagination

## Installation

First of all, you need read, read and read [Jsonapi specification](http://jsonapi.org/).

```bash
bower install ts-angular-jsonapi --save
```

Or throw npm

```bash
npm install ts-angular-jsonapi --save
```

### Dependecies and customization

1. Add reference path to Typescript Definitions (dts).
2. Add Jsonapi dependency.
3. Configure your url and other paramemeters.
4. Inject JsonapiCore somewhere before you extend any class from `Jsonapi.Resource`.

```javascript
/// <reference path="../../bower_components/ts-angular-jsonapi/dist/ts-angular-jsonapi.d.ts"/>

var app = angular.module('yourAppName', ['rsJsonapiConfig']);

app.config(['rsJsonapiConfig', (rsJsonapiConfig) => {
    angular.extend(rsJsonapiConfig, {
        url: 'http://localhost:8080/v1/'
    });
}]);

var MyController = function(JsonapiCore) {
  // ...
}
MyController.$inject = ['JsonapiCore'];
```

## Examples

Like you know, the better way is with examples. Based on [endpoints example library](https://github.com/endpoints/endpoints-example/).

### Defining a resource

`authors.service.ts`

```typescript
class AuthorsService extends Jsonapi.Resource {
    type = 'authors';
    public schema: Jsonapi.ISchema = {
        attributes: {
            name: { presence: true, length: { maximum: 96 } },
            date_of_birth: {},
            date_of_death: {},
            created_at: {},
            updated_at: {}
        },
        relationships: {
            books: {},
            photos: {}
        }
    };
}
angular.module('demoApp').service('AuthorsService', AuthorsService);
```

### Get a collection of resources

#### Controller

```javascript
class AuthorsController {
    public authors: any = null;

    /** @ngInject */
    constructor(AuthorsService) {
        this.authors = AuthorsService.all();
    }
}
```

#### View for this controller

```html
<p ng-repeat="author in vm.authors">
    id: {{ author.id }} <br />
    name: {{ author.attributes.name }} <br />
    birth date: {{ author.attributes.date_of_birth | date }}
</p>
```

### Get a single resource

From this point, you only see important code for this library. For a full example, clone and see demo directory.

```javascript
let author = AuthorsService.get('some_author_id');
```

#### Need you more control and options?

```javascript
let author = AuthorsService.get(
    'some_author_id',
    { include: ['books', 'photos'] },
    success => {
        console.log('Author loaded.', success);
    },
    error => {
        console.log('Author don`t loaded. Error.', error);
    }
);
```

TIP: these parameters work with `all()` and `save()` methods too.

### Add a new resource

```javascript
let author = this.AuthorsService.new();
author.attributes.name = 'Pablo Reyes';
author.attributes.date_of_birth = '2030-12-10';
author.save();
```

#### Need you more control and options?

```javascript
let author = this.AuthorsService.new();
author.attributes.name = 'Pablo Reyes';
author.attributes.date_of_birth = '2030-12-10';

// some_book is an another resource like author
let some_book = this.BooksService.get(1);
author.addRelationship(some_book);

// some_publisher is a polymorphic resource named company on this case
let some_publisher = this.PublishersService.get(1);
author.addRelationship(some_publisher, 'company');

// this library can send include information to server, for atomicity
author.save( { include: ['book'] });
```

### Update a resource

```javascript
let author = AuthorsService.get('some_author_id');
this.author.attributes.name += 'New Name';
this.author.save(success => {
    console.log('author saved!');
});
```

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

## Colaborate

First you need run the demo. Next, when you made new features on your fork, please run

```bash
gulp dist
```

And commit! Don't forget your pull request :)
