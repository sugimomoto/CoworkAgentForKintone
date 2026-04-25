"""kintone helper library for Cowork Agent (Claude Managed Agents).

主要シンボル::

    from cowork_agent_kintone import (
        Client,
        ConfigurationError,
        CursorError,
        KintoneApiError,
        KintoneError,
        NetworkError,
    )
"""

from .client import Client
from .errors import (
    ConfigurationError,
    CursorError,
    KintoneApiError,
    KintoneError,
    NetworkError,
)

__version__ = "0.1.0a2"

__all__ = [
    "Client",
    "ConfigurationError",
    "CursorError",
    "KintoneApiError",
    "KintoneError",
    "NetworkError",
    "__version__",
]
