import logging
from contextvars import ContextVar
from typing import Any

import structlog
from structlog.typing import EventDict

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


REDACTED_KEYS = frozenset(
    {"password", "token", "session_token", "cookie", "set-cookie", "authorization", "password_hash"}
)


def redact_secrets(_: object, __: str, event_dict: EventDict) -> EventDict:
    """Replace the value of any secret-looking key, at any nesting depth, with `[redacted]`."""

    def scrub(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                k: "[redacted]" if str(k).lower() in REDACTED_KEYS else scrub(v)
                for k, v in value.items()
            }
        if isinstance(value, list | tuple):
            return [scrub(v) for v in value]
        return value

    return scrub(event_dict)  # type: ignore[no-any-return]


def configure_logging(level: str = "INFO") -> None:
    """Emit JSON log lines that carry the current request_id."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_secrets,
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping().get(level.upper(), logging.INFO)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )
