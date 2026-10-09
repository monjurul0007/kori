"""Spending patterns for the demo seed: a Dhaka life in BDT. All amounts are whole taka."""

from dataclasses import dataclass

# Weights for the payment method names that exist in the default reference data.
CASH, BKASH, NAGAD, CARD = "Cash", "bKash", "Nagad", "Card"


@dataclass(frozen=True)
class Profile:
    name: str
    category: str
    lo: int  # taka, inclusive
    hi: int  # taka, inclusive
    step: int  # amounts are multiples of this, so they look like real prices
    merchants: tuple[tuple[str, str | None], ...]  # (merchant, note); note may be Banglish
    methods: tuple[str, ...]  # drawn uniformly; repeat a name to weight it


PROFILES: dict[str, Profile] = {
    p.name: p
    for p in (
        Profile(
            "food",
            "Food & Dining",
            60,
            450,
            10,
            (
                ("Star Kabab", "dupur er khabar"),
                ("Coffee World", "coffee"),
                ("Madchef", "lunch"),
                ("Nirob Hotel", "rater khabar"),
                ("Tong Dokan", "cha singara"),
                ("Pizza Hut", None),
                ("Takeout", "nasta"),
            ),
            (CASH, CASH, CASH, BKASH, CARD),
        ),
        Profile(
            "transport",
            "Transport",
            30,
            400,
            10,
            (
                ("Pathao", "bike ride"),
                ("Uber", None),
                ("Rickshaw", "office jaoar rickshaw"),
                ("CNG", "CNG bhara"),
                ("Local bus", None),
            ),
            (CASH, CASH, BKASH, NAGAD),
        ),
        Profile(
            "bazar",
            "Groceries & Bazar",
            1500,
            4500,
            50,
            (("Shwapno", "shaptahik bazar"), ("Agora", "bazar"), ("Kacha Bazar", "sobji, mach")),
            (CASH, CARD, BKASH),
        ),
        Profile("rent", "Rent", 25000, 25000, 1, (("Landlord", "basa vara"),), (BKASH,)),
        Profile("electricity", "Utilities", 1200, 2500, 10, (("DESCO", "bidyut bill"),), (BKASH,)),
        Profile("gas", "Utilities", 1080, 1080, 1, (("Titas Gas", "gas bill"),), (BKASH,)),
        Profile(
            "internet", "Mobile & Internet", 1000, 1000, 1, (("Link3", "wifi bill"),), (BKASH,)
        ),
        Profile(
            "recharge",
            "Mobile & Internet",
            100,
            500,
            50,
            (("Grameenphone", "mobile recharge"), ("Robi", "data pack")),
            (BKASH, NAGAD),
        ),
        Profile(
            "health",
            "Health & Medicine",
            300,
            3000,
            50,
            (("Lazz Pharma", "oshudh"), ("Labaid Diagnostic", "test"), ("Popular Clinic", None)),
            (CASH, CARD),
        ),
        Profile(
            "family",
            "Family & Gifts",
            2000,
            10000,
            500,
            (("Ammu", "ammur jonno"), ("Bhaiya", "pathalam"), ("Apu", "gift")),
            (BKASH, NAGAD),
        ),
        Profile(
            "salary", "Salary", 120000, 120000, 1, (("Employer Ltd", "mashik beton"),), (CARD,)
        ),
        Profile(
            "freelance",
            "Freelance",
            10000,
            40000,
            1000,
            (("Upwork client", "logo project"), ("Local client", "website kaj")),
            (BKASH, CARD),
        ),
        Profile(
            "trip_hotel",
            "Entertainment",
            3000,
            9000,
            500,
            (("Sea Palace Hotel", "hotel booking"),),
            (CARD,),
        ),
    )
}

# How many food and transport transactions happen on a day (weights by repetition).
FOOD_PER_DAY = (1, 1, 2, 2, 3)
TRANSPORT_PER_DAY = (0, 0, 1, 1, 2, 3)
