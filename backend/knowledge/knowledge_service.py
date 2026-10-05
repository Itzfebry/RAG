from typing import List
from langchain_text_splitters import CharacterTextSplitter

try:
    from backend.config.config import settings
    from backend.database.db import DatabaseService, supabase_client
except ImportError:
    from config.config import settings
    from database.db import DatabaseService, supabase_client

# Initialize Sentence-Transformers model globally (loaded once on import)
_embedding_model = None

def _get_embedding_model():
    """Lazy load embedding model on first use."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            print("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✓ Embedding model loaded successfully")
        except Exception as e:
            print(f"Error loading embedding model: {e}")
            _embedding_model = None
    return _embedding_model

class KnowledgeService:
    @staticmethod
    def get_embedding(text: str) -> List[float]:
        """Generate embedding using Sentence-Transformers (semantic, not dummy).
        
        Returns vector of 384 dimensions representing semantic meaning of text.
        Uses all-MiniLM-L6-v2 model (~22MB, optimized for semantic search).
        """
        model = _get_embedding_model()
        if model is None:
            # Fallback to dummy if model load fails
            print("Warning: Using dummy embeddings (model not loaded)")
            return [0.0] * 384
        
        try:
            embedding = model.encode(text, convert_to_tensor=False)
            return embedding.tolist()
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return [0.0] * 384

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
        """Search knowledge entries by semantic similarity.
        
        Uses cosine similarity on embeddings to find relevant chunks.
        Falls back to keyword search if embeddings unavailable.
        """
        query_embedding = KnowledgeService.get_embedding(query)
        
        if not supabase_client:
            # No Supabase, use keyword fallback
            entries = DatabaseService.get_knowledge_entries()
            all_chunks = []
            for entry in entries:
                text = entry.get("content", "")
                if query.lower() in text.lower() or any(w in text.lower() for w in query.lower().split()):
                    all_chunks.append(text)
            
            if not all_chunks and entries:
                all_chunks = [e.get("content", "") for e in entries[:match_count]]
            
            return all_chunks[:match_count]

        # Check if embeddings are real (Sentence-Transformers outputs 384 dims, not dummy 768 zeros)
        is_dummy = len(query_embedding) != 384 or all(x == 0.0 for x in query_embedding[:20])
        
        if is_dummy:
            # Dummy embeddings, use keyword fallback only
            entries = DatabaseService.get_knowledge_entries()
            all_chunks = []
            for entry in entries:
                text = entry.get("content", "")
                if query.lower() in text.lower() or any(w in text.lower() for w in query.lower().split()):
                    all_chunks.append(text)
            
            if not all_chunks and entries:
                all_chunks = [e.get("content", "") for e in entries[:match_count]]
            
            return all_chunks[:match_count]

        # Real embeddings - use Supabase semantic search
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

        # RPC failed, fallback to keyword search
        entries = DatabaseService.get_knowledge_entries()
        all_chunks = []
        for entry in entries:
            text = entry.get("content", "")
            if query.lower() in text.lower() or any(w in text.lower() for w in query.lower().split()):
                all_chunks.append(text)
        
        if not all_chunks and entries:
            all_chunks = [e.get("content", "") for e in entries[:match_count]]

        return all_chunks[:match_count]
