import pytest

from kori.common.money import MoneyError, format_taka, parse_taka


@pytest.mark.parametrize(
    ("text", "poisha"),
    [("1250.50", 125050), ("1250", 125000), ("0.01", 1), ("5.5", 550), ("007.10", 710)],
)
def test_parse_taka(text: str, poisha: int) -> None:
    assert parse_taka(text) == poisha


@pytest.mark.parametrize(
    "text",
    [
        "12.345",
        "-5",
        "abc",
        "0",
        "0.00",
        "",
        " 5",
        "5 ",
        "1e3",
        "1,250",
        ".5",
        "5.",
        "+5",
        "٣",
        "99999999999999.99",
    ],
)
def test_parse_taka_rejects(text: str) -> None:
    with pytest.raises(MoneyError):
        parse_taka(text)


def test_parse_taka_rejects_non_strings() -> None:
    with pytest.raises(MoneyError):
        parse_taka(12.5)  # type: ignore[arg-type]


@pytest.mark.parametrize(("poisha", "text"), [(125050, "1250.50"), (1, "0.01"), (100, "1.00")])
def test_format_taka(poisha: int, text: str) -> None:
    assert format_taka(poisha) == text


def test_round_trip() -> None:
    for text in ("0.01", "1.00", "99.99", "1250.50", "100000.00"):
        assert format_taka(parse_taka(text)) == text
