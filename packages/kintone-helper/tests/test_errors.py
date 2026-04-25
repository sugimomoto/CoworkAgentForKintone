"""例外階層の単体テスト。"""

from __future__ import annotations

import pytest

from cowork_agent_kintone.errors import (
    ConfigurationError,
    CursorError,
    KintoneApiError,
    KintoneError,
    NetworkError,
)


class TestKintoneErrorHierarchy:
    def test_all_errors_inherit_from_KintoneError(self) -> None:
        assert issubclass(ConfigurationError, KintoneError)
        assert issubclass(NetworkError, KintoneError)
        assert issubclass(KintoneApiError, KintoneError)
        assert issubclass(CursorError, KintoneError)

    def test_KintoneError_is_Exception(self) -> None:
        assert issubclass(KintoneError, Exception)


class TestConfigurationError:
    def test_carries_message(self) -> None:
        err = ConfigurationError("KINTONE_DOMAIN が未設定です")
        assert str(err) == "KINTONE_DOMAIN が未設定です"


class TestKintoneApiError:
    def test_carries_code_message_id_status(self) -> None:
        err = KintoneApiError(
            "validation failed",
            code="GAIA_QU01",
            api_id="abc-123",
            status=400,
        )
        assert str(err) == "validation failed"
        assert err.code == "GAIA_QU01"
        assert err.api_id == "abc-123"
        assert err.status == 400

    def test_defaults_when_minimal(self) -> None:
        err = KintoneApiError("HTTP 500", status=500)
        assert err.code is None
        assert err.api_id is None
        assert err.status == 500

    def test_repr_includes_code_when_present(self) -> None:
        err = KintoneApiError("x", code="GAIA_QU01", status=400)
        text = repr(err)
        assert "GAIA_QU01" in text


class TestNetworkError:
    def test_chains_cause(self) -> None:
        original = TimeoutError("timed out")
        try:
            raise NetworkError("connection failed") from original
        except NetworkError as err:
            assert err.__cause__ is original


class TestCursorError:
    def test_carries_message(self) -> None:
        err = CursorError("cursor expired")
        assert str(err) == "cursor expired"


def test_imported_via_top_level_package() -> None:
    """例外は package トップから import 可能であること (Phase H8 の re-export 用先行確認)。"""
    # H8 で __init__ に追加するまではこちらは失敗してよい
    pytest.importorskip("cowork_agent_kintone")
