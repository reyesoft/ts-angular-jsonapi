import { IDataResource } from './data-resource';
import { IDocument } from '../interfaces/document';

interface IDataCollection extends IDocument {
    data: IDataResource[];
}
