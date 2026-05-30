"""Qdrant vector-store adapter for Kompare AI/RAG profiles."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Callable, Sequence

from backend.ai_providers import AIProviderError, AIProviderProfile


Transport = Callable[[str, str, dict | None, int], dict]


def _distance_name(value: str | None) -> str:
    normalized = (value or "cosine").strip().lower()
    if normalized == "cosine":
        return "Cosine"
    if normalized == "dot":
        return "Dot"
    if normalized in {"euclidean", "l2"}:
        return "Euclid"
    raise AIProviderError(f"Unsupported Qdrant distance {value!r}.")


def _point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


def _default_transport(base_url: str) -> Transport:
    clean_base = base_url.rstrip("/")

    def transport(method: str, path: str, payload: dict | None, timeout: int) -> dict:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{clean_base}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            if method == "DELETE" and exc.code == 404:
                return {"result": None}
            details = exc.read().decode("utf-8", errors="replace")
            raise AIProviderError(f"Qdrant request failed with HTTP {exc.code}: {details}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError(f"Qdrant request failed: {exc}") from exc

        if not body:
            return {}
        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise AIProviderError(f"Qdrant response was not valid JSON: {exc}") from exc

    return transport


def _chunk_payload(chunk: dict) -> dict:
    return {
        "chunk_id": chunk.get("chunk_id"),
        "sku": chunk.get("sku"),
        "category": chunk.get("category"),
        "text": chunk.get("text"),
        "metadata": chunk.get("metadata") or {},
    }


class QdrantVectorStore:
    """Small REST adapter for one named-vector Qdrant collection."""

    def __init__(
        self,
        *,
        url: str,
        collection: str,
        vector_size: int,
        distance: str = "cosine",
        vector_name: str = "dense",
        transport: Transport | None = None,
        timeout: int = 60,
    ) -> None:
        if not collection:
            raise AIProviderError("Qdrant collection name is required.")
        if vector_size <= 0:
            raise AIProviderError("Qdrant vector size must be greater than zero.")
        self.url = url.rstrip("/")
        self.collection = collection
        self.vector_size = vector_size
        self.distance = _distance_name(distance)
        self.vector_name = vector_name
        self.timeout = timeout
        self._transport = transport or _default_transport(self.url)

    @classmethod
    def from_profile(
        cls,
        profile: AIProviderProfile,
        *,
        transport: Transport | None = None,
        timeout: int = 60,
    ) -> "QdrantVectorStore":
        if profile.vector_backend != "qdrant":
            raise AIProviderError(f"Profile {profile.name!r} does not use Qdrant.")
        return cls(
            url=profile.vector_url or "http://localhost:6333",
            collection=profile.vector_collection or "",
            vector_size=int(profile.embedding_dimension or 0),
            distance=profile.vector_distance,
            transport=transport,
            timeout=timeout,
        )

    def _collection_path(self, suffix: str = "") -> str:
        collection = urllib.parse.quote(self.collection, safe="")
        return f"/collections/{collection}{suffix}"

    def ensure_collection(self, *, recreate: bool = False) -> None:
        if recreate:
            self._transport("DELETE", self._collection_path(), None, self.timeout)
        self._transport(
            "PUT",
            self._collection_path(),
            {
                "vectors": {
                    self.vector_name: {
                        "size": self.vector_size,
                        "distance": self.distance,
                    }
                }
            },
            self.timeout,
        )

    def upsert_chunks(
        self,
        chunks: Sequence[dict],
        vectors: Sequence[Sequence[float]],
        *,
        batch_size: int = 128,
    ) -> dict:
        if len(chunks) != len(vectors):
            raise ValueError("Chunk count must match vector count.")
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than zero.")

        upserted_count = 0
        path = self._collection_path("/points?wait=true")
        for start in range(0, len(chunks), batch_size):
            batch_chunks = chunks[start:start + batch_size]
            batch_vectors = vectors[start:start + batch_size]
            points = []
            for chunk, vector in zip(batch_chunks, batch_vectors):
                chunk_id = str(chunk.get("chunk_id") or "")
                if not chunk_id:
                    raise ValueError("Every chunk must include chunk_id.")
                points.append(
                    {
                        "id": _point_id(chunk_id),
                        "vector": {
                            self.vector_name: [float(value) for value in vector],
                        },
                        "payload": _chunk_payload(chunk),
                    }
                )
            if points:
                self._transport("PUT", path, {"points": points}, self.timeout)
                upserted_count += len(points)

        return {"upserted_count": upserted_count}

    def query(
        self,
        vector: Sequence[float],
        *,
        top_k: int = 12,
        category: str | None = None,
    ) -> list[dict]:
        body: dict = {
            "vector": {
                "name": self.vector_name,
                "vector": [float(value) for value in vector],
            },
            "limit": top_k,
            "with_payload": True,
            "with_vector": False,
        }
        if category:
            body["filter"] = {
                "must": [
                    {
                        "key": "category",
                        "match": {"value": category},
                    }
                ]
            }

        response = self._transport(
            "POST",
            self._collection_path("/points/search"),
            body,
            self.timeout,
        )
        matches = []
        for item in response.get("result") or []:
            payload = item.get("payload") or {}
            matches.append(
                {
                    "chunk_id": payload.get("chunk_id"),
                    "sku": payload.get("sku"),
                    "category": payload.get("category"),
                    "text": payload.get("text"),
                    "metadata": payload.get("metadata") or {},
                    "score": item.get("score"),
                }
            )
        return matches
