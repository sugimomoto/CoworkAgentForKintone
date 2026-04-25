"""トップレベル import の smoke テスト。"""

from __future__ import annotations


def test_top_level_imports() -> None:
    from cowork_agent_kintone import (
        Client,
        ConfigurationError,
        CursorError,
        KintoneApiError,
        KintoneError,
        NetworkError,
        __version__,
    )

    assert Client is not None
    assert issubclass(ConfigurationError, KintoneError)
    assert issubclass(CursorError, KintoneError)
    assert issubclass(KintoneApiError, KintoneError)
    assert issubclass(NetworkError, KintoneError)
    assert __version__ == "0.1.0a3"
