/** An error that is safe to show to the person using the app. */
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 429,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const bad = (code: string, message: string) => new AppError(400, code, message);
export const unauthorized = (message = 'Please sign in again.') => new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You are not allowed to do this.') => new AppError(403, 'forbidden', message);
export const notFound = (what: string) => new AppError(404, 'not_found', `${what} was not found.`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
