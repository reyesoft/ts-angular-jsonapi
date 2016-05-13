declare module Jsonapi {
    interface IErrors extends IDocument {
        errors: [
            {
                code?: string,
                source?: {
                    attributes?: string,
                    pointer: string
                },
                title?: string,
                detail?: string
            }
        ];
    }
}
