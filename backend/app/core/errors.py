"""Error envelope shared by every API answer: {"error": {"code", "message"}}."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
}


class AppError(Exception):
    """An error the API reports to the client with a stable machine-readable code."""

    def __init__(
        self, status: int, code: str, message: str, headers: dict[str, str] | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}


def error_body(code: str, message: str, **extra: object) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


async def _app_error(_: Request, exc: AppError) -> JSONResponse:
    headers = dict(exc.headers)
    if exc.status == 401:
        headers.setdefault("WWW-Authenticate", "Bearer")
    return JSONResponse(error_body(exc.code, exc.message), status_code=exc.status, headers=headers)


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = HTTP_CODES.get(exc.status_code, "http_error")
    return JSONResponse(
        error_body(code, str(exc.detail)), status_code=exc.status_code, headers=exc.headers
    )


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"loc": [str(part) for part in err["loc"]], "message": err["msg"]} for err in exc.errors()
    ]
    return JSONResponse(
        error_body("validation_error", "Invalid request", details=details), status_code=422
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
