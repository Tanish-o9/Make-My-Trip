import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from app.ai_router.router import llm_router

logger = logging.getLogger(__name__)

CHROMADB_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMADB_PORT = os.getenv("CHROMADB_PORT", "8000")

class RAGSystem:
    def __init__(self):
        self.collection_name = "travel_knowledge"
        self._chroma_client = None

    def _get_client(self):
        if self._chroma_client is None:
            try:
                self._chroma_client = chromadb.HttpClient(
                    host=CHROMADB_HOST,
                    port=int(CHROMADB_PORT)
                )
            except Exception as e:
                logger.warning(f"RAGSystem failed to connect to ChromaDB: {e}")
        return self._chroma_client

    def ingest_document(self, text: str, doc_type: str, metadata: Dict[str, Any]) -> List[str]:
        """
        Chunks and ingests a document into ChromaDB.
        doc_type: 'policy' (rules, cancellation), 'guide' (travel blogs), 'faq'
        """
        # Chunking strategy
        if doc_type == "policy":
            chunk_size = 400
            overlap = 50
        elif doc_type == "guide":
            chunk_size = 1000
            overlap = 150
        else:  # faq or other
            chunk_size = 300
            overlap = 0

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += chunk_size - overlap

        client = self._get_client()
        if not client:
            logger.warning("ChromaDB not available for ingestion. Simulating success.")
            return [f"mock_chunk_{i}" for i in range(len(chunks))]

        try:
            collection = client.get_or_create_collection(self.collection_name)
            ids = [f"doc_{doc_type}_{hash(chunk) % 10000000}" for chunk in chunks]
            metadatas = [dict(metadata, doc_type=doc_type) for _ in chunks]
            
            collection.add(
                documents=chunks,
                ids=ids,
                metadatas=metadatas
            )
            logger.info(f"Ingested {len(chunks)} chunks for doc_type: {doc_type}")
            return ids
        except Exception as e:
            logger.error(f"Error during ingestion in ChromaDB: {e}")
            return []

    def query_chunks(self, query: str, filters: Optional[Dict[str, Any]] = None, limit: int = 3) -> List[Dict[str, Any]]:
        client = self._get_client()
        if not client:
            logger.warning("ChromaDB client unavailable for query. Returning mock chunks.")
            return [
                {
                    "text": "For Schengen visas, applicants must submit a completed application form, passport valid for 3 months beyond departure, 2 recent photos, travel itinerary, travel insurance covering €30,000, and proof of sufficient financial means.",
                    "metadata": {"country": "Schengen", "doc_type": "policy"}
                }
            ]

        try:
            collection = client.get_or_create_collection(self.collection_name)
            # Map simple filter keys to ChromaDB query where-clause
            # e.g., filters={"country": "France"} -> where={"country": "France"}
            where_clause = filters if filters else {}

            results = collection.query(
                query_texts=[query],
                where=where_clause,
                n_results=limit
            )
            
            output = []
            if results and results.get("documents"):
                documents = results["documents"][0]
                metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(documents)
                for doc, meta in zip(documents, metadatas):
                    output.append({
                        "text": doc,
                        "metadata": meta
                    })
            return output
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {e}")
            return []

    def rag_query(self, question: str, filters: Optional[Dict[str, Any]] = None, trace_id: str = "rag_trace") -> Dict[str, Any]:
        """
        Retrieves matching document chunks and uses the LLM Router to synthesize a grounded answer.
        """
        # 1. Fetch relevant chunks
        chunks = self.query_chunks(question, filters=filters, limit=3)
        context = "\n---\n".join([c["text"] for c in chunks])

        # 2. Synthesize with LLM Router
        prompt = f"""
You are a helpful travel assistant. Answer the user's travel question using ONLY the provided verified context fragments. 
If the context does not contain the answer, politely explain that you don't have that information.
Always cite the source/metadata if provided in the context.

Verified Context:
{context}

Question:
{question}
"""
        system_prompt = "You are an AI Travel Assistant operating in high-fidelity RAG mode. Ground all answers in context."

        response = llm_router.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            task_type="reasoning",
            trace_id=trace_id
        )

        return {
            "answer": response,
            "sources": [c["metadata"] for c in chunks]
        }

    def seed_Schengen_visa_data(self):
        """Pre-seeds standard visa details for demonstration purposes"""
        visa_text = """
Schengen Visa Requirements:
To apply for a Schengen Visa (for tourism, business, or family visits), you must submit:
1. A valid passport with at least two blank pages, issued within the last 10 years, and valid for at least 3 months after your planned departure.
2. Completed and signed Visa Application Form.
3. Two recent passport-size photos matching Schengen biometric standards.
4. Proof of travel arrangements: round-trip flight reservations showing dates and flight numbers.
5. Travel Medical Insurance: must cover any medical emergencies with a minimum coverage of €30,000, valid for all Schengen countries.
6. Proof of accommodation: hotel booking confirmation, rental agreement, or a letter of invitation from a host.
7. Proof of financial sufficiency: bank statements showing transactions for the last 3 months, or proof of sponsorship.
Processing Time: Typically 15 calendar days, but can take up to 45 days in peak seasons.
"""
        self.ingest_document(
            text=visa_text,
            doc_type="policy",
            metadata={"country": "Schengen", "scope": "visa_requirements"}
        )

# Global RAG Instance
rag_system = RAGSystem()
