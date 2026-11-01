from datetime import UTC, datetime
from unittest.mock import patch

from kori.budgets import service
from kori.users.models import User


def test_current_month_follows_the_user_time_zone() -> None:
    # 2026-10-31 19:00 UTC is already 1 November in Dhaka (UTC+6) but still October in UTC.
    instant = datetime(2026, 10, 31, 19, 0, tzinfo=UTC)
    with patch("kori.budgets.service.datetime") as mock_dt:
        mock_dt.now.side_effect = lambda tz: instant.astimezone(tz)
        assert service.current_month(User(timezone="Asia/Dhaka")) == "2026-11"
        assert service.current_month(User(timezone="UTC")) == "2026-10"
