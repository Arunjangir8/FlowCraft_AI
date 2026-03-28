const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
} as const;
type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

export const HttpStatusCode = {
    OK: 200,
    BAD_REQUEST: 400,
    ALREADY_EXISTS: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER: 500,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    CREATED: 201,
    UPDATED: 204,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
} as const;
export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];

class BaseError extends Error {
    public readonly methodName: string | undefined;
    public readonly httpCode?: HttpStatusCode;
    public readonly isOperational: boolean;
    public readonly message: string;
    public readonly severity: ErrorSeverity;
    public readonly error: unknown;
    public readonly errorData: unknown;

    constructor(error: {
        message: string;
        methodName?: string;
        httpCode?: HttpStatusCode;
        isOperational?: boolean;
        severity?: ErrorSeverity;
        error?: unknown;
        errorData?: unknown;
    }) {
        super(error.message);
        Object.setPrototypeOf(this, new.target.prototype);

        this.message = error.message;
        this.methodName = error.methodName;
        this.httpCode = error.httpCode;
        this.isOperational = error.isOperational ?? true;
        this.severity = error.severity ?? ErrorSeverity.LOW;
        this.error = error.error;
        this.errorData = error.errorData;

        if ('captureStackTrace' in Error) {
            (Error as { captureStackTrace(t: object): void }).captureStackTrace(this);
        }
    }
}

export class APIError extends BaseError {
    formatError?: unknown;

    constructor(error: {
        message: string;
        httpCode: HttpStatusCode;
        methodName?: string;
        severity?: ErrorSeverity;
        errorData?: unknown;
        formatError?: unknown;
    }) {
        super({
            message: error.message || 'Internal Server Error',
            httpCode: error.httpCode,
            isOperational: true,
            severity: error.severity ?? ErrorSeverity.LOW,
            methodName: error.methodName,
            errorData: error.errorData,
        });
        this.formatError = error.formatError;
    }
}


// throw new APIError({
//     message: "Server is not healthy",
//     httpCode: HttpStatusCode.INTERNAL_SERVER,
//   });