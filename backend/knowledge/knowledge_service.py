from typing import List
from langchain_text_splitters import CharacterTextSplitter

try:
    from backend.config.config import settings
    from backend.database.db import DatabaseService, supabase_client
except ImportError:
    from config.config import settings
    from database.db import DatabaseService, supabase_client

class KnowledgeService:
    @staticmethod
    def get_embedding(text: str) -> List[float]:
        """Embeddings for Gemini: local fallback if no embedding service configured.
           With Supabase not set, retrieval uses keyword fallback. Dimension is synthetic 768.
        """
        # No Gemini embedding in this local fallback - keyword search used when Supabase missing
        return [0.0] * 768

    @staticmethod
    def index_entry(entry_id: str, content: str):
        splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = splitter.split_text(content)

        if supabase_client:
            try:
                supabase_client.table("knowledge_embeddings").delete().eq("entry_id", entry_id).execute()
                for idx, chunk in enumerate(chunks):
                    embedding = KnowledgeService.get_embedding(chunk)
                    supabase_client.table("knowledge_embeddings").insert({
                        "entry_id": entry_id,
                        "chunk_index": idx,
                        "content_chunk": chunk,
                        "embedding": embedding
                    }).execute()
            except Exception as e:
                print(f"Error indexing entry in Supabase: {e}")

    @staticmethod
    def semantic_search(query: str, match_count: int = 4) -> List[str]:
        # Skip embedding search if using dummy embeddings
        if not supabase_client:
            # Fallback to keyword search
            entries = DatabaseService.get_knowledge_entries()
            all_chunks = []
            for entry in entries:
                text = entry.get("content", "")
                if query.lower() in text.lower() or any(w in text.lower() for w in query.lower().split()):
                    all_chunks.append(text)
            
            if not all_chunks and entries:
                all_chunks = [e.get("content", "") for e in entries[:match_count]]
            
            return all_chunks[:match_count]

        # Try semantic search with Supabase RPC
        query_embedding = KnowledgeService.get_embedding(query)
        
        # Check if embeddings are real (not dummy zeros)
        if all(x == 0.0 for x in query_embedding[:10]):
            # Dummy embeddings detected, skip RPC and use keyword fallback
            entries = DatabaseService.get_knowledge_entries()
            all_chunks = []
            for entry in entries:
                text = entry.get("content", "")
                if query.lower() in text.lower() or any(w in text.lower() for w in query.lower().split()):
                    all_chunks.append(text)
            
            if not all_chunks and entries:
                all_chunks = [e.get("content", "") for e in entries[:match_count]]
            
            return all_chunks[:match_count]

        try:
            res = supabase_client.rpc(
                "match_knowledge_entries",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": 0.15,
                    "match_count": match_count
                }
            ).execute()
            if res.data:
                return [row["content_chunk"] for row in res.data]
        except Exception as e:
            print(f"Supabase RPC search error: {e}")

        # Final fallback
        entries = DatabaseService.get_knowledge_entries()
        all_chunks = []
        for entry in entries:
            text = entry.get("content", "")
            if query.lower() in text.lower() or any(w in text.lower() for w in query.lower().split()):
                all_chunks.append(text)
        
        if not all_chunks and entries:
            all_chunks = [e.get("content", "") for e in entries[:match_count]]

        return all_chunks[:match_count]
