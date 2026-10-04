"""Password hashing with argon2id (argon2-cffi `PasswordHasher` defaults)."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

# Verified against when the email is unknown, so both failures cost about the same time.
DUMMY_HASH = _hasher.hash("kori-dummy-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True when the stored hash uses older parameters than the current defaults."""
    return _hasher.check_needs_rehash(password_hash)
