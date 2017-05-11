# 0.6.x

## Localstorage cache

- Save on localstore all data. When you request a resource or collection, first check memory. If its empty, read from store. If is empty, get the data from back-end.
- typings and index.d.ts removed. We only use `import`

# 0.5.x

All data is merged on one single resource. If you request a request a single related resource, and on this request not include any another resource, related resources come from memory cache (if exists)
