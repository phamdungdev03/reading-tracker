import { Router } from 'express';
import { getCover } from '../controllers/covers.controller';

export const coversRouter = Router();
coversRouter.get('/:coverId', getCover);
