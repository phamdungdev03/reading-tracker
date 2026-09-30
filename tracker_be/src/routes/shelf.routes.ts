import { Router } from 'express';
import { addShelf, listShelf, patchShelf, removeShelf } from '../controllers/shelf.controller';

export const shelfRouter = Router();
shelfRouter.get('/', listShelf);
shelfRouter.post('/', addShelf);
shelfRouter.patch('/:id', patchShelf);
shelfRouter.delete('/:id', removeShelf);
