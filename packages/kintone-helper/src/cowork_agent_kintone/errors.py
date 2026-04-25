"""ヘルパーライブラリの例外階層。

すべての例外は :class:`KintoneError` から派生する。利用側は ``except KintoneError``
で一括ハンドリング、または用途別に派生クラスを catch して詳細処理を行える。
"""

from __future__ import annotations


class KintoneError(Exception):
    """ヘルパー全体の基底例外。"""


class ConfigurationError(KintoneError):
    """環境変数欠落 / 引数不整合など、利用側の設定ミスに起因するエラー。"""


class NetworkError(KintoneError):
    """タイムアウト・接続失敗・5xx を限度回数までリトライしても回復しなかった場合。

    元の例外は ``raise NetworkError(...) from original`` で連鎖させる。
    """


class KintoneApiError(KintoneError):
    """kintone REST が返した 4xx エラー。

    レスポンス JSON の ``code`` / ``message`` / ``id`` と HTTP ステータスを保持する。
    """

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        api_id: str | None = None,
        status: int = 0,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.api_id = api_id
        self.status = status

    def __repr__(self) -> str:
        parts = [f"status={self.status}"]
        if self.code is not None:
            parts.append(f"code={self.code!r}")
        if self.api_id is not None:
            parts.append(f"id={self.api_id!r}")
        parts.append(f"message={self.args[0]!r}" if self.args else "message=''")
        return f"KintoneApiError({', '.join(parts)})"


class CursorError(KintoneError):
    """カーソル特有のエラー (作成失敗 / トークン切れ / 取得中の異常)。"""
