from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import date
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from fetch_lunch import (  # noqa: E402
    LunchDataError,
    ParsedDay,
    SOURCES,
    SourceConfig,
    build_month_documents,
    discover_workbook_urls,
    parse_workbook,
    write_documents,
    write_source_index,
)


TEST_SOURCE = SourceConfig(
    "middle-a",
    "中学校 Aブロック",
    "middle_school",
    "A",
    "https://example.test/middle-a.html",
    ("二中",),
)


def make_workbook(
    *,
    wrong_weekday: bool = False,
    yotsuba_title: bool = False,
    beverage: str = "飲むヨーグルト",
) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = (
        "令和8年(2026年)7・8月 （庄内よつば学園 後期献立）"
        if yotsuba_title
        else "令和8年(2026年)7月 （Ａ献立）"
    )

    worksheet["A1"] = "実施\n日"
    worksheet["B1"] = "献立名"
    worksheet["O1"] = "実施\n日"
    worksheet["P1"] = "献立名"

    worksheet["B2"] = "コッペパン"
    worksheet["B3"] = beverage
    worksheet["B4"] = "コンソメスープ"
    worksheet["A3"] = 7
    worksheet["A4"] = "月"
    worksheet["A5"] = 15
    worksheet["A6"] = "日"
    worksheet["A7"] = "（火）" if wrong_weekday else "（水）"
    worksheet["A8"] = "食育の日「兵庫県の食べ物」"
    worksheet["A10"] = "栄養価"

    worksheet["A14"] = "実施\n日"
    worksheet["B14"] = "献立名"
    worksheet["O14"] = "実施\n日"
    worksheet["P14"] = "献立名"
    worksheet["P15"] = "ごはん"
    worksheet["P16"] = "牛乳"
    worksheet["P17"] = "ミネストローネ"
    worksheet["O15"] = "〈2学期〉"
    worksheet["O16"] = 8
    worksheet["O17"] = "月"
    worksheet["O18"] = 26
    worksheet["O19"] = "日"
    worksheet["O20"] = "（水）"
    worksheet["A23"] = "栄養価"

    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


class HtmlDiscoveryTests(unittest.TestCase):
    def test_only_menu_xlsx_links_are_selected(self) -> None:
        html = """
        <a href="menu.pdf">9月献立表（PDF）</a>
        <a href="menu.xlsx">9月献立表（エクセル）</a>
        <a href="ingredients.xlsx">9月中学校給食用半製品・加工品の配合表（エクセル）</a>
        <a href="menu.xlsx">重複する9月献立表</a>
        """
        self.assertEqual(
            discover_workbook_urls(html, "https://example.test/lunch/index.html"),
            ["https://example.test/lunch/menu.xlsx"],
        )


class WorkbookParsingTests(unittest.TestCase):
    def test_multiple_months_headers_beverages_and_tags(self) -> None:
        records = parse_workbook(make_workbook(), TEST_SOURCE)
        documents = build_month_documents(records)

        self.assertEqual(set(documents), {("middle-a", 2026, 7), ("middle-a", 2026, 8)})
        july = documents[("middle-a", 2026, 7)]
        self.assertEqual(july["block"], "A")
        self.assertEqual(july["days"][0]["beverages"], ["飲むヨーグルト"])
        self.assertNotIn("飲むヨーグルト", july["days"][0]["menu"])
        self.assertEqual(july["days"][0]["tags"], ["食育の日「兵庫県の食べ物」"])

        august_day = documents[("middle-a", 2026, 8)]["days"][0]
        self.assertEqual(august_day["date"], "2026-08-26")
        self.assertEqual(august_day["menu"], ["ごはん", "ミネストローネ"])
        self.assertNotIn("tags", august_day)

    def test_yotsuba_uses_configured_block(self) -> None:
        source = SourceConfig(
            "middle-yotsuba",
            "庄内よつば学園（後期課程）",
            "middle_school",
            "yotsuba_late",
            "https://example.test/yotsuba.html",
            ("庄内よつば学園（後期課程）",),
        )
        records = parse_workbook(make_workbook(yotsuba_title=True), source)
        self.assertTrue(all(record.block == "yotsuba_late" for record in records))

    def test_hiragana_milk_is_classified_as_a_beverage(self) -> None:
        records = parse_workbook(make_workbook(beverage="ぎゅうにゅう"), TEST_SOURCE)
        july = build_month_documents(records)[("middle-a", 2026, 7)]
        self.assertEqual(july["days"][0]["beverages"], ["ぎゅうにゅう"])
        self.assertNotIn("ぎゅうにゅう", july["days"][0]["menu"])

    def test_weekday_mismatch_is_rejected(self) -> None:
        with self.assertRaisesRegex(LunchDataError, "曜日が一致しません"):
            parse_workbook(make_workbook(wrong_weekday=True), TEST_SOURCE)

    def test_conflicting_duplicate_date_is_rejected(self) -> None:
        first = ParsedDay(
            "middle-a",
            2026,
            7,
            "middle_school",
            "A",
            {
                "date": "2026-07-15",
                "weekday": "水",
                "status": "scheduled",
                "menu": ["献立A"],
                "beverages": ["牛乳"],
            },
        )
        second_value = dict(first.value)
        second_value["menu"] = ["献立B"]
        second = ParsedDay("middle-a", 2026, 7, "middle_school", "A", second_value)

        with self.assertRaisesRegex(LunchDataError, "同じ日付に異なる献立"):
            build_month_documents([first, second])

    def test_index_is_deterministic_and_preserves_other_sources(self) -> None:
        records = parse_workbook(make_workbook(), TEST_SOURCE)
        with tempfile.TemporaryDirectory() as temporary:
            output_dir = Path(temporary)
            write_documents(build_month_documents(records), output_dir)
            index_path = write_source_index(output_dir, SOURCES)
            first = index_path.read_text(encoding="utf-8")
            write_source_index(output_dir, SOURCES)
            self.assertEqual(index_path.read_text(encoding="utf-8"), first)
            index = json.loads(first)
            self.assertEqual(index["sources"][0]["months"], ["2026-07", "2026-08"])


class GeneratedDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads((PROJECT_ROOT / "schema.json").read_text(encoding="utf-8"))
        cls.index = json.loads((PROJECT_ROOT / "data" / "index.json").read_text(encoding="utf-8"))

    def test_all_sources_and_months_exist(self) -> None:
        self.assertEqual({source["id"] for source in self.index["sources"]}, {source.id for source in SOURCES})
        for source in self.index["sources"]:
            with self.subTest(source=source["id"]):
                self.assertEqual(source["months"], ["2026-07", "2026-08", "2026-09"])
                for month in source["months"]:
                    self.assertTrue((PROJECT_ROOT / "data" / source["id"] / f"{month}.json").is_file())

    def test_generated_files_follow_schema_contract(self) -> None:
        root_required = set(self.schema["required"])
        root_allowed = set(self.schema["properties"])
        day_schema = self.schema["properties"]["days"]["items"]
        day_required = set(day_schema["required"])
        day_allowed = set(day_schema["properties"])

        for source in self.index["sources"]:
            for month in source["months"]:
                path = PROJECT_ROOT / "data" / source["id"] / f"{month}.json"
                document = json.loads(path.read_text(encoding="utf-8"))
                with self.subTest(path=str(path)):
                    self.assertTrue(root_required <= set(document))
                    self.assertTrue(set(document) <= root_allowed)
                    self.assertEqual(document["level"], source["level"])
                    self.assertEqual(document["block"], source["block"])
                    self.assertIsInstance(document["year"], int)
                    self.assertIn(document["month"], range(1, 13))
                    for day in document["days"]:
                        self.assertTrue(day_required <= set(day))
                        self.assertTrue(set(day) <= day_allowed)
                        parsed_date = date.fromisoformat(day["date"])
                        self.assertEqual(parsed_date.year, document["year"])
                        self.assertEqual(parsed_date.month, document["month"])
                        self.assertIn(day["weekday"], "月火水木金土日")
                        self.assertGreaterEqual(len(day["menu"]), 1)
                        self.assertTrue(all(isinstance(value, str) for value in day["menu"] + day["beverages"]))
                        self.assertEqual(len(day.get("tags", [])), len(set(day.get("tags", []))))

    def test_current_middle_a_known_values(self) -> None:
        july = json.loads((PROJECT_ROOT / "data/middle-a/2026-07.json").read_text(encoding="utf-8"))
        september = json.loads((PROJECT_ROOT / "data/middle-a/2026-09.json").read_text(encoding="utf-8"))
        self.assertEqual(len(july["days"]), 12)
        self.assertEqual(len(september["days"]), 19)
        july_days = {day["date"]: day for day in july["days"]}
        september_days = {day["date"]: day for day in september["days"]}
        self.assertEqual(july_days["2026-07-15"]["beverages"], ["飲むヨーグルト"])
        self.assertIn("防災メニュー", september_days["2026-09-01"]["tags"])


if __name__ == "__main__":
    unittest.main()
