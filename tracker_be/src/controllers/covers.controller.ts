import type { RequestHandler } from 'express';
import { ApiError } from '../middlewares/error-handler';
import { fetchCover } from '../services/covers.service';

export const getCover: RequestHandler = async (req, res) => {
  const coverId = req.params.coverId;
  if (typeof coverId !== 'string' || !/^[1-9]\d*$/.test(coverId)
    || !Number.isSafeInteger(Number(coverId))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Mã ảnh bìa không hợp lệ.', {
      coverId: 'ID ảnh bìa phải là số nguyên dương hợp lệ.',
    });
  }

  const cover = await fetchCover(coverId);
  res.set({
    'Content-Type': cover.contentType,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  // Gửi bytes ảnh trực tiếp để dùng được trong thẻ <img>.
  res.send(cover.buffer);
};
