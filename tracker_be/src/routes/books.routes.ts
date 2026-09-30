import { Router } from 'express';
import { searchBooks, getBookDetails } from '../controllers/books.controller';

export const booksRouter = Router();
booksRouter.get('/', searchBooks);
booksRouter.get('/:workId', getBookDetails);
