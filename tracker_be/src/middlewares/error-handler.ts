import type { ErrorRequestHandler } from 'express';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Body JSON không hợp lệ hoặc quá lớn.' },
    });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
    });
    return;
  }

  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống.' } });
};
