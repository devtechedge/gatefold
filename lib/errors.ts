export class HttpError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const unauthorized = () =>
  new HttpError("UNAUTHORIZED", "Sign in to continue.", 401);

export const forbidden = (message = "You do not have access to this action.") =>
  new HttpError("FORBIDDEN", message, 403);

export const notFound = (message = "Not found.") => new HttpError("NOT_FOUND", message, 404);
