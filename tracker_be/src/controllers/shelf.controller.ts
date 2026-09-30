import type { RequestHandler } from 'express';
import * as service from '../services/shelf.service';
import { validateAddShelf, validatePatchShelf, validateShelfId, validateStatus } from '../validators/shelf.validator';

export const listShelf: RequestHandler = async (req, res) => {
  const status = req.query.status === undefined ? undefined : validateStatus(req.query.status);
  res.json({ data: await service.listShelfBooks(status) });
};
export const addShelf: RequestHandler = async (req, res) => {
  const input = validateAddShelf(req.body);
  res.status(201).json({ data: await service.addShelfBook(input) });
};
export const patchShelf: RequestHandler = async (req, res) => {
  const id = validateShelfId(req.params.id);
  const input = validatePatchShelf(req.body);
  res.json({ data: await service.updateShelfBook(id, input) });
};
export const removeShelf: RequestHandler = async (req, res) => {
  const id = validateShelfId(req.params.id);
  await service.deleteShelfBook(id);
  res.status(204).end();
};
