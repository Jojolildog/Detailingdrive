export class ApplicationError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.name = "ApplicationError";
    this.status = status;
    this.code = code;
  }
}
