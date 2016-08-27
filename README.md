# ts-angular-jsonapi

Jsonapi client library developed for AngularJS based on typescript.

## Supported features

- [x] TS Definitions for strong typing and autocomplete ([See example image](https://github.com/reyesoft/ts-angular-jsonapi/wiki/Autocomplete))
- [x] Get a simple resource or a collection of resources
- [x] [Include support](http://jsonapi.org/format/#fetching-includes) (also, when you save)
- [ ] Two+ equal calls, only one HTTP request.
- [x] Cache (on memory): Before a HTTP request objects are setted with cached data.
- [x] Cache (on memory): TTL of collections
- [ ] Cache (on memory): TTL of resources
- [x] Equal requests, return a same ResourceObject
- [ ] Long time cache (localstorage)
- [ ] Sorting
- [ ] Pagination
- [ ] Filtering
- [x] Get a relationship from a URL (url like attributes->relationships->resource->links->self)
- [x] [Properties on collections](https://github.com/reyesoft/ts-angular-jsonapi/blob/master/src/library/interfaces/collection.d.ts) like `$length`, `$isloading` or `$source` (_`empty`_ |`cache`|`server`)

## Usage

More information on [examples section](#examples).

### Installation

First of all, you need read, read and read [Jsonapi specification](http://jsonapi.org/).

```bash
npm install ts-angular-jsonapi --save
```

### Dependecies and customization

1. Add Jsonapi dependency.
2. Configure your url and other paramemeters.
3. Inject JsonapiCore somewhere before you extend any class from `Jsonapi.Resource`.

```javascript
import 'ts-angular-jsonapi';

var app = angular.module('yourAppName', ['rsJsonapi']);

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

#### More options? Collection filtering

Filter resources with `attribute: value` values. Filters are used as 'exact match' (only resources with attribute value same as value are returned). `value` can also be an array, then only objects with same `attribute` value as one of `values` array elements are returned.

```javascript
let authors = AuthorsService.all(
    { filter: { name: 'xx' } }
);
```

### Get a single resource

From this point, you only see important code for this library. For a full example, clone and see demo directory.

```javascript
let author = AuthorsService.get('some_author_id');
```

#### More options? Include resources when you fetch data (or save!)

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

// wow, now we need detach a relationship
author.removeRelationship('books', 'book_id');

// this library can send include information to server, for atomicity
author.save( { include: ['book'] });

// mmmm, if I need get related resources? For example, books related with author 1
let books = this.AuthorsService.getRelationships('1/books');
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

- Pagination (is comming)
- Include anothers resources (is comming)

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
npm install -g gulp typings
npm run demoinstall
gulp serve
```

## Colaborate

First you need run the demo. Next, when you made new features on your fork, please run

```bash
gulp dist
```

And commit! Don't forget your pull request :)
